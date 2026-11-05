---
name: performance-optimization
description: Optimizes application performance across frontend, backend, queries, and databases. Use when performance requirements exist, when you suspect performance regressions, when Core Web Vitals or load times need improvement, when N+1 query patterns need fixing, or when profiling reveals bottlenecks.
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

# Performance Optimization


## Working core

Establish a representative baseline, identify one measured bottleneck, change one thing, and remeasure under the same conditions and budget. Keep only gains exceeding variance with correctness tests green; revert neutral or harmful experiments and record every attempt. Guard the actual user-facing metric. Synthetic results do not prove real-user improvement; use available field evidence without installing new services merely because an example names them.

## Conditional references

Read only the reference matching the current operation; do not load the whole set. Apply the local contract above to all upstream examples and checklists. Example tool names do not authorize installing or activating them.

- [For scope or design rationale](references/section-01.md).
- [When deciding applicability](references/section-02.md).
- [When measuring browser user-experience metrics](references/section-03.md).
- [When planning a performance experiment](references/section-04.md).
- [When establishing frontend/backend measurement](references/section-05.md).
- [When choosing the first measurement from a symptom](references/section-06.md).
- [When interpreting profiling evidence](references/section-07.md).
- [After a measured frontend/backend bottleneck is identified](references/section-08.md).
- [Before keeping any performance change](references/section-09.md).
- [When adding a guard for the measured metric](references/section-10.md).
- [For detailed performance checks and commands](references/section-11.md).
- [When reviewing design tradeoffs or a proposed exception](references/section-12.md).
- [When reviewing changed code for risk indicators](references/section-13.md).
- [Before reporting completion, select checks for the changed surface](references/section-14.md).
