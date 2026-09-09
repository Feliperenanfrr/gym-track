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
| **Hoje** | Treino do dia, fita da semana, sessões/volume/Zona 2, séries duras por grupo muscular, prontidão por carga interna, 1RM estimada com ajuste por RIR quando informado, minutos de base aeróbica, gasto calórico dos treinos, **gasto e saldo do dia** com o acumulado de 7 dias, e balanço energético (ingestão estimada × variação de massa) |
| **Treino** | Abas Jiu-Jitsu/Hipertrofia, próxima sessão do programa ativo, registro de séries e cardio, sugestão de carga no passo do aparelho, reabertura do registro do dia, rascunho automático e histórico compartilhado |
| **Plano** | Os dois programas em abas separadas; o bloco de jiu-jitsu traz valências, A/B/C, Zona 2, coordenação com o tatame e progressão por blocos |
| **Comida** | Refeições fixas em dois toques, refeição diferente por JSON, proteína do dia contra o alvo por massa magra, distribuição por refeição, proteína dos últimos 14 dias, calendário de cobertura e histórico por mês para editar refeições e marcar dias anteriores como completos |
| **Medidas** | Peso, cintura, hidratação e sono com tendências, metas e registros diários |
| **Relatórios** | Três documentos em PDF: fechamento de bloco, dossiê para o preparador físico e acompanhamento nutricional |

## Dados & Auth

- **Supabase** (Postgres + Auth). Tabelas `workouts`, `workout_templates`,
  `body_logs`, `hydration_logs`, `sleep_logs`, `meal_templates` e `meal_logs`,
  todas com RLS por usuário (`auth.uid() = user_id`) e upsert por dia/sessão.
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

## Comida

Registro alimentar sem contar caloria a caloria. Três entradas:

- **Refeição fixa** — o que você come quase todo dia (café de cuscuz com ovo,
  almoço de casa, o copo de 400 ml de suco) fica permanentemente na tela.
  Escolher e salvar são dois toques.
- **Fixa com variação** — a refeição abre com todos os itens marcados em 1×.
  Desmarque o arroz, troque porco por frango (deixe os dois no molde e
  desmarque um), dobre a quantidade do feijão. Só o que mudou é ajustado.
- **Refeição diferente** — gere o JSON numa gem do Gemini (foto do prato, frase
  solta, ou várias refeições de uma vez) e cole na tela. O app só valida e soma;
  nenhuma interpretação de texto livre roda aqui, no mesmo espírito do CSV da
  balança.
- **Lote** — um JSON pode trazer várias refeições, inclusive de dias diferentes.
  A tela lista todas, deixa desmarcar as que não quer, abrir qualquer uma no
  compositor para conferir, e grava o resto de uma vez. Refeição ilegível não
  derruba as outras: o erro fica na linha dela.

**A regra do snapshot**: `meal_logs.refeicoes` guarda uma cópia completa dos
itens comidos. Corrigir uma refeição fixa depois — reimportando pela gem ou
ajustando um macro — vale só para os próximos dias; nenhum registro anterior é
reescrito. É a mesma separação de `workout_templates`.

O alvo do dia é **proteína**, não caloria: a caloria a balança já estima pelo
balanço energético, mas proteína o app não tem como inferir. Com bioimpedância
na base, o alvo sai de 2,0–2,4 g/kg de **massa magra** — sobre o peso total, a
30% de gordura, o número inflaria. Sem composição, cai para 1,6–1,8 g/kg de peso.

A marca **"registrei tudo neste dia"** existe para as análises: um dia com café
salvo e jantar esquecido não pode entrar na média como "comeu 900 kcal". Ao lado
dela, a tela mostra quantos dos últimos 28 dias estão completos — é o indicador
antecedente da reconciliação entre ingestão registrada e derivada: marcar 4 de 28
significa que aquela análise não vai ter o que comparar.

Em **Comida → Histórico**, todos os dias registrados aparecem por mês, do mais
recente ao mais antigo. O filtro **Parciais** ajuda a encontrar dias em que faltou
marcar **Registrei tudo**, que pode ser alterado ali mesmo. **Editar dia** reabre
as refeições na data original para corrigir quantidades, remover ou incluir
refeições. Também é possível escolher uma data sem registro para preencher depois.

