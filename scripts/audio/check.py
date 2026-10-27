"""Word-level matching of expected narration text against a Whisper transcript.

THRESHOLD is the pass mark used by narrate.py (see the tuning note below).
"""
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


def normalise(text: str) -> list[str]:
    t = text.lower().replace("&", " and ").replace("%", " per cent ")
    t = re.sub(r"\bpercent\b", "per cent", t)
    t = re.sub(r"(?<=\d),(?=\d{3})", "", t)   # 131,000 -> 131000
    t = re.sub(r"[-‐-―]", " ", t)    # thirty-one -> thirty one
    t = re.sub(r"[^a-z0-9.\s]", " ", t)
    t = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", t)  # drop full stops, keep decimals
    return _merge_numbers(t.split())


def match_score(expected: str, heard: str) -> float:
    a, b = normalise(expected), normalise(heard)
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()
