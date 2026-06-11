# GYM//TRACK — Plano de Implementação: Ciclo, Inteligência de Treino e Hidratação

Plano de execução das features levantadas na consultoria de preparação física + registro de água.
Organizado em fases, cada uma virando **um PR independente e mergeável**, em ordem de valor ÷ esforço.

**Esforço:** 🟢 pequeno (≤ meio dia) · 🟡 médio (1–2 dias) · 🔴 grande (3+ dias)

---

## Princípios (valem para todas as fases)

1. **Aderência > riqueza de dado.** Na academia, no máximo peso + reps + RIR por série. Todo o resto é 1 tap fora do treino. Se um input custar mais que 2 toques, corta.
2. **Derivar > persistir.** Tudo que dá para calcular do histórico (ciclo, PRs, ACWR, conquistas) NÃO ganha tabela. Só persiste o que é fato novo (água, sRPE, RIR, check-in).
3. **JSONB primeiro.** `entries` e `cardio` são JSONB — campos novos por série/cardio entram sem migration. Colunas novas só para o que precisa de query/índice.
4. **Offline-first como o resto.** Toda gravação nova segue o padrão do `lib/store.ts`: otimista na tela → upsert → fila (`lib/sync-queue.ts`) se a rede falhar. Tabelas novas entram no union de `PendingMutation.table`.
5. **Compatibilidade retroativa.** Campos novos sempre opcionais; histórico antigo sem RIR/sRPE continua válido em todos os cálculos (fallbacks explícitos).

---

## Visão geral das fases

| Fase | Entrega | Esforço | Depende de |
|------|---------|---------|------------|
| 1 ✅ | 💧 Hidratação diária | 🟢 | — |
| 2 ✅ | 🔄 Ciclo rotativo de treinos + janelas móveis de 7 dias | 🟡 | — |
| 3 ✅ | ✍️ Registro enriquecido: RIR por série, sRPE, duração real | 🟡 | — |
| 4 | 📊 Análises de treino: séries/grupo c/ faixa-alvo, força relativa, push:pull, ACWR interno | 🟡 | 3 (p/ ACWR interno) |
| 5 | ⚖️ Recomposição: média móvel do peso, taxa semanal vs alvo, %BF (pescoço) | 🟡 | — |
| 6 | 🫀 Z2 com output: km/watts → eficiência aeróbica | 🟢 | — |
| 7 | 🧠 Modo treinador: deload sugerido, semana do programa, heatmap, timeline de PRs | 🔴 | 2, 3, 4 |
| 8 | 🌅 Check-in matinal (Hooper) — opcional | 🟡 | 7 (integra no readiness) |

---

## Fase 1 — 💧 Hidratação diária

**Objetivo:** registrar água com 1 tap e acompanhar contra a meta do plano (35–40 ml/kg/dia → ~3,3–3,7 L).

### Modelo de dados
Tabela nova (não mexer em `body_logs`: `weight_kg` é NOT NULL lá e água é registrada o dia todo, sem pesagem):

```sql
create table hydration_logs (
  user_id uuid references auth.users not null default auth.uid(),
  date date not null,
  ml integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);
-- RLS idêntica a body_logs (select/insert/update/delete onde user_id = auth.uid())
```

### Mudanças no código
- `lib/types.ts`: `HydrationLog { date: string; ml: number }`; `GymData.hydration: HydrationLog[]`.
- `lib/sync-queue.ts`: incluir `"hydration_logs"` no union de `PendingMutation.table`.
- `lib/store.ts`: carregar `hydration_logs` no load inicial; `addWater(ml: number)` — acumula no total do dia (otimista), upsert `onConflict: "user_id,date"`, `logicalKey: date` (gravações offline do mesmo dia colapsam na última, total acumulado é idempotente ✓).
- `app/page.tsx`: card "Hidratação" com barra de progresso (meta = 37 ml × último peso corporal; fallback 3.300 ml) e botões rápidos **+250 ml · +500 ml · +750 ml** (copo, garrafa, garrafona) + desfazer último tap.
- `app/medidas/page.tsx`: mini-gráfico de barras dos últimos 7 dias (componente novo em `components/charts.tsx`, mesmo padrão do `ZoneChart` com `ReferenceLine` na meta).

