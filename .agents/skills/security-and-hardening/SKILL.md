---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when auditing an input handler for vulnerabilities, when handling user input, authentication, data storage, or external integrations, or when checking a login flow is safe against the OWASP Top Ten. Use when building any feature that accepts untrusted data, manages user sessions, or interacts with third-party services. Use when auditing dependencies for known vulnerabilities, triaging package-manager audit findings, or assessing supply-chain risk in a new package. Use when personal data or privacy compliance (GDPR, CCPA) is involved.
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

### Bezpieczne dowody publicznych odpowiedzi HTTP

W helperach rozpoznania zapisuj wyłącznie potrzebne nagłówki odpowiedzi (np. Date, Content-Type, Cache-Control, ETag, Retry-After), nigdy całe `dict(response.headers)`. Publiczna strona bez logowania również może ustawić cookie sesyjne. Wyklucz Cookie/Set-Cookie, Authorization i dane śledzenia przed zapisem, wydrukiem lub przekazaniem delegatowi. Testuj allowlistę syntetycznymi wartościami offline; istniejące dowody redaguj bez drukowania usuwanych wartości, zachowując hashe niezmienionych treści i opis redakcji. Nie ponawiaj żądania tylko w celu poprawienia metadanych capture.

Pochodzenie i hashe: [PROVENANCE.json](PROVENANCE.json). Licencja: [LICENSE](LICENSE).

## Metody upstream (z lokalnie poprawionymi odsyłaczami)

# Security and Hardening


## Working core

Map trust boundaries and assets, then test concrete abuse cases. Parameterize queries, encode output, enforce resource authorization and protect sessions. Never commit or log secrets, trust client validation, expose internal errors, or send unvalidated model output to an executable sink. Apply controls for the surface being changed; before release use the native lockfile audit and review reachable critical/high findings. Existing authorization and the local contract govern upstream approval language.

## Conditional references

Read only the reference matching the current operation; do not load the whole set. Apply the local contract above to all upstream examples and checklists. Example tool names do not authorize installing or activating them.

- [For scope or design rationale](references/section-01.md).
- [When deciding applicability](references/section-02.md).
- [Before selecting security controls](references/section-03.md).
- [When deciding security requirements and authorization boundaries](references/section-04.md).
- [When selecting a hardening control](references/section-05.md).
- [For query construction, HTML rendering or resource authorization](references/section-06.md).
- [For credentials or session changes](references/section-07.md).
- [For response headers, origins or sensitive response fields](references/section-08.md).
- [For input schemas or upload handlers](references/section-09.md).
- [For any user-influenced server fetch URL](references/section-10.md).
- [Before deleting, moving or overwriting a derived path](references/section-11.md).
- [For rate limits or multi-instance throttling](references/section-12.md).
- [For secret handling or a suspected exposed secret](references/section-13.md).
- [Before dependency installation, upgrade or release audit](references/section-14.md).
- [For personal-data collection, sharing, retention or erasure](references/section-15.md).
- [For model input/output, tools or RAG boundaries](references/section-16.md).
- [For security sign-off on the affected surface](references/section-17.md).
- [When reviewing design tradeoffs or a proposed exception](references/section-18.md).
- [When reviewing changed code for risk indicators](references/section-19.md).
- [Before reporting completion, select checks for the changed surface](references/section-20.md).
