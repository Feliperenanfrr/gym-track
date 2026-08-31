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
| **Hoje** | Treino do dia, fita da semana, sessões/volume/Zona 2, séries duras por grupo muscular, prontidão por carga interna, 1RM estimada com ajuste por RIR quando informado, minutos de base aeróbica, gasto calórico dos treinos e balanço energético (ingestão estimada × variação de massa) |
| **Treino** | Abas Jiu-Jitsu/Hipertrofia, próxima sessão do programa ativo, registro de séries e cardio, sugestão de carga no passo do aparelho, reabertura do registro do dia, rascunho automático e histórico compartilhado |
| **Plano** | Os dois programas em abas separadas; o bloco de jiu-jitsu traz valências, A/B/C, Zona 2, coordenação com o tatame e progressão por blocos |
| **Medidas** | Peso, cintura, hidratação e sono com tendências, metas e registros diários |
| **Relatórios** | Três documentos em PDF: fechamento de bloco, dossiê para o preparador físico e acompanhamento nutricional |

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
- Caminhadas e corridas do Strava podem ser importadas por CSV no Histórico.
  Cada bloco preserva duração em segundos, distância, passos, elevação, horário,
  local e título dentro de `workouts.cardios`; atividades do mesmo dia são
  agrupadas na sessão histórica `strava` e reimportações não duplicam dados.
- Calorias são estimadas com o peso da época. Caminhada/corrida usa ritmo,
  cadência e elevação quando disponíveis; musculação usa duração real e MET
  ajustado pelo sRPE. O app exibe uma faixa porque não substitui calorimetria.
- O Painel mostra o gasto como TAXA (kcal/semana) contra o período anterior, com
  barras empilhadas separando cardio (incluindo esporte e Strava) de musculação,
  linha da média e leitor por toque. 12 semanas ou histórico por mês.
- **Balanço energético**: a variação de massa dos últimos 28 dias vira energia
  (gordura a 9.440 kcal/kg e magra a 1.816 kcal/kg quando há bioimpedância;
  7.700 kcal/kg de peso no fallback) e, somada ao gasto modelado — basal medido
  na balança ou Katch-McArdle, rotina/digestão a 25% do basal e as calorias de
  treino diluídas por dia — estima a ingestão diária, os alvos para cortar,
  manter ou ganhar, e o saldo semana a semana num gráfico divergente.
- `workout_templates.template` guarda o plano editável de cada sessão. O treino do
  dia usa uma cópia: remover/trocar um exercício no registro não modifica o template;
  mudanças permanentes são feitas em **Plano → Editar template**.

## Backup do banco

O plano Free do Supabase **não faz backup nenhum** — nem diário, nem snapshot ao
pausar o projeto. É por nossa conta:

```bash
pnpm backup     # backups/<data>/{schema.sql, data.sql, dados.json, MANIFEST.json}
```

Usa o `SUPABASE_ACCESS_TOKEN` do `.env.local` (Management API roda SQL como
`postgres`): não precisa de Docker nem da senha do banco. Salva tabelas,
constraints, índices, funções, triggers, RLS e policies do schema `public`, mais
todas as linhas — em SQL para restaurar e em JSON para ler.

`backups/` está no `.gitignore`: são dados de saúde, nunca vão para o repositório.
Copie para fora da máquina (Drive, HD externo) — backup no mesmo disco não é backup.

Restaurar num projeto vazio, na ordem: `schema.sql`, depois `data.sql`. As FKs
apontam para `auth.users`, então o usuário precisa existir antes (mesmo `user_id`)
ou as linhas são rejeitadas.

`pnpm backup:pgdump` é a rota alternativa via `pg_dump` (CLI do Supabase +
Docker + `SUPABASE_DB_URL`, a string do *Session pooler*). Mais lenta de
preparar, mas pega também roles e os schemas `auth`/`storage`.

> As migrations em `supabase/migrations/` **não** recriam o banco sozinhas:
> `workouts` e `body_logs` nasceram no dashboard e só aparecem ali em `alter table`.
> O `schema.sql` do backup é o que fecha esse buraco.

## Relatórios em PDF

Em **/relatorios** (link no cabeçalho do painel), três documentos prontos para
salvar ou entregar a outra pessoa:

