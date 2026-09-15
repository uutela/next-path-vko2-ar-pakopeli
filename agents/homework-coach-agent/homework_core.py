#!/usr/bin/env python3
"""Deterministic homework planning and contribution analysis.

Mirrors src/domain rotation, occurrences, and points rules so the Python
agent and the TypeScript app agree on who should do what.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

ROTATION_EPOCH = date(1970, 1, 1)

WEEKDAY_NAMES_EN = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
}

WEEKDAY_NAMES_FI = {
    1: "maanantai",
    2: "tiistai",
    3: "keskiviikko",
    4: "torstai",
    5: "perjantai",
    6: "lauantai",
    7: "sunnuntai",
}

CONTRIBUTION_PATTERNS = (
    r"\bmost\b",
    r"leaderboard",
    r"who has done",
    r"who did the most",
    r"most active",
    r"points",
    r"eniten",
    r"aktiivisin",
    r"pisteet",
    r"pistet",
    r"kuinka monta",
    r"kuka on tehnyt",
)

PLAN_PATTERNS = (
    r"who should",
    r"what should",
    r"what does",
    r"whose turn",
    r"today",
    r"assigned",
    r"homework",
    r"chore",
    r"when",
    r"kuka tekee",
    r"kenen vuoro",
    r"mitä .* (tekee|pitäisi)",
    r"pitäisi",
    r"tänään",
    r"tehtäv",
    r"kotiteht",
)

SPECIFIC_CHORE_PATTERNS = (
    r"who should do (?!what\b)(.+)",
    r"whose turn is (.+)",
    r"when is (.+)",
    r"kuka tekee (?!mitä\b)(.+)",
    r"kenen vuoro(?: on)? (.+)",
    r"milloin(?: on)? (.+)",
)

_TITLE_STOPWORDS = {"help", "the", "and", "for", "with", "task", "chore", "a", "an"}

# Finnish names for the English demo-board titles.
CHORE_ALIASES = {
    "tiskit": "dishes",
    "tiski": "dishes",
    "roskat": "trash",
    "imurointi": "vacuum",
    "pyykki": "laundry",
    "kierrätys": "recycling",
    "piha": "yard",
}


def parse_iso_date(value: str) -> date:
    """Parse a YYYY-MM-DD calendar date."""
    return date.fromisoformat(value[:10])


def iso_weekday(day: date) -> int:
    """ISO weekday: Monday=1 … Sunday=7 (matches date-fns getISODay)."""
    return day.isoweekday()


def iso_week_bounds(day: date) -> Tuple[date, date]:
    """Return Monday–Sunday of the ISO week containing day."""
    start = day - timedelta(days=iso_weekday(day) - 1)
    end = start + timedelta(days=6)
    return start, end


def occurs_on_date(task: Dict[str, Any], day: date) -> bool:
    """True when an active task fires on the given calendar date."""
    if not task.get("active", True):
        return False
    schedule = task.get("schedule") or {}
    kind = schedule.get("type")
    if kind == "daily":
        return True
    if kind == "weekdays":
        return iso_weekday(day) in (schedule.get("days") or [])
    if kind == "weekly":
        return iso_weekday(day) == schedule.get("day")
    if kind == "once":
        return schedule.get("date") == day.isoformat()
    return False


def count_occurrences_through_date(task: Dict[str, Any], day: date) -> int:
    """Count schedule-firing dates from 1970-01-01 through day inclusive."""
    if not occurs_on_date(task, day):
        return 0

    schedule = task.get("schedule") or {}
    kind = schedule.get("type")
    if kind == "daily":
        return (day - ROTATION_EPOCH).days + 1
    if kind == "once":
        return 1

    count = 0
    cursor = ROTATION_EPOCH
    while cursor <= day:
        if occurs_on_date(task, cursor):
            count += 1
        cursor += timedelta(days=1)
    return count


def get_occurrence_index(task: Dict[str, Any], day: date) -> Optional[int]:
    """Zero-based occurrence index, or None if the task does not fire."""
    if not occurs_on_date(task, day):
        return None
    return count_occurrences_through_date(task, day) - 1


def get_rotation_assignee(
    task: Dict[str, Any],
    date_str: str,
    overrides: Optional[Sequence[Dict[str, Any]]] = None,
) -> Optional[str]:
    """Return the member id responsible for a rotation task on a date."""
    assignment = task.get("assignment") or {}
    if assignment.get("type") != "rotation":
        return None

    day = parse_iso_date(date_str)
    if not occurs_on_date(task, day):
        return None

    for override in overrides or []:
        if override.get("taskId") == task.get("id") and override.get("date") == day.isoformat():
            return override.get("memberId")

    index = get_occurrence_index(task, day)
    if index is None:
        return None
    member_ids = assignment.get("memberIds") or []
    if not member_ids:
        return None
    return member_ids[index % len(member_ids)]


def _member_map(household: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {m["id"]: m for m in household.get("members") or [] if m.get("id")}


def _is_completed(household: Dict[str, Any], task_id: str, date_str: str) -> bool:
    for row in household.get("completions") or []:
        if row.get("taskId") == task_id and row.get("date") == date_str:
            return True
    return False


def _schedule_label(schedule: Dict[str, Any], locale: str) -> str:
    kind = schedule.get("type")
    names = WEEKDAY_NAMES_FI if locale == "fi" else WEEKDAY_NAMES_EN
    if kind == "daily":
        return "joka päivä" if locale == "fi" else "every day"
    if kind == "weekdays":
        days = [names.get(d, str(d)) for d in schedule.get("days") or []]
        return ", ".join(days)
    if kind == "weekly":
        day_name = names.get(schedule.get("day"), "")
        return f"joka {day_name}" if locale == "fi" else f"every {day_name}"
    if kind == "once":
        return schedule.get("date") or ""
    return kind or ""


def _task_item(
    task: Dict[str, Any],
    date_str: str,
    assignment_type: str,
    completed: bool,
    locale: str,
    member_id: Optional[str] = None,
) -> Dict[str, Any]:
    weekday = iso_weekday(parse_iso_date(date_str))
    names = WEEKDAY_NAMES_FI if locale == "fi" else WEEKDAY_NAMES_EN
    return {
        "task_id": task.get("id"),
        "title": task.get("title"),
        "icon": task.get("icon") or "",
        "date": date_str,
        "when": names.get(weekday, date_str),
        "schedule_label": _schedule_label(task.get("schedule") or {}, locale),
        "assignment_type": assignment_type,
        "completed": completed,
        "points": int(task.get("points") or 0),
        "member_id": member_id,
    }


def build_day_plan(
    household: Dict[str, Any],
    date_str: str,
    locale: str = "en",
) -> Dict[str, Any]:
    """Who should do what on a single calendar day."""
    day = parse_iso_date(date_str)
    members = list(household.get("members") or [])
    overrides = household.get("overrides") or []
    by_member: List[Dict[str, Any]] = []

    for person in members:
        tasks_for_member: List[Dict[str, Any]] = []
        for task in household.get("tasks") or []:
            assignment = task.get("assignment") or {}
            if assignment.get("type") != "rotation":
                continue
            if not occurs_on_date(task, day):
                continue
            assignee = get_rotation_assignee(task, date_str, overrides)
            if assignee != person.get("id"):
                continue
            tasks_for_member.append(
                _task_item(
                    task,
                    date_str,
                    "rotation",
                    _is_completed(household, task.get("id"), date_str),
                    locale,
                    member_id=person.get("id"),
                )
            )
        by_member.append(
            {
                "member_id": person.get("id"),
                "member_name": person.get("name"),
                "color": person.get("color"),
                "tasks": tasks_for_member,
            }
        )

    open_pool: List[Dict[str, Any]] = []
    for task in household.get("tasks") or []:
        assignment = task.get("assignment") or {}
        if assignment.get("type") != "pool":
            continue
        if not occurs_on_date(task, day):
            continue
        if _is_completed(household, task.get("id"), date_str):
            continue
        open_pool.append(_task_item(task, date_str, "pool", False, locale))

    return {
        "date": date_str,
        "weekday": (WEEKDAY_NAMES_FI if locale == "fi" else WEEKDAY_NAMES_EN)[iso_weekday(day)],
        "by_member": by_member,
        "open_pool": open_pool,
    }


def build_week_plan(
    household: Dict[str, Any],
    date_str: str,
    locale: str = "en",
) -> Dict[str, Any]:
    """Assignments for each day of the ISO week containing date_str."""
    start, end = iso_week_bounds(parse_iso_date(date_str))
    days: List[Dict[str, Any]] = []
    cursor = start
    while cursor <= end:
        days.append(build_day_plan(household, cursor.isoformat(), locale))
        cursor += timedelta(days=1)
    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "days": days,
    }


def _in_iso_week(date_str: str, reference: date) -> bool:
    start, end = iso_week_bounds(reference)
    day = parse_iso_date(date_str)
    return start <= day <= end


def analyze_contributions(household: Dict[str, Any], date_str: str) -> Dict[str, Any]:
    """Who has completed the most chores this ISO week, plus point totals."""
    reference = parse_iso_date(date_str)
    start, end = iso_week_bounds(reference)
    members: List[Dict[str, Any]] = []

    for person in household.get("members") or []:
        member_id = person.get("id")
        week_rows = [
            c
            for c in household.get("completions") or []
            if c.get("memberId") == member_id and _in_iso_week(c.get("date", ""), reference)
        ]
        all_rows = [c for c in household.get("completions") or [] if c.get("memberId") == member_id]
        week_spent = sum(
            int(r.get("pointsSpent") or 0)
            for r in household.get("redemptions") or []
            if r.get("memberId") == member_id and _in_iso_week(r.get("date", ""), reference)
        )
        all_spent = sum(
            int(r.get("pointsSpent") or 0)
            for r in household.get("redemptions") or []
            if r.get("memberId") == member_id
        )
        week_earned = sum(int(c.get("points") or 0) for c in week_rows)
        all_earned = sum(int(c.get("points") or 0) for c in all_rows)
        members.append(
            {
                "member_id": member_id,
                "member_name": person.get("name"),
                "color": person.get("color"),
                "week_completions": len(week_rows),
                "week_points": week_earned - week_spent,
                "all_time_completions": len(all_rows),
                "all_time_points": all_earned - all_spent,
            }
        )

    if not members:
        most_active_ids: List[str] = []
    else:
        max_count = max(row["week_completions"] for row in members)
        most_active_ids = (
            [row["member_id"] for row in members if row["week_completions"] == max_count]
            if max_count > 0
            else []
        )

    most_active_names = [
        row["member_name"] for row in members if row["member_id"] in most_active_ids
    ]
    return {
        "reference_date": date_str,
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "members": members,
        "most_active_ids": most_active_ids,
        "most_active_names": most_active_names,
    }


def classify_intent(query: str) -> str:
    """Classify a family question as plan, contributions, or both."""
    text = (query or "").strip().lower()
    if not text:
        return "both"

    has_contrib = any(re.search(pattern, text) for pattern in CONTRIBUTION_PATTERNS)
    has_plan = any(re.search(pattern, text) for pattern in PLAN_PATTERNS)

    if has_contrib and not has_plan:
        return "contributions"
    if has_plan and not has_contrib:
        return "plan"
    if has_contrib and has_plan:
        return "both"
    return "plan"


def _format_member_tasks(row: Dict[str, Any], locale: str) -> str:
    if not row.get("tasks"):
        return ""
    parts = []
    for task in row["tasks"]:
        status = (
            ("tehty" if locale == "fi" else "done")
            if task.get("completed")
            else ("vielä auki" if locale == "fi" else "not done yet")
        )
        parts.append(f"{task.get('icon', '')} {task.get('title')} ({task.get('when')}, {status})".strip())
    joined = "; ".join(parts)
    return f"- {row.get('member_name')}: {joined}"


def _title_keywords(title: str) -> List[str]:
    """Significant words from a chore title, e.g. 'Yard' from 'Yard / outdoor'."""
    parts = re.split(r"[\s/,-]+", title.lower())
    return [part for part in parts if len(part) >= 3 and part not in _TITLE_STOPWORDS]


def mentioned_task_titles(query: str, household: Dict[str, Any]) -> List[str]:
    """Return task titles that appear in the family's question."""
    text = (query or "").lower()
    titles: List[str] = []
    for task in household.get("tasks") or []:
        title = str(task.get("title") or "").strip()
        if not title or title in titles:
            continue
        lowered = title.lower()
        if len(title) >= 3 and lowered in text:
            titles.append(title)
            continue
        if any(re.search(rf"\b{re.escape(word)}\b", text) for word in _title_keywords(title)):
            titles.append(title)
            continue
        if any(
            re.search(rf"\b{re.escape(alias)}\b", text) and canonical in lowered
            for alias, canonical in CHORE_ALIASES.items()
        ):
            titles.append(title)
    return titles


