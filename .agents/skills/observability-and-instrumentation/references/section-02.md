## When to Use

- A concrete feature needs diagnostic evidence that existing instrumentation cannot provide
- A service, endpoint, job, or integration needs specific logs, metrics, or traces
- A production incident took too long to diagnose ("we couldn't tell what happened")
- Setting up or reviewing alerting rules
- Reviewing missing or misleading instrumentation around I/O, retries, queues, or cross-service calls

**NOT for:**
- Diagnosing a failure happening right now — use the `debugging-and-error-recovery` skill (observability is what makes that skill fast next time)
- Profiling and optimizing measured slowness — use the `performance-optimization` skill
- Launch-day monitoring checklists and rollback triggers — see the `shipping-and-launch` skill; this skill covers the instrumentation that feeds them

