---
name: api-and-interface-design
description: Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface. Use when creating REST or GraphQL endpoints, defining type contracts between modules, or establishing boundaries between frontend and backend.
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

### Semantyka zewnętrznych kart i identyfikatorów

- Waliduj dosłowny identyfikator URL przed `urlsplit`: parser może usunąć wiodące spacje i znaki sterujące. Odrzuć wadliwy token, nie uznawaj poprawnego wyniku parsowania za dowód poprawności oryginału. Testuj także związanie ID z docelowym linkiem tej samej pozycji.
- Ustal znaczenie dat z dokumentacji operatora, nie z nazwy pola. `pubDate` może oznaczać ostatnią aktualizację; zachowaj wartość surową, ale nie przedstawiaj jej jako potwierdzonej publikacji. Odróżnij jawne wygaśnięcie od filtra wieku i od brakującej daty.
- W odbiorze paginacji stosuj rzeczywisty kontrakt danego endpointu: szacowany licznik lub krótka strona nie dowodzą końca. Nie myl strony bieżących odpowiedzi z kompletnym spisem rynku; nie rozszerzaj nieobsługiwanego miasta na kraj bez jawnego ustalenia zakresu.

Pochodzenie i hashe: [PROVENANCE.json](PROVENANCE.json). Licencja: [LICENSE](LICENSE).

## Metody upstream (z lokalnie poprawionymi odsyłaczami)

# API and Interface Design

## Core Principles


## Working core

Define typed input/output and consistent errors before implementation. Validate untrusted and persisted data at runtime at trust boundaries. Prefer additive compatible changes; treat observable behavior as a consumer contract. Paginate lists. For state changes, implement real idempotency or explicitly document unsafe retries. Verify affected consumers and report the boundary actually tested.

## Conditional references

Read only the reference matching the current operation; do not load the whole set. Apply the local contract above to all upstream examples and checklists. Example tool names do not authorize installing or activating them.

- [For scope or design rationale](references/section-01.md).
- [When deciding applicability](references/section-02.md).
- [When assessing compatibility of observable behavior](references/section-03.md).
- [When considering parallel API/dependency versions](references/section-04.md).
- [When specifying input/output contracts](references/section-05.md).
- [When designing error responses](references/section-06.md).
- [When data enters or re-enters a trust boundary](references/section-07.md).
- [When extending contracts or changing execution modes across entrypoints](references/section-08.md).
- [When choosing public field or endpoint names](references/section-09.md).
- [Before implementing retries or state-changing idempotency](references/section-10.md).
- [When implementing REST resources, pagination, filters or PATCH](references/section-11.md).
- [When defining TypeScript variants, IDs or input/output types](references/section-12.md).
- [When reviewing design tradeoffs or a proposed exception](references/section-13.md).
- [When reviewing changed code for risk indicators](references/section-14.md).
- [Before reporting completion, select checks for the changed surface](references/section-15.md).
