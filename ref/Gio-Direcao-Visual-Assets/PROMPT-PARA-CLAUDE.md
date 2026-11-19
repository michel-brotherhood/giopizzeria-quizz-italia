# Ajuste visual do app Gio Pizzeria

Você vai trabalhar no app existente da Gio Pizzeria. A pasta `Gio-Direcao-Visual-Assets` contém a direção e os materiais desta revisão. Leia seu LEIA-PRIMEIRO, docs/, tokens/gio.css e assets/manifesto.json. Abra visualmente a prévia e os assets antes de editar.

Leia também as instruções canônicas do repositório: AGENTS.md, CLAUDE.md, README, docs/ e os JSON de perguntas/campanha disponíveis. Os arquivos em contexto-original são cópias históricas recebidas para este pacote, não substitutos das instruções atuais. Procure os materiais oficiais em `mateiriais/` e variantes existentes sem renomear a pasta. Não sobrescreva logos ou conteúdo.

Objetivo: aproximar o app da prévia `referencias/previa-desktop-mobile.png`, mantendo o conceito Da massa ao forno: oito perguntas sobre gastronomia italiana acompanhadas da preparação progressiva de uma pizza em cenário 3D contemporâneo, acolhedor e autoral.

Antes de implementar, faça inventário do app e indique quais componentes atuais serão alterados. Preserve a stack adequada existente. Não recrie o app do zero, não migre frameworks, não altere autenticação, banco ou contratos do backend para uma revisão visual. Avance na execução local após esse diagnóstico curto.

Direção: azul quase preto, creme e vermelho tomate; bancada de pedra e madeira com farinha; cerâmica, molho, mozzarella, manjericão, azeite e forno com luz quente. Na tela grande, cenário ocupa cerca de 58–62% da área útil e quiz 38–42%. No celular, uma coluna com cenário compacto acima da pergunta e opções. A pizza tem contato físico com a bancada, escala e sombra coerentes; objetos não flutuam.

Use a marca Gio original. Os selos oficiais são pequenos elementos secundários, com área clara de apoio quando necessário. Redação de referência: Certificada AVPN nº 1166; Excellent Pizzerias — 50 Top Pizza Latin America 2026. Não invente colocação ou prêmio adicional.

Não transforme a imagem da prévia em fundo com botões sobrepostos. Perguntas, respostas, progresso, pontuação, feedback e navegação precisam ser HTML acessível, responsivo e alimentado pelo estado do app. Use o cenário WebP como fallback do modo leve e como imagem de espera; recrie a cena e a pizza em Three.js ou no renderizador existente quando houver suporte. Os PNG ampliados são masters para apresentação e composição, não os arquivos padrão para mobile.

A pizza PNG é um asset estático de uma etapa; não é modelo 3D nem sequência completa. Não simule as oito etapas movendo ou ampliando essa mesma pizza. Crie os estados necessários na cena: bancada vazia, massa, abertura da massa, molho, mozzarella, manjericão/azeite, entrada no forno, pizza assada. A progressão deve seguir as perguntas concluídas, inclusive em caso de erro, e deve usar IDs e estado persistido, sem depender de timers locais. Adapte o mapeamento ao conteúdo canônico e documente a decisão. Os rótulos de progresso na prévia são esquemáticos: corrija a inconsistência entre 'etapa mozzarella' e 'Forno' ativo.

Seleção de uma resposta e confirmação são momentos distintos. Não sinalize alternativa selecionada como correta antes de confirmar. Depois, mostre acerto/erro com texto, ícone e explicação curta; não use só cor. Não acrescente cronômetro obrigatório, física ou arrastar ingredientes. Honre prefers-reduced-motion, navegação por teclado e modo leve.

O fluxo de brinde existente deve continuar protegido pelo servidor: convite controlado pela equipe, uma recompensa por convite e confirmação única de resgate. Não invente oferta, item, desconto ou voucher válido. Produção continua desativada até a configuração aprovada. Uma demo deve ser explicitamente identificada e não emitir recompensa real.

Implemente em etapas locais: (1) identidade/layout; (2) cena e estados; (3) feedback/transições; (4) mobile/acessibilidade/performance; (5) regressão dos fluxos existentes. Não pare após descrever o plano.

Valide a interface em navegador real ou emulado, informe qual foi usado e capture screenshots em 390×844 e 1440×900. Verifique 320px de largura, zoom 200%, teclado, foco visível, movimento reduzido, ausência de WebGL e falha de carregamento de assets. Execute os testes existentes pertinentes às mudanças. Se tocar no fluxo de recompensa, execute também os testes de emissão, resgate único e concorrência. Não afirme testes não executados.

Entregue um resumo dos arquivos alterados, screenshots, comandos realmente executados e limitações em docs/STATUS.md. Se houver bloqueio externo, registre e continue o que for independente. Não publique nem ative campanha automaticamente.
