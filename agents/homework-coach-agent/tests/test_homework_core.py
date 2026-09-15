#!/usr/bin/env python3
"""Unit tests for homework_core — TDD against specs/features/homework-coach.md."""

from __future__ import annotations

import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from homework_core import (  # noqa: E402
    analyze_contributions,
    answer_query,
    build_day_plan,
    classify_intent,
    get_rotation_assignee,
)

ISO = "2026-09-02T10:00:00.000Z"


def member(member_id: str, name: str) -> dict:
    return {
        "id": member_id,
        "name": name,
        "color": "#3B82F6",
        "avatar": None,
        "createdAt": ISO,
        "updatedAt": ISO,
    }


def completion(cid: str, member_id: str, date: str, points: int = 10) -> dict:
    return {
        "id": cid,
        "taskId": "t1",
        "memberId": member_id,
        "date": date,
        "points": points,
        "createdAt": ISO,
    }


def daily_rotation_task() -> dict:
    return {
        "id": "t1",
        "title": "Dishes",
        "icon": "🍽️",
        "schedule": {"type": "daily"},
        "assignment": {"type": "rotation", "memberIds": ["m1", "m2", "m3"]},
        "points": 10,
        "active": True,
        "createdAt": ISO,
        "updatedAt": ISO,
    }


def points_household() -> dict:
    return {
        "members": [
            member("m1", "Emma"),
            member("m2", "Dad"),
            member("m3", "Mom"),
        ],
        "tasks": [daily_rotation_task()],
        "completions": [
            completion("c1", "m1", "2026-09-01", 10),
            completion("c2", "m1", "2026-09-02", 15),
            completion("c3", "m1", "2026-09-03", 10),
            completion("c4", "m1", "2026-09-04", 10),
            completion("c5", "m1", "2026-08-30", 5),
            completion("c6", "m2", "2026-09-02", 10),
            completion("c7", "m2", "2026-09-01", 10),
            completion("c8", "m3", "2026-09-02", 10),
        ],
        "overrides": [],
        "rewards": [],
        "redemptions": [],
        "settings": {"weekStartsOn": 1, "locale": "en"},
        "meta": {"schemaVersion": 1, "lastModified": ISO},
    }


def test_rotation_first_three_daily_occurrences():
    task = daily_rotation_task()
    assert get_rotation_assignee(task, "2026-09-01", []) == "m1"
    assert get_rotation_assignee(task, "2026-09-02", []) == "m2"
    assert get_rotation_assignee(task, "2026-09-03", []) == "m3"


def test_rotation_wraps_on_fourth_daily_occurrence():
    task = daily_rotation_task()
    assert get_rotation_assignee(task, "2026-09-04", []) == "m1"


def test_rotation_null_when_task_does_not_occur():
    task = daily_rotation_task()
    task["schedule"] = {"type": "weekdays", "days": [1, 3, 5]}
    assert get_rotation_assignee(task, "2026-09-01", []) is None


def test_rotation_counts_only_firing_weekdays():
    task = daily_rotation_task()
    task["assignment"] = {"type": "rotation", "memberIds": ["m1", "m2"]}
    task["schedule"] = {"type": "weekdays", "days": [1, 3, 5]}
    assert get_rotation_assignee(task, "2026-09-07", []) == "m1"
    assert get_rotation_assignee(task, "2026-09-09", []) == "m2"


def test_day_plan_assigns_dishes_to_rotation_member():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    plan = build_day_plan(household, "2026-09-02")
    assignee = get_rotation_assignee(household["tasks"][0], "2026-09-02", [])
    member_row = next(row for row in plan["by_member"] if row["member_id"] == assignee)
    titles = [item["title"] for item in member_row["tasks"]]
    assert "Dishes" in titles
    assert plan["date"] == "2026-09-02"