### As três leituras da tela

- **Distribuição do dia** — duas barras por refeição, calorias e proteína, cada
  uma na sua unidade. Juntas mostram o que nenhuma mostra sozinha: a refeição que
  pesa nas calorias sem entregar proteína tem a barra dourada longa e a verde
  curta. Funciona com um dia só, sem precisar acumular semanas.
- **Proteína por dia** — 14 barras contra a faixa alvo. Dia parcial sai em
  dourado em vez de verde, porque barra curta por jantar esquecido não significa
  a mesma coisa que barra curta por ter comido pouco.
- **Calendário alimentar** — fita de cobertura no formato do calendário de
  treino, verde para dia completo e dourado para parcial. Tocar num dia abre ele
  acima. O valor aqui é menos analítico que comportamental: ver os buracos é o
  que faz marcar o dia.

### Gasto e saldo do dia (aba Hoje)

O painel de calorias trabalha em taxa semanal e o de balanço energético em média
de 28 dias — nenhum dos dois responde "quanto gastei hoje", e a diferença entre
um dia de dois treinos e um de descanso passa de 500 kcal. O card do dia
decompõe basal + rotina + treino **daquele dia**, mostra o saldo contra o que foi
registrado, e traz o **acumulado de 7 dias** em destaque.

Os sete dias ficam em destaque de propósito: um dia isolado oscila mais que
300 kcal só por água e digestão, e um déficit diário visível convida à troca
"treinei, logo posso comer mais hoje" — que é exatamente como se anula um déficit
semanal. O acumulado soma **apenas os dias com registro** (`loggedDays` sai
junto, para a tela dizer sobre quantos dias está falando): comparar a ingestão de
dois dias contra o gasto de sete inventaria um déficit de milhares de kcal.

### O JSON da refeição

kcal e macros são **sempre do total de `qtd × unidade`**, nunca por 100 g — é o
erro mais provável e o mais silencioso. O parser confere o que é fisicamente
impossível (densidade acima de óleo puro, proteína maior que a massa do
alimento, kcal que não fecha com 4/4/9) e avisa antes de salvar.

Três formatos aceitos — lista, lista com data comum ao lote, e uma refeição só:

```json
[
  {
    "nome": "Almoço no restaurante",
    "refeicao": "almoco",
    "data": "07/09/2026",
    "hora": "12:40",
    "itens": [
      { "nome": "Arroz branco cozido", "qtd": 2, "unidade": "concha",
        "gramas": 200, "kcal": 257, "proteinaG": 5.0, "carboG": 56.2, "gorduraG": 0.4 }
    ],
    "premissas": ["Concha de arroz estimada em 100 g"]
  },
  {
    "nome": "Banana",
    "refeicao": "lanche",
    "hora": "15:10",
    "itens": [
      { "nome": "Banana prata", "qtd": 1, "unidade": "unidade",
        "gramas": 86, "kcal": 80, "proteinaG": 1.1, "carboG": 20.5, "gorduraG": 0.1 }
    ]
  }
]
```

```json
{ "data": "07/09/2026", "refeicoes": [ /* … */ ] }
```

Obrigatórios por item: `nome`, `qtd`, `unidade`, `gramas`, `kcal`, `proteinaG`,
`carboG` e `gorduraG` — nunca `null` ou `"N/A"`. `alcoolG` só em bebida
alcoólica. Unidades aceitas: g, ml, unidade, fatia, concha, colher, copo, filé,
scoop, pote, pão. `refeicao` ausente é deduzida pela hora; `data` ausente cai no
dia selecionado na tela; cercas de código e texto solto em volta do JSON são
tolerados. Limite de 60 refeições por lote.

`fonte` (`foto` | `texto` | `rotulo`) marca de onde veio a estimativa. Rótulo
quase não erra, foto erra na porção — guardar isso é o que permite perguntar, na
reconciliação, se o desvio está concentrado nos dias de foto. Estimativa ruim de
porção e refeição esquecida pedem correções opostas.

`alcoolG` existe porque etanol vale **7 kcal/g** e não cabe em 4/4/9: sem o
campo, a checagem de coerência acusava toda bebida alcoólica de estar errada — e
alarme falso ensina a ignorar o aviso que importa, o de macro por 100 g.

