# Rejestr Decyzji Architektonicznych — Atylla Pro

## DEC-ATYLLA-001: Wybór Architektury Backendowej FastAPI + Supabase
- **Status**: Zatwierdzona
- **Data**: 2026-05-10
- **Kontekst**: Aplikacja wymagała szybkiego, asynchronicznego API z silną walidacją typów oraz relacyjnej bazy danych PostgreSQL.
- **Decyzja**: Zastosowanie FastAPI (Python 3.12, Pydantic v2) jako warstwy API oraz Supabase PostgreSQL jako zarządzanej bazy danych.
- **Konsekwencje**: Wysoka wydajność, łatwość pisania testów jednostkowych, bezpieczeństwo relacji w bazie.

## DEC-ATYLLA-002: Standaryzacja Systemu Zarządzania i Testowania (Wzorzec Jarvis)
- **Status**: Zatwierdzona
- **Data**: 2026-08-09
- **Kontekst**: Wymóg ujednolicenia standardów zarządzania projektami, wyeliminowania konieczności manualnego testowania i wdrożenia autonomicznego QA skilla.
- **Decyzja**: Wdrożenie pełnego zestawu governance (AGENTS.md, PROJECT.md, implementation_plan.md, MODEL_HANDOFF.md, LOG.md) oraz dedykowanego skilla testowego `skills/atylla_test_harness/`.
