from datetime import datetime, timedelta, timezone
from typing import Tuple

def calculate_sm2(
    grade: int,  # 1: Again, 2: Hard, 3: Good, 4: Easy
    current_repetition: int = 0,
    current_interval: int = 1,
    current_ease: float = 2.50
) -> Tuple[int, int, float, datetime, str]:
    """
    SuperMemo-2 (SM-2 / Anki) Spaced Repetition Algorithm.
    Returns: (new_repetition, new_interval_days, new_ease_factor, next_review_at, new_state)
    """
    ease = max(1.30, min(3.00, float(current_ease)))
    rep = current_repetition
    interval = current_interval

    now = datetime.now(timezone.utc)

    if grade < 3:  # Again (1) or Hard (2)
        rep = 0
        interval = 1
        state = "learning"
        if grade == 1:
            ease = max(1.30, ease - 0.20)
        else:
            ease = max(1.30, ease - 0.15)
        next_review_at = now + timedelta(days=1)
    else:  # Good (3) or Easy (4)
        if rep == 0:
            interval = 4 if grade == 4 else 1
        elif rep == 1:
            interval = 10 if grade == 4 else 6
        else:
            multiplier = ease * (1.3 if grade == 4 else 1.0)
            interval = max(interval + 1, int(round(interval * multiplier)))

        rep += 1

        # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        q = 5 if grade == 4 else 4
        ease_delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
        ease = max(1.30, min(3.00, round(ease + ease_delta, 2)))

        if rep >= 4 and interval >= 14:
            state = "mastered"
        else:
            state = "review"

        next_review_at = now + timedelta(days=interval)

    return rep, interval, round(ease, 2), next_review_at, state