### Regras
- Meta diária derivada do peso mais recente — nunca pedir configuração.
- Dia sem registro = 0 (não esconder; sinceridade > vaidade).

### Testes
- Unidade: meta por peso (88 kg → 3.256 ml), acúmulo de taps, colapso na fila offline.
- Manual: taps offline → flush ao voltar rede (padrão já testado nas outras tabelas).

---

## Fase 2 — 🔄 Ciclo rotativo de treinos

**Objetivo:** o app deixa de prescrever por dia da semana e passa a prescrever **o próximo treino do ciclo**: `Upper A → Lower A → Upper B → Lower B → (volta)`. Faltou 2 dias? O ciclo espera por você.

### Modelo de dados
**Nenhuma migration.** O ponteiro do ciclo é 100% derivável do histórico:

```
próximo = sucessor no ciclo do último treino de musculação registrado
```

Única persistência: preferência de modo (`ciclo` | `calendário`) em `localStorage` (`gym-track:schedule-mode`), para rollback fácil de UX.

### Mudanças no código
- `lib/cycle.ts` (novo, puro):
  - `LIFT_CYCLE: SessionId[] = ["upperA", "lowerA", "upperB", "lowerB"]`
  - `nextInCycle(workouts, today)` → `{ session, reason }` com as regras de proteção:
    1. sucessor do último lift registrado (ordem por data, depois por id);
    2. **2 lifts em dias consecutivos** → sugerir Z2/descanso antes do 3º (`reason: "recovery"`);
    3. **gap ≥ 7 dias** desde o último lift → sugerir repetir o último com ~90% das cargas (`reason: "regression"`, o prefill do treino aplica o desconto);
    4. esporte de sábado permanece fixo (compromisso social, não variável do ciclo).
  - `rolling7(workouts, today)` → sessões, volume e minutos Z2 da **janela móvel de 7 dias** (substitui semana-calendário).
- `app/page.tsx`: card "Treino de hoje" → "Próximo do ciclo" (com o motivo quando houver); fita seg–dom → fita dos últimos 7 dias (o que foi feito em cada um); stats "Sessões na semana" e "Zona 2 na semana" passam a janela móvel.
- `app/treino/page.tsx`: sessão default = `nextInCycle` (o seletor manual continua, vira override explícito).
- `lib/insights.ts`: meta de Z2 (60–70 min) avaliada em janela móvel.
- Streak (`app/page.tsx` e `lib/achievements.ts`): régua nova = "ciclo completo (4 lifts) em ≤ 9 dias corridos", mantendo a semana-calendário como fallback de exibição.

### Decisões em aberto (decidir no PR)
- Cardio Z2 entra na fila do ciclo ou fica só como meta móvel? **Recomendação: meta móvel** (mais flexível, é como você já usa).
- O que fazer se o usuário pular manualmente uma sessão do ciclo 2× seguidas (ex.: nunca faz Lower B)? Sugerir na 3ª com aviso, não forçar.

### Testes
- Unidade (lib pura): sucessor simples, virada do ciclo, 2 dias consecutivos → recovery, gap de 8 dias → regression, banco vazio → Upper A, janela móvel com treinos espalhados.

---

## Fase 3 — ✍️ Registro enriquecido (RIR, sRPE, duração real)

**Objetivo:** capturar esforço interno com custo de input quase zero. É a fundação das análises da Fase 4.

### Modelo de dados
- **RIR**: campo opcional no JSONB — `SetLog { weight, reps, rir?: number }`. Sem migration.
- **sRPE + duração**: colunas novas em `workouts`:

```sql
alter table workouts add column srpe smallint;        -- 1..10 (escala de Foster)
alter table workouts add column started_at timestamptz; -- 1ª série marcada
-- duration_min já existe: passa a ser preenchido de verdade (salvar - started_at)
```

