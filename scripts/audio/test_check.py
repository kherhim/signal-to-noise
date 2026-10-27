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
def test_money_forms(): assert match_score("The dividend is now 6 dollars 60 a year.", "dividend now $6.60 a year.") == 1.0
def test_money_scale(): assert match_score("about 13.5 billion dollars", "about $13.5 billion") == 1.0
def test_split_names(): assert match_score("Dimon arrived at JPMorgan.", "Diamond arrived at JP Morgan.") == 1.0
def test_compound_with_alias(): assert match_score("Citigroup looks like the clear choice.", "City Group looks like clear choice.") == 1.0
def test_wrong_figure_fails(): assert match_score("The dividend is now 6 dollars 60.", "The dividend is now $9.40.") < 0.85
def test_british_american(): assert match_score("What to prioritise", "What to prioritize.") == 1.0
def test_cents(): assert match_score("by late 2024 it cost 6 cents.", "by late 2024 it cost $0.06.") == 1.0
def test_behavioural(): assert match_score("a form of behavioural engineering", "a form of behavioral engineering.") == 1.0
def test_source_typos(): assert match_score("This artcile is targetted towards juniour staff", "This article is targeted towards junior staff.") == 1.0
def test_real_word_misread_still_fails(): assert match_score("consumer banking", "consumer baking") < 0.85
def test_thousands(): assert match_score("It cost 250 thousand dollars a year.", "It cost $250,000 a year.") >= 0.85
