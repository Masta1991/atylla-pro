## Adopting a handoff the user hands you

When the user writes a new handoff and declares it current, verify it before it
becomes the source of truth:

1. Re-derive its headline facts from the artifacts it names: recompute the receipt
   hash, read `status`, creation time, file and check counts, and cross-check any
   wheel/module hash against the packaging manifest and the diff manifest's file
   list. Where the handoff and the artifact disagree, keep the artifact's value and
   report the disagreement instead of adopting the prose.
2. Checkpoint the files you are about to edit (`Backups/<project>/<purpose>-<ts>`)
   and print their hashes before touching them.
3. Change only facts whose meaning changed: the `CONTEXT_MAP.md` current-status
   row, the affected register rows, the plan's status paragraph, and the handoff's
   next step. Mark a superseded canonical handoff historical from its own top;
   where a full replacement was previously refused, a dated pointer preserves the
   refusal and still leaves exactly one true route.
4. Re-verify: every path you cited exists, grep for the stale sentences you
   replaced, run the workspace doctor, and report the result.

