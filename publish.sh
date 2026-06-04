#!/usr/bin/env bash
# Publish signal-to-noise.co.
#
# Usage: drop a new .md into src/content/insights/ and a matching
# cover image (.png/.jpg/.webp, same slug) into public/img/, then run
#
#   ./publish.sh
#
# What it does, in order:
#   0. Discover untracked .md in insights/ and untracked images in img/.
#      Exit cleanly if there's nothing new.
#   1. Convert PNG/JPG to WebP (q82, max width 1200), delete source,
#      chmod 644. Skip files already WebP except chmod 644.
#   2. Sweep public/img/ for any .webp that ended up mode 600 (the bug
#      that returned 403 last time) and fix to 644.
#   3. Validate frontmatter on each new article: required fields
#      present, coverImage path resolves to a real file.
#   4. Build (npm run build runs the title linter via prebuild).
#   5. Show a summary and prompt before invoking deploy.sh.
#
# The script does NOT git-add or commit anything. That stays manual —
# previous sessions established a selective-add habit.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

INSIGHTS_DIR="src/content/insights"
IMG_DIR="public/img"

# ---------- 0. Discovery -----------------------------------------------------

echo "==> Discovering new content"

NEW_ARTICLES=()
while IFS= read -r path; do
  [[ -n "$path" ]] && NEW_ARTICLES+=("$path")
done < <(
  git status --porcelain "$INSIGHTS_DIR" \
    | awk '/^\?\? / && /\.md$/ { sub(/^\?\? /, ""); print }'
)

NEW_IMAGES=()
while IFS= read -r path; do
  [[ -n "$path" ]] && NEW_IMAGES+=("$path")
done < <(
  git status --porcelain "$IMG_DIR" \
    | awk '/^\?\? / && /\.(png|PNG|jpg|JPG|jpeg|JPEG|webp|WEBP)$/ { sub(/^\?\? /, ""); print }'
)

if [[ ${#NEW_ARTICLES[@]} -eq 0 && ${#NEW_IMAGES[@]} -eq 0 ]]; then
  echo "    Nothing new in $INSIGHTS_DIR or $IMG_DIR. Exiting."
  exit 0
fi

echo "    Articles: ${#NEW_ARTICLES[@]}"
for a in "${NEW_ARTICLES[@]}"; do echo "      - $a"; done
echo "    Images:   ${#NEW_IMAGES[@]}"
for i in "${NEW_IMAGES[@]}"; do echo "      - $i"; done

# ---------- 1. Image processing ---------------------------------------------

if [[ ${#NEW_IMAGES[@]} -gt 0 ]]; then
  echo "==> Processing images"

  if ! command -v cwebp >/dev/null 2>&1; then
    echo "    [error] cwebp not installed. brew install webp" >&2
    exit 1
  fi

  for img in "${NEW_IMAGES[@]}"; do
    ext="${img##*.}"
    slug="$(basename "${img%.*}")"
    out="${IMG_DIR}/${slug}.webp"

    case "$ext" in
      png|PNG|jpg|JPG|jpeg|JPEG)
        echo "    cwebp $img -> $out"
        cwebp -q 82 -resize 1200 0 "$img" -o "$out" 2>&1 | tail -2
        rm "$img"
        chmod 644 "$out"
        size_kb=$(( $(stat -f%z "$out") / 1024 ))
        echo "      size: ${size_kb} KB"
        if (( size_kb > 150 )); then
          echo "      [warn] over 150 KB target — consider re-running at q75"
        fi
        ;;
      webp|WEBP)
        echo "    $img already .webp"
        chmod 644 "$img"
        ;;
    esac
  done
fi

# ---------- 2. Permission audit ---------------------------------------------

# Defensive sweep: any .webp mode 600 → 644.
# Background: nginx runs as www-data; owner-only files return 403, not 404.
mode_600_count=$(find "$IMG_DIR" -name '*.webp' -perm 600 2>/dev/null | wc -l | tr -d ' ')
if [[ "$mode_600_count" -gt 0 ]]; then
  echo "==> Fixing $mode_600_count .webp file(s) from mode 600 to 644"
  find "$IMG_DIR" -name '*.webp' -perm 600 -exec chmod 644 {} \;
fi

# ---------- 3. Article frontmatter validation -------------------------------

if [[ ${#NEW_ARTICLES[@]} -gt 0 ]]; then
  echo "==> Validating article frontmatter"

  for article in "${NEW_ARTICLES[@]}"; do
    echo "    $article"

    for field in title date excerpt tags draft coverImage coverImageAlt; do
      if ! grep -qE "^${field}:" "$article"; then
        echo "    [error] missing frontmatter field: $field" >&2
        exit 1
      fi
    done

    # coverImage: /img/foo.webp  →  public/img/foo.webp must exist
    cover=$(awk -F': *' '/^coverImage:/ { sub(/^"/, "", $2); sub(/"$/, "", $2); print $2; exit }' "$article")
    cover_path="public${cover}"
    if [[ ! -f "$cover_path" ]]; then
      echo "    [error] coverImage references missing file: $cover_path" >&2
      exit 1
    fi

    # coverImageAlt should not be a stub
    alt=$(awk -F': *' '/^coverImageAlt:/ { sub(/^"/, "", $2); sub(/"$/, "", $2); print $2; exit }' "$article")
    if [[ ${#alt} -lt 60 ]]; then
      echo "    [warn] coverImageAlt is ${#alt} chars — target is 200–400."
    fi
  done
fi

# ---------- 4. Build ---------------------------------------------------------

echo "==> Build (title linter runs in prebuild)"
npm run build

# ---------- 5. Confirm and deploy -------------------------------------------

echo ""
echo "============================================================"
echo "  Ready to deploy."
echo "    Articles: ${#NEW_ARTICLES[@]}"
echo "    Images:   ${#NEW_IMAGES[@]} (now .webp, mode 644)"
echo "============================================================"
read -r -p "Run ./deploy.sh now? [y/N] " ans
case "${ans:-N}" in
  y|Y|yes|YES)
    ./deploy.sh
    echo ""
    echo "==> Published. Don't forget to commit:"
    echo "    git status"
    echo "    git add <the files you want>"
    echo "    git commit -m '...'"
    ;;
  *)
    echo "    Deploy skipped. dist/ is built; re-run ./deploy.sh when ready."
    ;;
esac