def mentioned_member_names(query: str, household: Dict[str, Any]) -> List[str]:
    """Return family member names that appear as whole words in the question."""
    text = (query or "").lower()
    names: List[str] = []
    for person in household.get("members") or []:
        name = str(person.get("name") or "").strip()
        if len(name) < 2 or name in names:
            continue
        if re.search(rf"\b{re.escape(name.lower())}[a-zäöå]*\b", text):
            names.append(name)
    return names


def guessed_chore_phrase(query: str) -> Optional[str]:
    """Extract a named chore from 'who should do X' questions."""
    text = (query or "").strip().lower()
    for pattern in SPECIFIC_CHORE_PATTERNS:
        match = re.search(pattern, text)
        if not match:
            continue
        phrase = match.group(1).strip()
        phrase = re.split(r"\s+and\b|\s+ja\b", phrase, maxsplit=1)[0]
        phrase = re.sub(r"[\s?!.]+$", "", phrase)
        phrase = re.sub(r"\s+(today|tänään)$", "", phrase).strip()
        if phrase and phrase not in {"what", "mitä"}:
            return phrase
    return None


def _task_status_label(completed: bool, locale: str) -> str:
    if completed:
        return "tehty" if locale == "fi" else "done"
    return "vielä auki" if locale == "fi" else "not done yet"


