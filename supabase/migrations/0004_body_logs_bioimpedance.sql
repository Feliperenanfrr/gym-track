-- Bioimpedância — composição corporal por pesagem
-- Colunas aditivas e NULLABLE em body_logs: a balança entrega vários campos
-- numa única pesagem (mesma cadência: 1 por dia, chaveada por user+date).
-- Registros antigos (só peso) e entradas manuais continuam válidos.
-- A balança já calcula IMC/metabolismo prontos, então só guardamos os valores
-- medidos — nada é recalculado aqui. Sexo/idade/altura são perfil, não medição.

alter table public.body_logs
  add column if not exists body_fat_pct       numeric,  -- Gordura corporal (%)
  add column if not exists fat_mass_kg        numeric,  -- Peso da gordura (kg)
  add column if not exists skeletal_muscle_kg numeric,  -- Peso massa muscular esquelética (kg)
  add column if not exists muscle_mass_kg     numeric,  -- Peso massa muscular total (kg)
  add column if not exists water_pct          numeric,  -- Água (%)
  add column if not exists visceral_fat       numeric,  -- Gordura visceral (índice)
  add column if not exists bmr_kcal           numeric,  -- Metabolismo basal (kcal/dia)
  add column if not exists bmi                numeric;  -- IMC