- **Fechamento de bloco** — o comparativo início × fim do mesociclo: 1RM estimada
  por levantamento, composição corporal, volume por grupo muscular contra o piso
  de 10 séries duras/semana, base aeróbica, energia do bloco, PRs agrupados por
  exercício e a leitura em duas colunas do que progrediu e do que ficou para trás.
  As pontas comparadas são um terço do período em cada lado (mínimo de 7 dias),
  não o melhor dia isolado.
- **Acompanhamento nutricional** — perfil de bioimpedância (com a altura derivada
  do IMC), ingestão estimada com faixa, decomposição do gasto, alvos para cortar,
  manter ou ganhar, variação de massa em painéis de escala própria, gasto com
  treino, hidratação, sono e uma seção de metodologia e limitações — o documento
  vai para quem não conhece o método.
- **Preparador físico** — dossiê para reavaliar e reconstruir o plano: qualidade
  dos registros, exposição e carga semanal por sRPE, exercícios repetidos com
  comparação robusta de 1RM estimada, séries diretas por grupo sem piso
  universal, condicionamento, composição corporal, recuperação e perguntas para
  a anamnese. Estimativas calóricas e ACWR não entram como desfechos.

Períodos: os blocos do jiu-jitsu entram como preset com as janelas reais
(derivadas de `BJJ_START_DATE`, truncadas em hoje quando ainda em curso); a
hipertrofia, que roda em ciclo rotativo sem bloco, usa janelas móveis de 4, 8 ou
12 semanas. Datas personalizadas também.

O PDF sai pela impressão do navegador (**Salvar como PDF** no destino; no celular,
pelo menu de compartilhamento) — sem dependência nova num app offline-first. A
folha tem largura de A4 útil e, na tela, é reduzida por `transform` como preview
de documento: o que aparece no celular é o próprio PDF em miniatura. Tema claro
próprio e gráficos em SVG escrito à mão, porque em impressão o `ResponsiveContainer`
do recharts mede antes do navegador refazer o layout, e tooltip e animação não
têm o que fazer num papel.

## Progressão de carga (o app sugere, você decide)

- O campo de carga vem com **o que você fez da última vez naquele exercício**, em
  qualquer sessão — avulso incluído. O app não reescreve mais a carga sozinho.
- Ao lado dos campos fica a sugestão: **subir** (topo da faixa em todas as
  séries), **manter e buscar mais uma repetição**, ou **reentrar ~10% abaixo**
  ao voltar de pausa. *Aplicar* preenche num toque as séries ainda não marcadas;
  manter carga é só orientação, nunca escreve no campo.
- O passo respeita o equipamento: é o maior incremento de academia (1, 2, 2,5 ou
  5 kg) que divide **todas** as cargas já registradas naquele exercício. Numa
  máquina de pino que anda de 5 em 5, a sugestão nunca pede 52,5 kg. Dá para
  fixar o passo à mão no próprio card (até 20 kg, para leg press com anilha).
- "Voltando de pausa" conta **qualquer musculação registrada** — avulso e sala do
  jiu-jitsu incluídos. Só cardio, tatame e Strava não seguram a pausa: musculação
  é o que tem série anotada (ou uma sessão da fila Upper/Lower).
- Já existe registro desta sessão hoje? A tela **reabre o que foi salvo** em vez
  de partir do zero — a gravação é upsert por dia+sessão, então salvar de novo
  completa o registro em vez de apagar o anterior.

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
lib/energy.ts   balanço energético: tendência de massa, TDEE e ingestão estimada
lib/reports.ts  montagem dos relatórios (períodos, antes × depois, séries semanais)
components/report/  folhas A4, kit de gráficos SVG e primitivas de documento
lib/progression.ts  sugestão de carga e passo real de cada aparelho
lib/workout-form.ts reabertura de um registro já salvo no formulário
lib/store.ts    hook useGymData (Supabase: fetch + upsert)
lib/supabase/   browser client (@supabase/ssr)
middleware.ts   proteção de rotas via sessão
```

> Plano educativo — não substitui avaliação médica. Antes de intensificar o aeróbico:
> cardiologista + teste ergométrico (tontura em esforço relatada no plano).
