---
name: daily-assignment-planning
description: Use when the family asks who should do which homework/chore and when.
tools: [load_household, plan_assignments]
---

## Purpose
Turn the household snapshot into a who/what/when plan for today and the current ISO week.

## When to Use
- "Who should do dishes today?"
- "Whose turn is it?"
- "What homework is due this week?"

## Tools Required
- `load_household`: Read household JSON from a file or stdin.
- `plan_assignments`: Build the day and week assignment plan.

## Example
```bash
python tools/load_household.py --path household.json
python tools/plan_assignments.py --household-json household.json --date 2026-09-02
```
