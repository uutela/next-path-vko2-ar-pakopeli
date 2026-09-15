---
name: coaching-answers
description: Use when the family asks a free-text question that needs a spoken-style answer.
tools: [ask_coach]
---

## Purpose
Classify the question, run planning and contribution analysis, and return a short family-friendly answer plus structured cards.

## When to Use
- Any mixed or unclear question about chores.
- The family-app Coach chat box.

## Tools Required
- `ask_coach`: Full query → intent + plan + contributions + answer.

## Example
```bash
python tools/ask_coach.py --household-json household.json --query "Who should do what today?" --locale en
```