### Mudanças no código
- `lib/types.ts`: `rir?` em `SetLog`; `srpe?`, `startedAt?` em `WorkoutLog`.
- `app/treino/page.tsx`:
  - RIR: 5 chips (`0 1 2 3 4+`) que aparecem **depois** de marcar a série ✓ — não polui o fluxo de digitação; default vazio (nunca obrigar).
  - `startedAt`: timestamp da primeira série marcada (guardado no rascunho p/ sobreviver reload); `durationMin` real no save.
  - sRPE: no card "Treino salvo!", uma régua 1–10 com 1 tap ("Como foi o treino?") — grava via upsert do mesmo log (padrão `addWorkout` já é upsert ✓).
- `lib/utils.ts`: `bestE1RM` ganha variante ajustada por RIR — Epley com reps efetivas `reps + rir` (75 kg × 8 @RIR2 ≈ 1RM de 10 reps em reserva total). Fallback: sem RIR, comporta-se como hoje.
- `lib/insights.ts`: `internalLoad(w)` = `srpe × durationMin` (AU). Fallback sem sRPE: tonelagem normalizada (documentar a constante).

### Regras
- Tudo opcional. Treino salvo sem RIR/sRPE é 100% válido.
- PR de e1RM continua usando a fórmula clássica para não invalidar o histórico; a ajustada por RIR entra como série nova no gráfico de força (Fase 4).

### Testes
- Unidade: e1RM ajustada (com/sem RIR), internalLoad com fallback.
- Manual no iPhone: chips de RIR não atrapalham o fluxo de marcar série + timer.

---

## Fase 4 — 📊 Análises de treino

**Objetivo:** transformar os dados das Fases 2–3 nas 4 análises que mudam decisão de treino.

### Sem migration — tudo derivado.

### Entregas
1. **Séries duras por grupo/semana** (`lib/muscles.ts` + toggle no gráfico do painel):
   - contagem de *sets* por grupo (não tonelagem — tonelagem infla perna e mascara deficiência de ombro/braço);
   - faixa-alvo sombreada no gráfico: 10–20 séries/grupo/semana;
   - com RIR: séries com RIR ≥ 5 não contam como "duras" (fallback: todas contam).
2. **Força relativa** (`components/charts.tsx`): e1RM ÷ peso corporal da época (interpolar `body_logs`), série temporal por exercício-chave. O gráfico anti-desânimo do cutting: peso caindo + relativa subindo = recomposição vencendo.
3. **Razões de equilíbrio estrutural** (card no painel): remada:supino (volume e e1RM, alvo ~1:1 ±15%), puxada:desenvolvimento. Fora da faixa → aviso âmbar com sugestão ("+2 séries de remada/semana").
4. **ACWR por carga interna + monotonia/strain de Foster** (`lib/insights.ts`):
   - `computeReadiness` passa a usar `internalLoad` (inclui futsal e cardio — hoje a tonelagem ignora justamente a carga do sábado);
   - monotonia = média ÷ desvio-padrão da carga diária (7 dias); strain = carga semanal × monotonia;
   - card de prontidão ganha os 2 números secundários + tooltip explicativo.

### Testes
- Unidade para os 4 cálculos com cenários sintéticos (incluindo histórico misto com/sem RIR/sRPE).

---

## Fase 5 — ⚖️ Recomposição corporal de verdade

**Objetivo:** tirar o ruído da balança e medir o que importa.

### Modelo de dados
```sql
alter table body_logs add column neck_cm numeric;  -- p/ %BF fórmula da Marinha
```

### Entregas
- **Média móvel de 7 dias do peso** como linha principal (`WeightChart`); pontos diários viram dots apagados. Pesagem diária flutua 1–2 kg de água/glicogênio — a média é o sinal.
- **Taxa semanal vs alvo**: Δ da média móvel por semana vs faixa -0,4 a -0,7 kg/sem (do plano). Sinal automático: mais rápido → "risco de perder músculo, suba calorias"; estagnado 3+ semanas → "ajuste o déficit".
- **%BF estimado (Marinha)** com cintura + pescoço + altura (altura: constante em `lib/plan.ts` ou campo único em settings) → **massa magra estimada** no tempo. É o gráfico que prova a recomposição.
- **Gráfico combinado peso (MM7) × cintura** no painel de medidas — separados você não vê o padrão "peso estável + cintura caindo".

