"""Word-level matching of expected narration text against a Whisper transcript.

THRESHOLD is the pass mark used by narrate.py (see the tuning note below).
"""
import json
import os
import re
from difflib import SequenceMatcher

# Tuned 27 Oct 2026 (see task report): clean Chatterbox clips scored ~1.0 and
# a clip of a different sentence scored well below this, so 0.85 stays.
THRESHOLD = 0.85

_UNITS = {w: i for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen "
    "fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_TENS = {w: 10 * (i + 2) for i, w in enumerate(
    "twenty thirty forty fifty sixty seventy eighty ninety".split())}
_SCALES = {"thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000,
           "trillion": 1_000_000_000_000}


_ALIASES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aliases.json")


def _load_aliases(path=None):
    try:
        with open(path or _ALIASES_PATH) as f:
            return {k.lower(): v.lower() for k, v in json.load(f).items()}
    except (OSError, ValueError):
        return {}


ALIASES = _load_aliases()
_YEAR_FIRST = {"thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"}


def _is_num(w):
    return w in _UNITS or w in _TENS or w == "hundred" or w in _SCALES


def _merge_numbers(words):
    out, i, n = [], 0, len(words)
    while i < n:
        w = words[i]
        starts = _is_num(w) or (w == "a" and i + 1 < n and words[i + 1] in ("hundred", "thousand", "million", "billion", "trillion"))
        if not starts:
            out.append(w)
            i += 1
            continue
        if w in _YEAR_FIRST and i + 1 < n and words[i + 1] in _TENS:
            year = _UNITS.get(w, 20) * 100 + _TENS[words[i + 1]]
            j = i + 2
            if j < n and words[j] in _UNITS and 1 <= _UNITS[words[j]] <= 9:
                year += _UNITS[words[j]]
                j += 1
            out.append(str(year))
            i = j
            continue
        total = current = 0
        j = i
        while j < n:
            x = words[j]
            if x == "and" and j + 1 < n and _is_num(words[j + 1]) and j > i:
                j += 1
                continue
            if x == "a" and j == i:
                current += 1
            elif x in _UNITS:
                current += _UNITS[x]
            elif x in _TENS:
                current += _TENS[x]
            elif x == "hundred":
                current = max(current, 1) * 100
            elif x in _SCALES:
                total += max(current, 1) * _SCALES[x]
                current = 0
            else:
                break
            j += 1
        out.append(str(total + current))
        i = j
    return out


# Words Whisper often drops or that carry no meaning for the check.
_STOP = {"a", "an", "the", "is", "are", "was", "and", "of", "to", "it"}
_CURRENCY = {"dollars", "dollar", "pounds", "pound", "euros", "euro"}


def _mark_points(words):
    """"seventeen point six" -> seventeen, ".6" (digits after "point" are read one by one)."""
    out, i = [], 0
    while i < len(words):
        if words[i] == "point" and out and (_is_num(out[-1]) or out[-1].isdigit()) and i + 1 < len(words) and (words[i + 1] in _UNITS and _UNITS[words[i + 1]] < 10 or words[i + 1].isdigit()):
            digits, j = "", i + 1
            while j < len(words) and (words[j] in _UNITS and _UNITS[words[j]] < 10 or (words[j].isdigit() and len(words[j]) == 1)):
                digits += str(_UNITS.get(words[j], words[j]))
                j += 1
            out.append("." + digits)
            i = j
        else:
            out.append(words[i])
            i += 1
    return out


def _join_points(words):
    out = []
    for w in words:
        if w.startswith(".") and w[1:].isdigit() and out and out[-1].isdigit():
            out[-1] += w
        else:
            out.append(w)
    return out


def normalise(text: str) -> list[str]:
    t = text.lower()
    # Script says "6 dollars 60"; Whisper writes "$6.60". Both become 6.60.
    t = re.sub(r"\b(\d+) (?:dollars|pounds|euros) (\d{2})\b", r"\1.\2", t)
    # "6 cents" / "50 pence" and Whisper's "$0.06" both become 0.06.
    t = re.sub(r"\b(\d{1,2}) (?:cents|pence|p)\b", lambda m: f"0.{int(m.group(1)):02d}", t)
    t = re.sub(r"[$£€]", " ", t)
    t = t.replace("&", " and ").replace("%", " per cent ")
    t = re.sub(r"\bpercent\b", "per cent", t)
    t = re.sub(r"(?<=\d),(?=\d{3})", "", t)   # 131,000 -> 131000
    t = re.sub(r"[-‐-―]", " ", t)    # thirty-one -> thirty one
    t = re.sub(r"[^a-z0-9.\s]", " ", t)
    t = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", t)  # drop full stops, keep decimals
    words = [ALIASES.get(w, w) for w in _join_points(_merge_numbers(_mark_points(t.split())))]
    return [_us(w) for w in words if w not in _STOP and w not in _CURRENCY]


def _us(w):
    """Whisper writes American spellings; fold both sides to one form (prioritise/prioritize)."""
    w = re.sub(r"is(e|ed|es|ing|ation|ations)$", r"iz\1", w)
    return w.replace("our", "or") if len(w) > 4 else w


def _join_splits(words: list[str], vocab: set[str]) -> list[str]:
    """Merge neighbours the other side writes as one word: "jp morgan" -> "jpmorgan"."""
    out, i = [], 0
    while i < len(words):
        if i + 1 < len(words) and words[i] + words[i + 1] in vocab:
            out.append(words[i] + words[i + 1])
            i += 2
        else:
            out.append(words[i])
            i += 1
    return out


_DICT_PATH = "/usr/share/dict/words"
_dict: set[str] | None = None


def _known(word: str) -> bool:
    global _dict
    if _dict is None:
        try:
            with open(_DICT_PATH) as f:
                _dict = {w.strip().lower() for w in f}
        except OSError:
            _dict = set()
    return not _dict or word in _dict


def _forgive_typos(expected: list[str], heard: set[str]) -> list[str]:
    """A misspelt word in the essay ("artcile") is heard as the real word; let it match.
    Only words missing from the system dictionary qualify, so "banking" heard as "baking" still fails."""
    out = []
    for w in expected:
        if len(w) >= 6 and w not in heard and not w.isdigit() and not _known(w):
            near = max(heard, key=lambda h: SequenceMatcher(None, w, h).ratio(), default=None)
            if near and SequenceMatcher(None, w, near).ratio() >= 0.85:
                w = near
        out.append(w)
    return out


def match_score(expected: str, heard: str) -> float:
    a, b = normalise(expected), normalise(heard)
    a, b = _join_splits(a, set(b)), _join_splits(b, set(a))
    a = _forgive_typos(a, set(b))
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()
