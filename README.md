# GYM//TRACK

Tracker pessoal com dois programas: Upper/Lower A-B para hipertrofia e recomposição
corporal, mais a preparação física para o jiu-jitsu (bloco aberto desde 25/08/2026),
que é o objetivo ativo.

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
| **Hoje** | Treino do dia, fita da semana, sessões/volume/Zona 2, séries duras por grupo muscular, prontidão por carga interna, 1RM estimada com ajuste por RIR quando informado e minutos de base aeróbica |
| **Treino** | Abas Jiu-Jitsu/Hipertrofia, próxima sessão do programa ativo, registro de séries e cardio, rascunho automático e histórico compartilhado |
| **Plano** | Os dois programas em abas separadas; o bloco de jiu-jitsu traz valências, A/B/C, Zona 2, coordenação com o tatame e progressão por blocos |
| **Medidas** | Peso, cintura, hidratação e sono com tendências, metas e registros diários |

## Dados & Auth

- **Supabase** (Postgres + Auth). Tabelas `workouts`, `workout_templates`,
  `body_logs`, `hydration_logs` e `sleep_logs`, todas com RLS por usuário
  (`auth.uid() = user_id`) e upsert por dia/sessão.
- Login por e-mail/senha; **cadastro desabilitado** no projeto (acesso restrito).
- O middleware redireciona qualquer rota para `/login` sem sessão.
- `workouts.entries` é JSONB com as séries (`[{ exerciseId, sets: [{weight, reps}] }]`);
  `cardios` é JSONB com a lista de blocos de cardio da sessão
  (`[{ minutes, avgBpm?, mode, purpose }]`) — 15′ de bike, 15′ de corrida e a
  caminhada de volta são três blocos. A coluna antiga `cardio` continua
  espelhando o primeiro bloco, para os registros anteriores à migration 0007.
- `workouts.duration_min` é a sessão inteira: sala medida (1ª série → salvar)
  mais todos os blocos de cardio.
- `workout_templates.template` guarda o plano editável de cada sessão. O treino do
  dia usa uma cópia: remover/trocar um exercício no registro não modifica o template;
  mudanças permanentes são feitas em **Plano → Editar template**.

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
lib/bjj-plan.ts o bloco de preparação física para o jiu-jitsu
lib/legacy-plan.ts  protocolos aposentados, só para o histórico
lib/store.ts    hook useGymData (Supabase: fetch + upsert)
lib/supabase/   browser client (@supabase/ssr)
middleware.ts   proteção de rotas via sessão
```

> Plano educativo — não substitui avaliação médica. Antes de intensificar o aeróbico:
> cardiologista + teste ergométrico (tontura em esforço relatada no plano).
