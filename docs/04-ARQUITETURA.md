# Arquitetura e implementação

## Stack e ambientes
Novo projeto: frontend Vite/JavaScript/Three.js e backend Node.js/Express/PostgreSQL, com migrations SQL. Preferir mesma origem: API e painel em /api e /equipe, frontend estático servido pelo backend ou proxy. Evitar React/TypeScript por padrão; aproveitar stack existente se adequada.
Documentar versões verificadas e dependências. Vitest para lógica; Playwright para E2E; integração com PostgreSQL real isolado para transações. HTTPS em produção. Compatível com VPS/Dokku; não provisionar serviço automaticamente.

## Estrutura sugerida
web/src/{game,ui,scene,styles}; server/{routes,services,db,middleware}; migrations/; content/; config/; tests/{unit,integration,e2e}; docs/{ASSETS,STATUS,VALIDACAO}.md. Adaptar ao repositório sem criar monorepo complexo desnecessário.

## Modelo mínimo
campaigns: estado, texto de oferta, rewardName, quantityPerVoucher, startsAt, endsAt, rewardTtlMinutes, sessionTtlMinutes, totalStock, reservedCount, awardedCount, redeemedCount, rulesVersion.
invitations: campaignId, accountRefHash, tokenHash, expiresAt, state; unicidade campaignId/accountRefHash. accountRef deve ser referência opaca fornecida pela equipe, não CPF/nome. Reutilizar convite existente em vez de gerar outro para mesma conta.
quiz_sessions: invitationId único quando premiável, campaignId, questionVersion, questionOrder, optionOrders, state, expiresAt, reservationState, credentialHash.
answers: sessionId/questionId único, selectedOptionId, isCorrect, answeredAt.
vouchers: sessionId único, tokenHash único, state, reward snapshot, expiresAt, redeemedBy e redeemedAt.
operators/sessions: identidade e função de operador, hashes/sessões revogáveis.
audit_events e idempotency_keys para operações de emissão/entrega.
Snapshots de regra e conteúdo asseguram consistência se seed mudar. Respostas corretas somente no servidor no modo real; enviar correta e explicação após resposta persistida. Banco local completo disponível apenas no modo demo não impede pesquisa, mas não pode autorizar recompensa.

## Sessões e credenciais
Sessão de jogador por cookie HttpOnly/Secure/SameSite adequado à mesma origem; exchange do token de convite é POST, não GET. Link abre landing neutra, cliente faz troca explícita; redirecionar URL para remover token e usar Referrer-Policy no-referrer, sem recursos terceiros nessas telas. Nunca registrar token bruto ou URL de convite nos logs. Resgate via token opaco aleatório com pelo menos 128 bits, armazenado por hash. Se usar código curto, limitar tentativas por operador/IP e consultar somente autenticado. Não expor endpoint público de enumeração de vouchers.
Autenticação da equipe por credenciais individuais ou identidade já existente com autorização; sessão segura e CSRF em mutações. Configurar confiança no proxy corretamente antes de rate limiting. CORS restrito se houver origens distintas.

## Frontend
Máquina de estados: boot/welcome/asking/submitting/feedback/completing/results/recovery. Renderer recebe eventos, não decide estado do brinde. Resposta duplicada igual retorna estado canônico; alternativa conflitante após aceite retorna conflito sem sobrescrever.
Pausar render quando aba oculta, usar import dinâmico para 3D e tratar context loss. Falha gráfica troca modo visual sem perder sessão. Sem service worker de API privada e sem offline redemption.

## Metas de desempenho
UI inicial comprimida <=150 KB sem módulo 3D; carregamento visual inicial <=2 MB; cena mobile de estudo <=60 mil triângulos/60 draw calls, DPR <=1.5. Medir e ajustar. Buscar 30 fps estáveis em celular intermediário e LCP <=2.5s/CLS <=0.1 em laboratório. Lighthouse mobile performance >=90/accessibility >=95 como metas, não resultados já obtidos. Registrar ambiente e métricas reais. Se necessário reduzir sombra, resolução e geometria, preservando arte.

## Publicação
.env.example com nomes sem valores: DATABASE_URL, SESSION_SECRET, PUBLIC_BASE_URL, PORT e flags de ambiente. VITE_* é público. Scripts dev/build/start/lint/test/test:content/test:integration/test:e2e/db:migrate e README. Assets com hash e cache imutável, HTML revalidado; API privada Cache-Control: no-store. Migrations compatíveis, backup e restauração testada antes de lançamento real; rollback de código não deve invalidar vouchers em circulação.
