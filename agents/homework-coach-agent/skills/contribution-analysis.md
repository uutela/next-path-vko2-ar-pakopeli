---
name: contribution-analysis
description: Use when the family asks who has done the most chores or earned the most points.
tools: [load_household, analyze_contributions]
---

## Purpose
Rank household members by this week's completions and all-time points, celebrating effort without shaming anyone.

## When to Use
- "Who has done the most?"
- "Who is most active this week?"
- "Show the points leaderboard."

## Tools Required
- `load_household`: Read household JSON.
- `analyze_contributions`: Compute week/all-time stats and most-active ids.

## Example
```bash
python tools/analyze_contributions.py --household-json household.json --date 2026-09-02
```