def test_day_plan_lists_open_pool_task():
    household = {
        "members": [member("m1", "Emma")],
        "tasks": [
            {
                "id": "tidy",
                "title": "Tidy",
                "icon": "🧹",
                "schedule": {"type": "daily"},
                "assignment": {"type": "pool"},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    plan = build_day_plan(household, "2026-09-02")
    assert len(plan["open_pool"]) == 1
    assert plan["open_pool"][0]["title"] == "Tidy"
    assert plan["open_pool"][0]["assignment_type"] == "pool"


def test_analyze_contributions_single_leader():
    result = analyze_contributions(points_household(), "2026-09-02")
    assert result["most_active_ids"] == ["m1"]
    emma = next(row for row in result["members"] if row["member_id"] == "m1")
    assert emma["week_completions"] == 4


def test_analyze_contributions_tied_leaders():
    household = points_household()
    household["completions"] = [
        completion("c1", "m1", "2026-09-01"),
        completion("c2", "m1", "2026-09-02"),
        completion("c3", "m1", "2026-09-03"),
        completion("c4", "m1", "2026-09-04"),
        completion("c5", "m2", "2026-09-01"),
        completion("c6", "m2", "2026-09-02"),
        completion("c7", "m2", "2026-09-03"),
        completion("c8", "m2", "2026-09-04"),
        completion("c9", "m3", "2026-09-02"),
    ]
    result = analyze_contributions(household, "2026-09-04")
    assert result["most_active_ids"] == ["m1", "m2"]


def test_classify_intent_finnish_points_question():
    assert classify_intent("Kuinka monta pistettä Emmalla on?") == "contributions"


def test_classify_intent_plan():
    assert classify_intent("Who should do dishes today?") == "plan"


def test_classify_intent_what_should_person_do_is_plan():
    assert classify_intent("What should SqlKid do?") == "plan"
    assert classify_intent("What should Emma do") == "plan"


def test_answer_query_empty_household_mentions_setup():
    household = {
        "members": [],
        "tasks": [],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Who should do what?", date="2026-09-02")
    assert result["plan"]["by_member"] == []
    assert "Setup" in result["answer"]


def test_answer_focuses_named_rotation_task():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "once", "date": "2026-09-02"},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            },
            {
                "id": "tidy",
                "title": "Tidy",
                "icon": "🧹",
                "schedule": {"type": "daily"},
                "assignment": {"type": "pool"},
                "points": 10,
                "active": True,
            },
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Whose turn is Dishes?", date="2026-09-02")
    assert "Emma" in result["answer"]
    assert "Dishes" in result["answer"]
    assert "Tidy" not in result["answer"]


def test_answer_finnish_alias_matches_english_title():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "once", "date": "2026-09-02"},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Kuka tekee tiskit?", date="2026-09-02", locale="fi")
    assert "Emma" in result["answer"]
    assert "Dishes" in result["answer"]
    assert "tiskit" not in result["answer"]
    assert "Tidy" not in result["answer"]
    assert "henkilön" not in result["answer"]
    assert "vuorossa: Emma" in result["answer"]


def test_answer_named_task_not_today_points_to_later_in_week():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "tidy",
                "title": "Tidy living room",
                "icon": "🧹",
                "schedule": {"type": "once", "date": "2026-09-04"},
                "assignment": {"type": "pool"},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Who should do Tidy living room?", date="2026-09-02")
    assert "not scheduled today" in result["answer"]
    assert "It's on Friday" in result["answer"]
    assert "anyone" in result["answer"].lower()
    assert "Dad:" not in result["answer"]


def test_answer_who_should_do_later_task_names_assignee():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "vacuum",
                "title": "Vacuum",
                "icon": "🧹",
                "schedule": {"type": "weekly", "day": 6},
                "assignment": {"type": "rotation", "memberIds": ["m1"]},
                "points": 10,
                "active": True,
            },
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m2"]},
                "points": 10,
                "active": True,
            },
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Who should do Vacuum?", date="2026-09-09")
    assert "Saturday" in result["answer"]
    assert "Emma" in result["answer"]
    assert "Dad:" not in result["answer"]
    assert "Here's who should do what" not in result["answer"]


def test_answer_when_is_matches_title_keyword():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "yard",
                "title": "Yard / outdoor",
                "icon": "🌱",
                "schedule": {"type": "weekly", "day": 6},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            },
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m1"]},
                "points": 10,
                "active": True,
            },
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "When is Yard?", date="2026-09-09")
    assert "not scheduled today" in result["answer"]
    assert "Saturday" in result["answer"]
    assert "Dishes" not in result["answer"]
    assert "Here's who should do what" not in result["answer"]


