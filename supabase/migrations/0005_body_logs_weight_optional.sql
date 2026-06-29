-- Peso opcional em body_logs
-- Antes: weight_kg era NOT NULL (toda linha exigia peso). Agora medimos por
-- instrumento — cintura (fita) e peso (balança) entram em cadências diferentes
-- e podem ser registrados sozinhos. O merge por (user_id, date) junta tudo no
-- mesmo dia. A app garante que ao menos uma medida seja informada.

alter table public.body_logs
  alter column weight_kg drop not null;
