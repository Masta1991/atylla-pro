## Verification

After instrumenting a feature, confirm:

- [ ] The on-call questions for this feature are written down, and each signal maps to one
- [ ] All log output is structured (JSON), with stable event names and a correlation ID on every line
- [ ] Every log sink written by more than one entry point carries an entry-point field, set where the run starts and propagated with the correlation ID rather than inferred downstream
- [ ] No secrets, tokens, or unredacted PII in any log line (spot-check actual output)
- [ ] RED metrics exist for every new endpoint and every external dependency, with bounded label sets
- [ ] Latency is a histogram; p95/p99 are queryable
- [ ] A single request can be followed end-to-end in the tracing UI without broken spans
- [ ] Every new alert is symptom-based, has a runbook link, and was test-fired once
- [ ] An induced failure in staging was located via telemetry alone, without reading the source

For the at-a-glance version of this list, including the pre-launch instrumentation gate, see `observability-checklist.md`.
