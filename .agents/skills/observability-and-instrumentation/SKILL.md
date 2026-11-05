---
name: observability-and-instrumentation
description: Add or improve logs, metrics and tracing when requested or when missing evidence prevents diagnosis of a concrete application problem. Use existing local instrumentation; not a mandatory step for every feature or a service-installation workflow.
---

## Kontrakt lokalny C:/Projects — pierwszeństwo nad metodami upstream

Stosuj wspólny router `C:/Projects/.agents/AGENTS.md`, instrukcje projektu i bieżący
zakres użytkownika. Poniższe metody są pomocą dla dopasowanego zadania, nie nowym
obowiązkowym cyklem pracy. Uwzględniaj już udzielone zgody; upstream „ask first”
nie wymaga ich ponowienia dla tego samego zakresu. Nowe publikacje, przesyłanie
danych, chmura, koszty i destrukcyjne operacje wymagają właściwego upoważnienia.

Dobierz testy do zmiany i ryzyka; nie rozszerzaj automatycznie małego zadania do
pełnego audytu. Wymóg „commit” oznacza zachowanie spójnej zmiany i dokumentacji;
skill nie nakazuje commita ani publikacji. Nie wprowadzaj nowego stosu narzędzi,
usług telemetrycznych, eksporterów ani chmury przez samo użycie przykładu.
Zachowuj istniejące kontrakty walidacji: dane wewnętrzne/baza nie są z definicji
zaufane, a typ statyczny nie zastępuje wymaganej kontroli runtime. `git bisect`
wykonuj tylko w izolowanym checkoutcie/worktree, zachowując zmiany użytkownika.
Nie uruchamiaj ani nie instaluj brakujących skilli wspomnianych przez upstream;
stosuj istniejące procedury projektu. Lokalny skill specjalistyczny ma pierwszeństwo
w swojej dziedzinie (np. płatności lub lokalność danych).

Pochodzenie i hashe: [PROVENANCE.json](PROVENANCE.json). Licencja: [LICENSE](LICENSE).

## Metody upstream (z lokalnie poprawionymi odsyłaczami)

# Observability and Instrumentation

## Process


## Working core

Start with the concrete diagnostic questions and use existing instrumentation. Choose logs for individual events, metrics for frequency/latency, traces for cross-service time. Use structured stable events, propagate correlation IDs and the originating entry point, allowlist fields and exclude secrets/PII. Bound metric labels and use latency histograms. Alerts must describe actionable user symptoms and link to a runbook. Exercise changed paths and inspect actual output; report untested external delivery separately.

## Conditional references

Read only the reference matching the current operation; do not load the whole set. Apply the local contract above to all upstream examples and checklists. Example tool names do not authorize installing or activating them.

- [For scope or design rationale](references/section-01.md).
- [When deciding applicability](references/section-02.md).
- [When defining diagnostic questions](references/section-03.md).
- [When selecting logs, metrics or traces](references/section-04.md).
- [For log schemas, correlation and entry-point attribution](references/section-05.md).
- [For RED/USE metrics, histogram buckets or cardinality](references/section-06.md).
- [For trace setup, sampling or async context propagation](references/section-07.md).
- [For alerts and their runbooks](references/section-08.md).
- [Before claiming instrumentation works](references/section-09.md).
- [When reviewing design tradeoffs or a proposed exception](references/section-10.md).
- [When reviewing changed code for risk indicators](references/section-11.md).
- [Before reporting completion, select checks for the changed surface](references/section-12.md).
