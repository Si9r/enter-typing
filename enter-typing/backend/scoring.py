import json


def clamp_number(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def calculate_typing_score(wpm: int, accuracy: float, typos: int, difficulty: int) -> int:
    safe_wpm = clamp_number(int(wpm), 0, 600)
    safe_accuracy = clamp_number(float(accuracy), 0, 100)
    safe_typos = clamp_number(int(typos), 0, 10000)
    safe_difficulty = clamp_number(int(difficulty or 3), 1, 5)
    difficulty_multiplier = 1 + ((safe_difficulty - 3) * 0.1)
    accuracy_multiplier = (safe_accuracy / 100) ** 2
    return max(0, round((safe_wpm * accuracy_multiplier * difficulty_multiplier) - (safe_typos * 2)))


def get_quiz_answer_slot_count(quiz_data: str) -> int:
    try:
        parsed = json.loads(quiz_data or "[]")
    except Exception:
        return 0

    total = 0
    for item in parsed:
        if item.get("singer"):
            total += 1
        if item.get("title"):
            total += 1
        if item.get("lyrics"):
            total += 1
    return total


def get_quiz_max_score(quiz_data: str) -> int:
    try:
        parsed = json.loads(quiz_data or "[]")
    except Exception:
        return 0

    score = 0
    combo = 0
    answer_points = {"singer": 50, "title": 70, "lyrics": 100}
    for item in parsed:
        for answer_type, points in answer_points.items():
            if item.get(answer_type):
                score += points + (combo * 10)
                combo += 1
    return score
