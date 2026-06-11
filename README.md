# GYM//TRACK

Tracker pessoal do plano de treino (Upper/Lower A-B + Zona 2 + recomposição corporal),
gerado a partir do `Plano_de_Treino_Felipe.pdf`.

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Build de produção: `pnpm build && pnpm start`.

Requer `.env.local` (e as mesmas variáveis na Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## O que tem

| Aba | O que faz |
| --- | --- |
| **Hoje** | Treino do dia, fita da semana, sessões/volume/Zona 2 da semana, gráficos de volume, 1RM estimada (Epley) e minutos de base aeróbica |
| **Treino** | Registro de séries (kg × reps) com prescrição do plano, números da última sessão e alerta de sobrecarga progressiva ("topo da faixa → suba 2,5–5 kg") |
| **Plano** | O plano completo do preparador: estrutura da semana, exercícios, regras de ouro, nutrição e linha do tempo |
| **Medidas** | Peso e cintura com tendência, metas diárias de proteína/água calculadas pelo peso atual |

## Dados & Auth

- **Supabase** (Postgres + Auth). Tabelas `workouts` e `body_logs`, ambas com RLS
  por usuário (`auth.uid() = user_id`) e upsert por dia/sessão.
- Login por e-mail/senha; **cadastro desabilitado** no projeto (acesso restrito).
- O middleware redireciona qualquer rota para `/login` sem sessão.
- `workouts.entries` é JSONB com as séries (`[{ exerciseId, sets: [{weight, reps}] }]`);
  `cardio` é JSONB (`{ minutes, avgBpm?, mode }`).

## Na academia (fluidez)

- **Timer de descanso**: ao marcar uma série, dispara um countdown com o descanso
  prescrito do exercício (pausar / −15 s / +15 s), vibra e bipa ao zerar.
- **Rascunho que sobrevive**: o treino em andamento é salvo em `localStorage` a cada
  toque; recarregar a aba, trocar de app ou bloquear a tela não perde nada.
- **PWA instalável + offline**: ícone na tela inicial e tela cheia; service worker
  cacheia o app shell. Salvar sem rede entra numa fila que sincroniza ao reconectar
  (gravação otimista), com indicador de pendências.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Recharts · Supabase
(`@supabase/ssr`) · PWA (service worker + manifest) · TypeScript · fontes Anton /
Barlow / JetBrains Mono via Fontsource.

## Estrutura

```
app/            páginas (painel, treino, plano, medidas, login)
components/     bottom-nav, cards/ui, gráficos recharts
lib/plan.ts     o plano do PDF como dados tipados
lib/store.ts    hook useGymData (Supabase: fetch + upsert)
lib/supabase/   browser client (@supabase/ssr)
middleware.ts   proteção de rotas via sessão
```

> Plano educativo — não substitui avaliação médica. Antes de intensificar o aeróbico:
> cardiologista + teste ergométrico (tontura em esforço relatada no plano).