def _focused_task_lines(plan: Dict[str, Any], titles: List[str], locale: str) -> List[str]:
    """Answer only about chores named in the question."""
    wanted = {title.lower() for title in titles}
    lines: List[str] = []
    for row in plan.get("by_member") or []:
        for task in row.get("tasks") or []:
            if (task.get("title") or "").lower() not in wanted:
                continue
            status = _task_status_label(bool(task.get("completed")), locale)
            name = row.get("member_name")
            if locale == "fi":
                lines.append(
                    f"{task.get('title')} on tänään vuorossa: {name} "
                    f"({task.get('when')}, {status})."
                )
            else:
                lines.append(
                    f"{task.get('title')} is {name}'s job today "
                    f"({task.get('when')}, {status})."
                )
    for task in plan.get("open_pool") or []:
        if (task.get("title") or "").lower() not in wanted:
            continue
        if locale == "fi":
            lines.append(
                f"{task.get('title')} on avoin tehtävä — kuka tahansa voi tehdä sen tänään."
            )
        else:
            lines.append(f"{task.get('title')} is open — anyone can do it today.")
    return lines


def _assignee_name_for_titles(day: Dict[str, Any], titles: List[str]) -> Optional[str]:
    """Named person for titles on a day plan, or None when it is a pool chore."""
    wanted = {title.lower() for title in titles}
    for row in day.get("by_member") or []:
        for task in row.get("tasks") or []:
            if (task.get("title") or "").lower() in wanted:
                name = str(row.get("member_name") or "").strip()
                return name or None
    return None


