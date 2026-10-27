"""Numbers written out in words before Chatterbox reads a sentence.

Chatterbox misreads digits ("17.6" came out as "1726"), so the voice gets words.
The check still compares against the digit form, which is what Whisper writes.
"""
import re

_ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen "
         "fourteen fifteen sixteen seventeen eighteen nineteen").split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
_SCALES = [(10**12, "trillion"), (10**9, "billion"), (10**6, "million"), (1000, "thousand")]


def _under_100(n):
    if n < 20:
        return _ONES[n]
    t, u = divmod(n, 10)
    return _TENS[t] + (f"-{_ONES[u]}" if u else "")


def _under_1000(n):
    h, r = divmod(n, 100)
    if not h:
        return _under_100(r)
    return f"{_ONES[h]} hundred" + (f" and {_under_100(r)}" if r else "")


def int_words(n):
    if n == 0:
        return "zero"
    parts = []
    for size, name in _SCALES:
        if n >= size:
            q, n = divmod(n, size)
            parts.append(f"{int_words(q)} {name}")
    if n:
        parts.append(("and " if parts and n < 100 else "") + _under_1000(n))
    return " ".join(parts)


def year_words(n):
    if 2000 <= n <= 2009:
        return "two thousand" + (f" and {_ONES[n - 2000]}" if n > 2000 else "")
    hi, lo = divmod(n, 100)
    if lo == 0:
        return f"{_under_100(hi)} hundred"
    return f"{_under_100(hi)} " + (f"oh {_ONES[lo]}" if lo < 10 else _under_100(lo))


_NUM = re.compile(r"(?<![\w.])(\d[\d,]*)(?:\.(\d+))?(?![\w]|\.\d)")


def say_numbers(text):
    def rep(m):
        whole, frac = m.group(1).replace(",", ""), m.group(2)
        n = int(whole)
        if frac is None and "," not in m.group(1) and len(whole) == 4 and 1100 <= n <= 2099:
            return year_words(n)
        out = int_words(n)
        if frac:
            out += " point " + " ".join(_ONES[int(d)] for d in frac)
        return out
    return _NUM.sub(rep, text)
