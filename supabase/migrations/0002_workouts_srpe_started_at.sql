-- Fase 3 — Registro enriquecido
-- sRPE (escala de Foster 1–10, 1 tap pós-treino) e início real da sessão
-- (primeira série marcada) para calcular duration_min de verdade.

alter table public.workouts
  add column if not exists srpe smallint check (srpe between 1 and 10);

alter table public.workouts
  add column if not exists started_at timestamptz;
