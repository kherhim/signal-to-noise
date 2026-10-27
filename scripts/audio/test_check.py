from check import match_score


def test_exact(): assert match_score("It earns 22 per cent.", "It earns 22 per cent") == 1.0
def test_number_words(): assert match_score("about 131,000 dollars", "about a hundred and thirty-one thousand dollars") >= 0.85
def test_skipped_clause(): assert match_score("Travelers left in 2002, Smith Barney was sold in the crisis.", "Travelers left in 2002.") < 0.85
def test_garbled(): assert match_score("Jane Fraser has withdrawn consumer banking", "Jane razor has withdrawn consumer baking") < 0.85
def test_percent_symbol(): assert match_score("It earns 22 per cent.", "It earns 22%.") == 1.0