def test_answer_named_task_earlier_this_week_uses_past_tense():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "tidy",
                "title": "Tidy living room",
                "icon": "🧹",
                "schedule": {"type": "once", "date": "2026-09-07"},
                "assignment": {"type": "pool"},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "Who should do Tidy living room?", date="2026-09-09")
    assert "not scheduled today" in result["answer"]
    assert "It was on Monday" in result["answer"]
    assert "It's on Monday" not in result["answer"]


def test_answer_focuses_named_member():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "once", "date": "2026-09-02"},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            },
            {
                "id": "tidy",
                "title": "Tidy",
                "icon": "🧹",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m2"]},
                "points": 10,
                "active": True,
            },
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "What should Emma do today?", date="2026-09-02")
    assert "Emma" in result["answer"]
    assert "Dishes" in result["answer"]
    assert "Dad:" not in result["answer"]
    assert "Tidy" not in result["answer"]


def test_answer_what_should_person_do_skips_leaderboard():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "once", "date": "2026-09-02"},
                "assignment": {"type": "rotation", "memberIds": ["m1"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [completion("c1", "m2", "2026-09-02")],
        "overrides": [],
    }
    result = answer_query(household, "What should Emma do?", date="2026-09-02")
    assert "Emma" in result["answer"]
    assert "has done the most" not in result["answer"]
    assert "Dad:" not in result["answer"]


def _two_person_daily_household() -> dict:
    return {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "dishes",
                "title": "Dishes",
                "icon": "🍽️",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m1", "m2"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }


def test_answer_unknown_chore_does_not_dump_roster():
    result = answer_query(
        _two_person_daily_household(),
        "Who should do math homework?",
        date="2026-09-02",
    )
    assert "math homework" in result["answer"].lower()
    assert "Dad:" not in result["answer"]
    assert "Dishes" not in result["answer"]


def test_answer_who_should_do_what_still_lists_roster():
    result = answer_query(
        _two_person_daily_household(),
        "Who should do what today?",
        date="2026-09-02",
    )
    assert "Dishes" in result["answer"]


def test_answer_points_question_names_member_total():
    household = _two_person_daily_household()
    household["completions"] = [
        completion("c1", "m1", "2026-09-02", points=32),
        completion("c2", "m2", "2026-09-01", points=8),
    ]
    result = answer_query(household, "How many points does Emma have?", date="2026-09-02")
    assert "32" in result["answer"]
    assert "Emma" in result["answer"]
    assert "has done the most" not in result["answer"]
    assert "Dad" not in result["answer"]


def test_answer_finnish_inflected_name_still_finds_points():
    household = _two_person_daily_household()
    household["completions"] = [completion("c1", "m1", "2026-09-02", points=32)]
    result = answer_query(
        household,
        "Kuinka monta pistettä Emmalla on?",
        date="2026-09-02",
        locale="fi",
    )
    assert "32" in result["answer"]
    assert "Emma" in result["answer"]
    assert "eniten" not in result["answer"]
    assert "Dad" not in result["answer"]


def test_answer_what_should_person_do_mentions_upcoming_week_chore():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "vacuum",
                "title": "Vacuum",
                "icon": "🧹",
                "schedule": {"type": "once", "date": "2026-09-05"},
                "assignment": {"type": "rotation", "memberIds": ["m1"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "What should Emma do?", date="2026-09-02")
    assert "Emma" in result["answer"]
    assert "no assigned chores today" in result["answer"]
    assert "Vacuum" in result["answer"]
    assert "Saturday" in result["answer"]
    assert "Dad:" not in result["answer"]


def test_answer_what_should_person_do_empty_when_nothing_this_week():
    household = {
        "members": [member("m1", "Emma"), member("m2", "Dad")],
        "tasks": [
            {
                "id": "tidy",
                "title": "Tidy",
                "icon": "🧹",
                "schedule": {"type": "daily"},
                "assignment": {"type": "rotation", "memberIds": ["m2"]},
                "points": 10,
                "active": True,
            }
        ],
        "completions": [],
        "overrides": [],
    }
    result = answer_query(household, "What should Emma do?", date="2026-09-02")
    assert result["answer"] == "- Emma: no assigned chores today."
    assert "Tidy" not in result["answer"]