`gramas`, `carboG` e `gorduraG` continuam **opcionais no parser** — registros
antigos e falhas pontuais da gem seguem entrando. Mas `0.0` é um valor (óleo não
tem carboidrato) e a chave ausente significa "não sei":

- sem `carboG`/`gorduraG` o app conta os itens, avisa na importação e mostra o
  total do dia como **piso** (`≥210 g`) em vez de fingir precisão;
- sem `gramas` a checagem de densidade (>9,5 kcal/g), que é o detector mais forte
  do erro por 100 g, simplesmente não roda — daí o aviso próprio.

kcal e proteína não têm esse risco porque são obrigatórios de verdade.

O prompt da gem que gera esse JSON está em
[`docs/gem-refeicoes.md`](docs/gem-refeicoes.md), versionado junto — é a outra
metade do contrato de `lib/nutrition.ts`.

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
app/            páginas (painel, treino, plano, comida, medidas, login)
components/     bottom-nav, cards/ui, gráficos recharts
lib/plan.ts     o plano do PDF como dados tipados
lib/bjj-plan.ts o bloco de preparação física para o jiu-jitsu
lib/legacy-plan.ts  protocolos aposentados, só para o histórico
lib/energy.ts   balanço energético: tendência de massa, TDEE e ingestão estimada
lib/nutrition.ts  parser do JSON da refeição, totais, alvo de proteína e séries dos gráficos
lib/daily-energy.ts gasto e saldo do DIA, mais o acumulado de 7 dias
lib/use-meal-templates.ts  refeições fixas (moldes), separadas dos registros
lib/reports.ts  montagem dos relatórios (períodos, antes × depois, séries semanais)
components/report/  folhas A4, kit de gráficos SVG e primitivas de documento
lib/progression.ts  sugestão de carga e passo real de cada aparelho
lib/strength.ts séries do top set, 1RM só onde Epley se sustenta e carga relativa
components/relative-load-board.tsx  carga vs. recorde agrupada por faixa
lib/workout-form.ts reabertura de um registro já salvo no formulário
lib/store.ts    hook useGymData (Supabase: fetch + upsert)
lib/supabase/   browser client (@supabase/ssr)
middleware.ts   proteção de rotas via sessão
```

> Plano educativo — não substitui avaliação médica. Antes de intensificar o aeróbico:
> cardiologista + teste ergométrico (tontura em esforço relatada no plano).

## Força: carga do top set e 1RM estimada

O gráfico de força mostra a **carga da série mais pesada** de cada sessão — dado
bruto, sem extrapolação, e exatamente o número que decide a próxima sessão.

A **1RM estimada** fica disponível só onde a fórmula de Epley se sustenta:

- até **8 repetições efetivas** (reps + RIR) na série do topo;
- sem RIR informado, até **6 repetições** — a reserva desconhecida faz
  `reps + RIR` tratar a série como levada à falha, e uma série de 8 sem RIR
  viraria um chute para baixo com selo de confiável;
- **2 ou mais sessões** que passem nesses critérios, senão não há linha a
  desenhar.

Treino de hipertrofia raramente passa nesses filtros, e isso é o comportamento
correto: extrapolar 1RM de uma série de 12–15 repetições faz a mesma cadeira
extensora "variar" de 154 a 63 kg estimados em dez semanas sem que nada disso
tenha acontecido. Quando o botão está apagado, a tela diz quantas das sessões
qualificaram e por quê — em vez de só desabilitar sem explicação.

## Carga vs. seu recorde

Compara a carga da última sessão com a melhor dos últimos 6 meses no mesmo
exercício, agrupada em três faixas: **longe** (<80%), **perto** (80–94%) e **no
recorde** (≥95%).

Não é um gráfico: é HTML com o nome inteiro do exercício. A versão em SVG
truncava o rótulo em 13 caracteres, e "Tríceps na po…" ao lado de "Cadeira
exten…" obriga a decorar a ordem para saber do que a barra fala.

Cada linha traz a distância em **quilos** além da porcentagem — você levanta kg,
não razão, e "faltam 35 kg" decide a próxima sessão enquanto "46%" não — mais a
idade do recorde, que separa destreino recente de antigo.

Estar abaixo de 80% não é platô: é distância do que você já levantou, e pede
voltar progressivamente, não trocar de exercício.
