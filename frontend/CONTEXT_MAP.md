# Context Map - Expo HAS CHANGED

The existing AGENTS.md is concise and remains the complete active contract. Project context and rule meaning are unchanged; only context loading changed.

## Required core

- Read the complete concise AGENTS.md.

For a playbook section, read from the listed heading to the next heading of the same or higher level. Load all matching sections when a task spans areas.

## Task-specific playbook sections

- No separate playbook; select documents from the table below.

## Document routing

| Task type | Load |
|---|---|
| Small code or file question | AGENTS.md, the target file, and the matching playbook section |
| Continuation or status | MODEL_HANDOFF.md; PROJECT.md only for scope or architecture |
| Implementation | matching playbook sections, matching skill, implementation files, and tests |
| Architecture, data, cost, or cloud | PROJECT.md, memory/decisions.md, safety rules, and matching playbook sections |
| Deploy or release | release docs, matching release/QA skill, and current handoff |
| Session closeout | close-project-session; no LLM-WIKI sync |
| Explicit LLM-WIKI synchronization | sync-projects-to-llm-wiki |

## Context escalation

Start with the smallest package. Load more when facts are missing, rules conflict, risk is high, or areas depend on each other. Never skip a test or constraint merely to save tokens.
