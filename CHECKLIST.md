# GYM//TRACK - Checklist & Roadmap de Funcionalidades

Este documento consolida todas as ideias de melhorias pensadas para o sistema, unindo as funcionalidades levantadas na fase de planejamento inicial e as novas recomendações geradas para enriquecer ainda mais o acompanhamento e gamificação do app.

---

## ✅ O Que Já Foi Implementado (100% Concluído)

### Fluidez e Satisfação na Academia
- [x] **1. Timer de descanso automático:** Countdown que começa sozinho com o tempo prescrito após marcar a série.
- [x] **2. Rascunho de treino sobrevivente (localStorage):** Proteção para nunca perder dados de um treino em andamento se a aba for reciclada.
- [x] **3. PWA Instalável + Filas Offline:** Funcionamento cross-offline, filas de requisição assíncronas (Service Worker) para lugares sem sinal.
- [x] **4. Celebração de PR:** Animação de `🔥 PR!` quando o 1RM estimado supera o histórico.
- [x] **5. Vibração ao marcar série:** Feedback tátil (navigator.vibrate no Android; háptico real via switch control no iOS 17.4+) + tick sonoro e micro-animação para tornar o input satisfatório.
- [x] **6. Fluxo de teclado entre campos:** Pulos automáticos de foco entre "peso", "reps" e "próxima série" (Enter no desktop, tecla "próximo" no Android via enterKeyHint; no iOS o teclado numérico não tem Enter — usar as setas nativas acima do teclado).
- [x] **7. Skeletons Loading:** Cards de skeleton fiéis ao layout no lugar de spinners genéricos para mitigar tempo de fetch.
- [x] **8. Safe Area do iPhone:** Ajustes da navegação e botões flutuantes para não encostar na barra de home (`env(safe-area-inset-bottom)`).

### Histórico, Visualização e Gamificação (Quick Wins)
- [x] **9. Aba de Histórico de Treinos:** Lista de registros cronológicos.
- [x] **10. Exclusão de Treinos:** Botão seguro e funcional com tratamento offline para remover sujeiras do histórico.
- [x] **11. Indicador Visual de Séries:** (🔼 ▶️ 🔽) Comparativo ao vivo de volume/carga ao preencher frente à sessão idêntica passada.
- [x] **12. Auto-Sugestão de Progressão:** Sistema detecta repetições no teto da prescrição e sugere aumento automático de 2.5kg na sessão atual.
- [x] **13. Contagem de Streak de Treino:** Fogo (🔥) e número de semanas ininterruptas exibidos no card do Dashboard.
- [x] **14. Dias de Jornada:** Contador do número de dias treinando desde o início.
- [x] **15. Evolução de Cintura:** Gráfico específico da recomposição corporal ao lado do de peso.

### Inteligência e Gamificação
- [x] **19. Volume por Grupo Muscular:** Gráfico de "Tons Levantados" com barras empilhadas por parte do corpo (Perna, Costas, Peito, Ombro, Braço, Core) + % de distribuição das últimas 4 semanas para enxergar deficiências do shape. Toggle Total/Por grupo no painel.
- [x] **20. Estimativa de Fadiga / Readiness:** Sinal 🟢🟡🔴 no painel via razão carga aguda:crônica (ACWR) — volume dos últimos 7 dias contra a média semanal das 3 semanas anteriores (≤110% verde, ≤140% amarelo, acima vermelho).
- [x] **21. Resumo Semanal Automático:** Card dourado no painel todo domingo com sessões/5, PRs batidos na semana, volume total e calorias estimadas por METs.
- [x] **22. Badges de Conquistas Xbox-style:** 16 selos derivados do histórico (séries 100/500/1000, toneladas 50/250/1000, streaks 4/12 semanas, PRs, Zona 2, Atleta Bronze/Prata/Ouro) com barra de progresso nos bloqueados.

---

## ⏳ O Que Falta Implementar (Roadmap Futuro)

Estas melhorias estão organizadas pela relação entre o retorno de valor (impacto no dia a dia) e o tempo estimado de desenvolvimento.

### Próximos Passos Prioritários (Médio Esforço, Retorno Ggigante)
- [ ] **16. Preview do próximo treino no painel:** O dashboard se torna prescritivo, passando um spoiler do dia: ("Supino: Último 65kg x 8 - tente 67.5kg").
- [ ] **17. Timer de Zona 2 Embutido:** O timer existente no app é focado na musculação. Será criado um painel de cardio contínuo visível e com referencial de target (ex: 120-140 BPM).
- [ ] **18. Reordenar Exercícios da Sessão:** Botões ou drag-and-drop nos cards de exercícios para reorganizar as telas quando o equipamento titular na academia estiver ocupado.

### Funcionalidades Especiais de Recomposição Corporal (Alto Esforço)
- [ ] **23. Registro de Fotos Diário/Semanal:** Galeria visual de transição de shape para o usuário conseguir ver o próprio antes/depois no longo prazo. (Requer implementação com Supabase Storage API).
- [ ] **24. Registro Simples de Proteína Diária:** Uma barra de progresso simples contra a meta gerada (ex: 180g) para que o atleta possa somar gramas no decorrer do dia.

### Polimentos Gerais e Ferramentas Pessoais
- [ ] **25. Export de CSV / Backup:** O atleta pode baixar todo o seu banco de dados em um .CSV local.
- [ ] **26. Tema Claro (Light-mode):** Um toggle css puro no dashboard para quem treina de manhã ao ar livre.
- [ ] **27. Notificações Push-API Web:** Agendamento local via service worker avisando "Hoje é dia de Perna".