### Testes
- Unidade: média móvel com buracos no histórico, taxa semanal, fórmula da Marinha contra valores conhecidos.

---

## Fase 6 — 🫀 Zona 2 com output (eficiência aeróbica)

**Objetivo:** medir o motor, não só os minutos.

### Modelo de dados
Sem migration — `cardio` é JSONB: `CardioLog { minutes, avgBpm?, mode, distanceKm?, watts? }`.

### Entregas
- `app/treino/page.tsx`: campos opcionais km **ou** watts na sessão de cardio (um basta).
- **Gráfico de eficiência** (`components/charts.tsx`): output ÷ BPM ao longo do tempo (ex.: km por sessão normalizado a 130 bpm). É a curva que prova que a tontura no futsal está morrendo — semanas antes do futsal confirmar.
- Painel: substituir/empilhar com o gráfico atual de minutos.

### Testes
- Unidade: normalização por BPM, sessões sem output ficam fora da curva sem quebrar.

---

## Fase 7 — 🧠 Modo treinador

**Objetivo:** o app passa a recomendar, não só registrar. Última fase porque consome tudo das anteriores.

### Entregas
1. **Deload sugerido**: readiness vermelho + e1RM estagnada/caindo em 3 sessões → card propõe semana a 50–60% do volume e o prefill do treino aplica o desconto com 1 tap de aceite.
2. **Semana do programa**: conectar a data do 1º treino à `TIMELINE` já escrita em `lib/plan.ts` — "Semana 5: hora de trocar uma Z2 por 8×1′ forte / 2′ leve" aparece no painel na semana certa.
3. **Heatmap de calendário** (estilo GitHub) por carga interna do dia — par perfeito do ciclo rotativo (mostra densidade, não dias fixos).
4. **Timeline de PRs**: `prEvents` já existe em `lib/insights.ts`; plotar pontos no tempo por exercício. Seca de 4+ semanas vira aviso ligado ao deload.

### Testes
- Unidade: gatilho de deload (combinações de readiness × tendência de e1RM), mapeamento data→semana do programa.

---

## Fase 8 (opcional) — 🌅 Check-in matinal (Hooper)

4 sliders de 1 tap (sono, dor muscular, estresse, disposição, escala 1–5) + horas dormidas.

```sql
create table checkins (
  user_id uuid references auth.users not null default auth.uid(),
  date date not null,
  sleep_h numeric, sleep_q smallint, soreness smallint,
  stress smallint, mood smallint,
  primary key (user_id, date)
);
```

- Índice de Hooper (soma) entra como modulador do readiness (objetivo × subjetivo divergindo = o subjetivo costuma estar certo).
- Só vale implementar se a aderência das Fases 1–3 se confirmar — é o input de maior risco de abandono.

---

## Riscos e cuidados transversais

- **`weekly*` vs janela móvel**: a Fase 2 muda a semântica de "semana" no painel; revisar TODOS os pontos que usam `mondayOf` (stats, resumo de domingo, streak, conquistas) numa passada só para não conviverem duas definições.
- **Fila offline com tabelas novas**: `flushQueue` descarta item em erro de API — validar payloads novos com cuidado (um campo errado = dado perdido silenciosamente). Considerar log de descartes no console.
- **Histórico heterogêneo**: cada cálculo novo precisa de fallback documentado para registros antigos (sem RIR, sem sRPE, sem km). Regra: degradar para o comportamento atual, nunca excluir o treino da análise.
- **Migrations Supabase**: o repo não versiona SQL — criar pasta `supabase/migrations/` a partir da Fase 1 e passar a versionar (hoje o schema só existe no dashboard).
- **Testes**: manter o padrão das libs puras (compilação isolada + cenários sintéticos com data fixa) e `pnpm build`; consertar o `pnpm lint` (eslint fora das devDependencies) na Fase 1 já que é 🟢.
