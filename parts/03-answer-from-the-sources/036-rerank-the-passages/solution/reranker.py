"""The reranker. You do not need to change this file.

score_pair(question, passage_text) reads both together and returns a number. A higher number means the
passage answers the question better. Each call costs time and money, so call it as little as you can.
"""

STOP_WORDS = {"a", "an", "the", "is", "are", "of", "to", "in", "on", "for", "and", "or", "it", "by",
              "at", "be", "can", "do", "does", "how", "what", "when", "who", "which", "much", "many"}


def words(text):
    cleaned = "".join(letter if letter.isalnum() else " " for letter in text.lower())
    return {word for word in cleaned.split() if word not in STOP_WORDS}


def score_pair(question, passage_text):
    return len(words(question) & words(passage_text))