def _week_occurrence_for_titles(
    week_plan: Dict[str, Any],
    titles: List[str],
    locale: str,
    today: str,
) -> Optional[Tuple[str, bool, Optional[str]]]:
    """Return (weekday, upcoming, assignee) for a named task this ISO week.

    Prefer the next remaining day after today; otherwise the most recent past day.
    Assignee is None for open-pool chores.
    """
    upcoming: Optional[Tuple[str, Optional[str]]] = None
    past: Optional[Tuple[str, Optional[str]]] = None
    for day in week_plan.get("days") or []:
        if not _focused_task_lines(day, titles, locale):
            continue
        day_date = str(day.get("date") or "")
        label = str(day.get("weekday") or day_date)
        who = _assignee_name_for_titles(day, titles)
        if day_date > today:
            if upcoming is None:
                upcoming = (label, who)
        elif day_date < today:
            past = (label, who)
    if upcoming:
        return upcoming[0], True, upcoming[1]
    if past:
        return past[0], False, past[1]
    return None


def _upcoming_member_chores(
    week_plan: Dict[str, Any],
    member_name: str,
    today: str,
) -> List[str]:
    """Chore bits for this person on later days this ISO week."""
    wanted = member_name.lower()
    bits: List[str] = []
    for day in week_plan.get("days") or []:
        if str(day.get("date") or "") <= today:
            continue
        weekday = day.get("weekday") or day.get("date")
        for row in day.get("by_member") or []:
            if str(row.get("member_name") or "").lower() != wanted:
                continue
            for task in row.get("tasks") or []:
                bits.append(
                    f"{task.get('icon', '')} {task.get('title')} ({weekday})".strip()
                )
    return bits


