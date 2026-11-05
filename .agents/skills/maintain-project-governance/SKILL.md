---
name: maintain-project-governance
description: Reconcile governance documentation after a material change to project structure, entrypoints, procedures, tools or skills. Use for documentation/routing upkeep; do not use for ordinary code edits, Wiki sync, cloud changes or publishing.
---

# Maintain project governance

Use this skill after a material change to how a project or workspace is used or
structured: a skill, tool, entrypoint, procedure, decision, or important route was
added, removed, renamed or changed. For a small edit with no documentation impact,
perform only a short impact check and do not load this skill in full.

## Workflow

1. Identify the changed area and its source of truth. Read only the affected
   `AGENTS.md`, `CONTEXT_MAP.md`, README, index, user-facing document or handoff;
   do not scan the whole workspace.
2. Check consumers and links. For the shared skill catalog, run the read-only
   checker:
   `python C:/Projects/.agents/skills/maintain-project-governance/scripts/check_skill_catalog.py`
   It compares directories containing `SKILL.md` with both active indexes and
   reports missing, dead or duplicated entries.
3. Update only documents whose meaning changed. Keep one active source of truth per
   fact: routing in `AGENTS.md`/`CONTEXT_MAP.md`, scope in README or PROJECT,
   procedure in a skill, current state in a handoff, and old evidence in history.
   Do not create placeholder READMEs merely to satisfy a convention.
   Put project-only reports in the project's documentation, shared workspace or
   agent-infrastructure reports in `.agents/reports`, and the current shared
   handoff in `.agents/MODEL_HANDOFF.md`.
4. Recheck paths, triggers, indexes and the affected catalog. Resolve every
   project-registry entry on disk (`isdir` plus its `AGENTS.md` and
   `CONTEXT_MAP.md`) and list directories present but unregistered: an agent or a
   Bot routes by that registry, so a dead path sends work into nothing or invites
   "repairing" phantom state. Run the workspace doctor and the registry check
   yourself at edit time — a `PASS` quoted from an earlier report is not evidence,
   because registries are edited and folders archived between sessions. Before
   rewriting a path, stat the folder `mtime` and its parent: a directory that
   vanished minutes ago is a move in progress (look for it in the archive or
   backup root), not a typo to overwrite. The doctor reads the registry, entry
   files and handoffs only: group index tables (`Development/README.md`,
   `Websites/README.md`) and prose pointers to checkpoints or plan files stay
   invisible to it, so check those against a directory listing by hand in the same
   pass. Run the relevant skill validator and synthetic
   checker tests. Distinguish verified results from expected model behavior.
5. After actual verification, report briefly in chat what was updated and the
   control result. If nothing needed changing, say so. This skill is an explicit
   upkeep procedure, not a daemon or guaranteed hook.

## Full-plan versus repair-scope tracking

Keep the canonical plan and evidence-linked acceptance authoritative. Select the applicable acceptance references below; a child gate, offline test or document update does not complete its parent or prove production behavior.

## Boundaries

- Work locally unless the user separately authorizes a broader scope.
- Do not synchronize LLM-WIKI or other cloud systems, publish, send mail, or alter
  product code as part of governance upkeep.
- Coordinate with `close-project-session` for handoff format and with
  `bootstrap-project` for project creation/repair; do not duplicate either.
- Preserve unrelated changes and create a recoverable checkpoint before material
  edits or removal.

## Expected chat confirmation

After verification, use a concise confirmation such as: “Zaktualizowano indeks,
mapę i routing dla nowego skilla; checker katalogu PASS, brak martwych lub
zdublowanych wpisów.”

When you propose a documentation sync, name the exact files and rows that change
and state plainly that it delivers no product progress. A doc sync that reads like
progress is the fastest way to lose this user's trust; a scoped file list plus one
sentence on what it unlocks is what gets approval.

## Conditional references

Read only the reference matching the current operation; do not load the whole set. Apply the local contract above to all upstream examples and checklists. Example tool names do not authorize installing or activating them.

- [Before adopting a newly supplied handoff as canonical](references/section-01.md).
- [For repair or pilot subplans within a full plan](references/section-02.md).
- [For complete deployment acceptance tracking](references/section-03.md).
- [For ordering a merged implementation plan](references/section-04.md).
- [For consolidating decisions or reducing release scope](references/section-05.md).
- [For accepting stages with limited real-source evidence](references/section-06.md).
- [For accepting a child gate and reconciling parent state](references/section-07.md).
- [For building final deterministic receipts](references/section-08.md).
- [For recovering an implementation missing its receipt](references/section-09.md).
- [For closing a session with a current handoff](references/section-10.md).
- [For adopting lighter functional acceptance](references/section-11.md).
- [For revising acceptance for repeatability over precision](references/section-12.md).
- [For distinguishing live adapters from snapshot imports](references/section-13.md).
- [For autonomous continuation, pause and resumption](references/section-14.md).
- [For independent work during a frozen live run](references/section-15.md).
- [For disambiguating reused defect labels](references/section-16.md).
- [For rechecking acceptance after code hash drift](references/section-17.md).
