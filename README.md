# GYM//TRACK

Tracker pessoal do plano de treino (Upper/Lower A-B + Zona 2 + recomposição corporal),
gerado a partir do `Plano_de_Treino_Felipe.pdf`.

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Build de produção: `pnpm build && pnpm start`.

## O que tem

| Aba | O que faz |
| --- | --- |
| **Hoje** | Treino do dia, fita da semana, sessões/volume/Zona 2 da semana, gráficos de volume, 1RM estimada (Epley) e minutos de base aeróbica |
| **Treino** | Registro de séries (kg × reps) com prescrição do plano, números da última sessão e alerta de sobrecarga progressiva ("topo da faixa → suba 2,5–5 kg") |
| **Plano** | O plano completo do preparador: estrutura da semana, exercícios, regras de ouro, nutrição e linha do tempo |
| **Medidas** | Peso e cintura com tendência, metas diárias de proteína/água calculadas pelo peso atual |

## Dados

- **MVP sem backend**: tudo em `localStorage` (`gym-track:data:v1`).
- Na primeira visita, o app semeia **5 semanas de histórico mockado** com progressão
  realista de cargas (determinístico, relativo à data atual).
- "Regenerar dados mockados" no rodapé do painel apaga tudo e re-semeia.
- Treinos reais que você salvar substituem/conviven com o mock no mesmo storage.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Recharts · TypeScript ·
fontes Anton / Barlow / JetBrains Mono via Fontsource. Sem variáveis de ambiente.

## Estrutura

```
app/            páginas (painel, treino, plano, medidas)
components/     bottom-nav, cards/ui, gráficos recharts
lib/plan.ts     o plano do PDF como dados tipados
lib/mock-data.ts gerador determinístico do histórico
lib/store.ts    hook useGymData (localStorage + seed)
```

> Plano educativo — não substitui avaliação médica. Antes de intensificar o aeróbico:
> cardiologista + teste ergométrico (tontura em esforço relatada no plano).