def _focused_member_lines(
    plan: Dict[str, Any],
    names: List[str],
    locale: str,
    week_plan: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Answer only about people named in the question."""
    wanted = {name.lower() for name in names}
    today = str(plan.get("date") or "")
    lines: List[str] = []
    for row in plan.get("by_member") or []:
        member_name = str(row.get("member_name") or "")
        if member_name.lower() not in wanted:
            continue
        formatted = _format_member_tasks(row, locale)
        if formatted:
            lines.append(formatted)
            continue
        empty = (
            f"- {member_name}: ei nimettyjä tehtäviä tänään."
            if locale == "fi"
            else f"- {member_name}: no assigned chores today."
        )
        upcoming = _upcoming_member_chores(week_plan or {}, member_name, today)
        if upcoming:
            nxt = "Seuraavana" if locale == "fi" else "Next"
            lines.append(f"{empty} {nxt}: {'; '.join(upcoming)}.")
        else:
            lines.append(empty)
    return lines


def _focused_points_lines(
    contributions: Dict[str, Any], names: List[str], locale: str
) -> List[str]:
    """Answer only about named people's point totals."""
    wanted = {name.lower() for name in names}
    lines: List[str] = []
    for row in contributions.get("members") or []:
        member_name = str(row.get("member_name") or "")
        if member_name.lower() not in wanted:
            continue
        pts = int(row.get("all_time_points") or 0)
        week = int(row.get("week_points") or 0)
        if locale == "fi":
            lines.append(f"{member_name}: {pts} pistettä ({week} tällä viikolla).")
        else:
            lines.append(f"{member_name} has {pts} points ({week} this week).")
    return lines


def render_answer(
    query: str,
    plan: Dict[str, Any],
    week_plan: Dict[str, Any],
    contributions: Dict[str, Any],
    intent: str,
    locale: str = "en",
    mentioned_titles: Optional[List[str]] = None,
    mentioned_members: Optional[List[str]] = None,
) -> str:
    """Family-friendly answer from structured facts (no LLM required)."""
    if not (plan.get("by_member") or plan.get("open_pool")) and not contributions.get("members"):
        if locale == "fi":
            return "Lisää ensin perheenjäsenet ja tehtävät Asetukset-näkymässä (Setup)."
        return "Add family members and tasks in Setup first."

    mentioned = mentioned_titles or []
    focused = _focused_task_lines(plan, mentioned, locale)
    if mentioned and not focused and intent in {"plan", "both"}:
        names = ", ".join(mentioned)
        match = _week_occurrence_for_titles(
            week_plan, mentioned, locale, str(plan.get("date") or "")
        )
        if match:
            weekday, upcoming, who = match
            who_bit = f" ({who})" if who else ""
            if upcoming:
                if locale == "fi":
                    pool = "" if who else " Kuka tahansa voi tehdä sen."
                    return f"{names} ei ole tänään, mutta se on vuorossa {weekday}na{who_bit}.{pool}".rstrip(".") + "."
                if who:
                    return (
                        f"{names} is not scheduled today. "
                        f"It's {who}'s job on {weekday} this week."
                    )
                return (
                    f"{names} is not scheduled today. "
                    f"It's on {weekday} this week. Anyone can do it."
                )
            if locale == "fi":
                pool = "" if who else " Kuka tahansa voi tehdä sen."
                return f"{names} ei ole tänään. Se oli vuorossa {weekday}na{who_bit}.{pool}".rstrip(".") + "."
            if who:
                return (
                    f"{names} is not scheduled today. "
                    f"It was {who}'s job on {weekday} this week."
                )
            return (
                f"{names} is not scheduled today. "
                f"It was on {weekday} this week. Anyone can do it."
            )
        if locale == "fi":
            return f"{names} ei ole aikataulussa tänään."
        return f"{names} is not scheduled today."

    if focused and intent in {"plan", "both"}:
        extra = []
        if intent == "both":
            names = contributions.get("most_active_names") or []
            if names:
                joined = " & ".join(names)
                extra.append(
                    f"Tällä viikolla {joined} on tehnyt eniten."
                    if locale == "fi"
                    else f"This week {joined} has done the most."
                )
        return "\n".join(focused + extra)

    people = mentioned_members or []
    member_lines = _focused_member_lines(plan, people, locale, week_plan)
    if people and member_lines and intent in {"plan", "both"}:
        extra = []
        if intent == "both":
            top = contributions.get("most_active_names") or []
            if top:
                joined = " & ".join(top)
                extra.append(
                    f"Tällä viikolla {joined} on tehnyt eniten."
                    if locale == "fi"
                    else f"This week {joined} has done the most."
                )
        return "\n".join(member_lines + extra)

    guess = guessed_chore_phrase(query)
    if guess and not mentioned and not people and intent in {"plan", "both"}:
        if locale == "fi":
            return f'En löydä tehtävää nimeltä "{guess}" taululta.'
        return f'I don\'t see a chore called "{guess}" on the board.'

    if intent == "contributions" and people:
        point_lines = _focused_points_lines(contributions, people, locale)
        if point_lines:
            return "\n".join(point_lines)

    lines: List[str] = []
    names: List[str] = []

    if intent in {"plan", "both"}:
        weekday = plan.get("weekday", plan.get("date"))
        if locale == "fi":
            lines.append(f"Kuka tekee mitä {weekday}na {plan.get('date')}:")
        else:
            lines.append(f"Here's who should do what on {weekday}, {plan.get('date')}:")
        for row in plan.get("by_member") or []:
            line = _format_member_tasks(row, locale)
            if line:
                lines.append(line)
        if not any(row.get("tasks") for row in plan.get("by_member") or []):
            lines.append("  " + ("Ei vuorotehtäviä tälle päivälle." if locale == "fi" else "No rotation chores today."))
        pool = plan.get("open_pool") or []
        if pool:
            titles = ", ".join(f"{item.get('icon', '')} {item.get('title')}".strip() for item in pool)
            if locale == "fi":
                lines.append(f"- Kuka tahansa: {titles}")
            else:
                lines.append(f"- Anyone: {titles}")

    if intent in {"contributions", "both"}:
        names = contributions.get("most_active_names") or []
        ranking = ", ".join(
            f"{row.get('member_name')} {row.get('week_completions')}"
            for row in contributions.get("members") or []
        )
        if names:
            joined = " & ".join(names)
            if locale == "fi":
                lines.append(f"Tällä viikolla {joined} on tehnyt eniten. {ranking}.")
            else:
                lines.append(f"This week {joined} has done the most. {ranking}.")
        elif contributions.get("members"):
            if locale == "fi":
                lines.append("Tällä viikolla kukaan ei ole vielä merkinnyt tehtäviä tehdyiksi.")
            else:
                lines.append("Nobody has completed chores yet this week.")

    text = "\n".join(lines).strip()
    if query and intent == "contributions" and names:
        return text
    return text or ("En osaa vastata siihen vielä." if locale == "fi" else "I could not answer that yet.")


def answer_query(
    household: Dict[str, Any],
    query: str,
    date: Optional[str] = None,
    locale: str = "en",
) -> Dict[str, Any]:
    """Full coach response: intent, plan, week, contributions, and prose."""
    date_str = date or date_today()
    locale_norm = "fi" if locale == "fi" else "en"
    intent = classify_intent(query)
    plan = build_day_plan(household, date_str, locale_norm)
    week_plan = build_week_plan(household, date_str, locale_norm)
    contributions = analyze_contributions(household, date_str)
    answer = render_answer(
        query,
        plan,
        week_plan,
        contributions,
        intent,
        locale_norm,
        mentioned_titles=mentioned_task_titles(query, household),
        mentioned_members=mentioned_member_names(query, household),
    )
    return {
        "status": "success",
        "intent": intent,
        "query": query,
        "locale": locale_norm,
        "answer": answer,
        "plan": plan,
        "week_plan": week_plan,
        "contributions": contributions,
    }


def date_today() -> str:
    """Local calendar date as YYYY-MM-DD."""
    return date.today().isoformat()


def iter_member_names(household: Dict[str, Any]) -> Iterable[str]:
    """Yield display names for grounding checks."""
    for person in household.get("members") or []:
        name = person.get("name")
        if name:
            yield str(name)
