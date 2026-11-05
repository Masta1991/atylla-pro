# Mapa kontekstu — Atylla

Wybierz tylko wiersz pasujący do zadania. Nie czytaj rutynowo historii i raportów.

| Zadanie | Dokumenty |
|---|---|
| Obsługa | README.md; docs/USAGE.md |
| Kontynuacja lub stan | docs/project/MODEL_HANDOFF.md |
| Zakres i architektura | docs/project/PROJECT.md |
| Rozwój i wymagania | docs/project/BACKLOG.md; odpowiednie docs/domain_notes/ |
| Decyzje | docs/project/DECISIONS.md |
| Testy | skills/atylla_test_harness/SKILL.md |
| Frontend | frontend/AGENTS.md; frontend/CONTEXT_MAP.md; docelowy moduł |
| Odbiór kotwic 2.1.3 | docs/audits/ANCHOR_READ_FIX_2026-09-15.md; ANCHOR_READ_CHECK_2026-09-15.json w tym samym folderze |
| Odbiór rozliczeń | docs/audits/ATOMIC_BILLING_FIXES_2026-09-14.md; docs/audits/MANUAL_TESTS_2.1.2.md |
| Wydanie i kopia | docs/project/MODEL_HANDOFF.md; docs/project/BACKUP_POLICY.md; właściwe docs/deployment/ |
| Historyczne porządki workspace 15.09 | docs/audits/atylla-pro-cleanup-20260915/; docs/audits/atylla-root-cleanup-20260915/; raporty dowodowe, nie procedura do ponownego uruchomienia |

Lokalny serwer nie oznacza lokalnej bazy ani odbioru produkcji.
Aktualny backup: backup/latest.zip.dpapi. Stara historia została wycofana poza
projekt; nie jest aktywną instrukcją. Nie przywracaj plików LOG, FILE_LAYOUT ani
deploy.ps1 do root przy zamykaniu sesji.

## Preferowane procedury

Wybierz procedurę dla konkretnego zadania; nie uruchamiaj całego zestawu.
Niedostępny skill nie jest dowodem wykonanej kontroli: zastosuj lokalną procedurę
i wskaż granice. Preferencja nie rozszerza uprawnień do danych ani wydania.

| Zadanie | Preferowany skill lub procedura | Warunek użycia |
|---|---|---|
| Regresja obliczeń lub przepływu aplikacji | `skills/atylla_test_harness/SKILL.md`; przy nieznanej przyczynie `C:/Projects/.agents/skills/debugging-and-error-recovery/SKILL.md` | Zmienione zachowanie, błąd lub niezgodność wyniku; konta i środowiska zgodnie z AGENTS |
| Układ i skalowanie frontendu | `C:/Users/MaciejStawski/.codex/skills/web-responsive-regression-qa/SKILL.md` | Zmiana CSS, typografii lub układu; najpierw lokalne instrukcje frontendu |
| Menu, formularz, modal i klawiatura | `C:/Users/MaciejStawski/.codex/skills/web-interaction-accessibility-qa/SKILL.md` | Zmiana interakcji, focusu albo stanów kontrolek |
| Archiwum iOS lub crash TestFlight | `C:/Users/MaciejStawski/.codex/skills/capacitor-ios-release-qa/SKILL.md` | Wyłącznie właściwy zakres Capacitor/iOS; potwierdź aktualny stos |
| Wydanie TestFlight | `C:/Users/MaciejStawski/.codex/skills/testflight-safe-deploy/SKILL.md` | Jawnie zlecone wydanie zgodnego projektu iOS; sam wpis nie autoryzuje publikacji |

Jeżeli żaden wiersz nie pasuje, dobierz procedurę z aktualnego katalogu hosta lub wspólnego indeksu. Możesz pracować bez skilla, gdy wystarcza lokalna instrukcja. Preferencje nie zastępują jawnego polecenia ani wymaganych kontroli.
