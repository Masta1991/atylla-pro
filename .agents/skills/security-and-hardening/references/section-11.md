### Destructive operations on derived paths

A delete, move, or overwrite is only as safe as the value naming its target, and trust follows who *wrote* that value, not which channel delivered it: another process's command line is as attacker-controlled as a form field. A shape check proves well-formedness, not authorization. Before the call, require all three: the resolved target (symlinks resolved) sits under an **allowlisted root**; it is at least one level **below** that root; and it carries **ownership evidence read before the operation**. On refusal, log the rejected target and stop; never fall back to a broader default path.

Why the check is weaker than it reads (marker self-attestation, check/use races): [Destructive paths](hardening-patterns.md#destructive-operations-on-derived-paths). Worked code: `security-checklist.md`.

