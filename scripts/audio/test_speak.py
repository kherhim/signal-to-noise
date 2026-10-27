from speak import say_numbers, int_words
from check import match_score


def test_years(): assert say_numbers("in 2025 and 2004 and 1998") == "in twenty twenty-five and two thousand and four and nineteen ninety-eight"
def test_decimal(): assert say_numbers("17.6 billion dollars") == "seventeen point six billion dollars"
def test_integers(): assert say_numbers("361 dollars and 131,000 staff") == "three hundred and sixty-one dollars and one hundred and thirty-one thousand staff"
def test_leaves_alphanumerics(): assert say_numbers("H100 chips, Q3, S and P 500") == "H100 chips, Q3, S and P five hundred"
def test_big(): assert int_words(2_500_000) == "two million five hundred thousand"
def test_words_check_against_digits():
    for s in ["Citi returned 17.6 billion dollars in 2025.", "The 361 dollars is disappearing.", "about 11.5 per cent in 2004"]:
        assert match_score(s, say_numbers(s)) == 1.0, s
