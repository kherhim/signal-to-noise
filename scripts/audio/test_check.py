import check
from check import match_score


def test_exact(): assert match_score("It earns 22 per cent.", "It earns 22 per cent") == 1.0
def test_number_words(): assert match_score("about 131,000 dollars", "about a hundred and thirty-one thousand dollars") >= 0.85
def test_skipped_clause(): assert match_score("Travelers left in 2002, Smith Barney was sold in the crisis.", "Travelers left in 2002.") < 0.85
def test_garbled(): assert match_score("Jane Fraser has withdrawn consumer banking", "Jane razor has withdrawn consumer baking") < 0.85
def test_percent_symbol(): assert match_score("It earns 22 per cent.", "It earns 22%.") == 1.0
def test_year_pairs():
    assert check.normalise("nineteen ninety nine") == ["1999"]
    assert check.normalise("twenty twenty six") == ["2026"]
    assert match_score("In 2026 it rose", "In twenty twenty six it rose") == 1.0
def test_aliases(monkeypatch):
    monkeypatch.setattr(check, "ALIASES", {"frazier": "fraser"})
    assert match_score("Jane Fraser left", "Jane Frazier left") == 1.0
