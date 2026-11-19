# Gio Pizzeria — Da massa ao forno
Quiz gastronômico de oito perguntas para jogar no salão, acompanhando uma pizza napolitana 3D sendo preparada na bancada até sair do forno. Inclui modo demonstração (sem brinde) e fluxo real de brindes controlado pelo servidor (convite da equipe → partida → voucher único → confirmação de entrega).

> **Estado:** desenvolvimento local concluído e testado (ver `docs/STATUS.md`). **Não está pronto para operação real**: brinde, estoque, período, regras públicas, credenciais da equipe, licença da fonte e ensaio com a equipe estão pendentes. Produção começa com campanhas reais **bloqueadas**.

## Stack
JavaScript ES modules · Vite 8 · Three.js 0.187 · Node.js 24 · Express 5 · PostgreSQL (SQL puro, migrations em `migrations/`). Sem React/TypeScript. Testes: Vitest (unidade e integração com PostgreSQL real) e Playwright (E2E + capturas).

```
web/            index.html (cliente) · equipe/index.html (painel) · src/{game,scene,styles}, public/{brand,fonts,photos}
server/         app.js · routes/api.js · services/{player,staff,campaigns,expiry,idempotency,crypto} · middleware · db
shared/quiz.js  motor de sorteio/correção usado pelo servidor e pela demo
migrations/     001_init.sql (constraints de estoque/estados no banco)
content/        questions.seed.json (32 perguntas)
tests/          unit · integration (PostgreSQL real) · e2e (Playwright)
docs/           ASSETS · STATUS · MANUAL-EQUIPE · OPERACAO · screenshots/
```

## Rodar localmente
Requisitos: Node 24. Não precisa instalar PostgreSQL: em desenvolvimento usamos os binários oficiais via `embedded-postgres`.

```bash
npm install
npm run dev:db          # terminal 1: PostgreSQL local em 127.0.0.1:54329 (gio_dev)
npm run db:seed-test    # cria campanha [TESTE] (sem valor) e operadores de teste; senhas aleatórias aparecem no terminal
npm run dev             # terminal 2: API (3000) + Vite (5173)
```
- Cliente: http://localhost:5173/ · Equipe: http://localhost:5173/equipe/
- Para testar o brinde: entre na equipe, gere um convite e abra o link/QR em outra aba ou aparelho.

## Scripts
| Script | O que faz |
|---|---|
| `npm run dev` | API com reload + Vite |
| `npm run build` / `npm start` | build de produção em `dist/` / servidor Express (serve `dist/` se `SERVE_STATIC=true`) |
| `npm run lint` | sintaxe de todos os JS + padrões proibidos (segredo em VITE_*, credencial no front, log de token) |
| `npm test` / `npm run test:content` | unidade (motor, conteúdo, contraste) / só conteúdo |
| `npm run test:integration` | regras de brinde e concorrência contra PostgreSQL real isolado (sobe sozinho na porta 54330) |
| `npm run test:e2e` | build + servidor de produção + PostgreSQL isolado (54331) + Playwright/Chromium (WebGL via SwiftShader) |
| `npm run db:migrate` | aplica migrations pendentes |
| `npm run staff:create -- --user maria --name "Maria" --role attendant` | cria operador (senha digitada ou `STAFF_PASSWORD`) |

## Deploy (VPS com Dokku) — não executado
Ver `docs/OPERACAO.md`. Resumo: `dokku apps:create`, `dokku postgres:create` + `link`, configurar variáveis de `.env.example` (`APP_ENV=production`, `SESSION_SECRET`, `PUBLIC_BASE_URL` com HTTPS, `SERVE_STATIC=true`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`, **`REAL_CAMPAIGNS_ENABLED=false`**), `git push dokku main`. `app.json` roda migrations no predeploy e o healthcheck em `/api/health`. Criar operadores com `dokku run <app> npm run staff:create -- …`.

## Regras que o código garante
- Servidor sorteia e guarda as 8 perguntas; a resposta correta só sai depois da resposta gravada. Score, estoque e elegibilidade nunca vêm do cliente.
- Convite por conta (único por campanha); troca por POST idempotente; o token vem no fragmento `#convite=` (não trafega em GET nem em logs) e sai da URL na hora.
- Reserva de 1 unidade ao iniciar; conversão em voucher único na conclusão; entrega `issued → redeemed` atômica com operador e horário. `CHECK` no banco: `reserved + awarded ≤ total` e `redeemed ≤ awarded`.
- Consultar nunca entrega. Repetições idempotentes devolvem o estado canônico.
- Demo nunca emite voucher. Campanha de teste não ativa em produção; campanha real não ativa sem `REAL_CAMPAIGNS_ENABLED=true`.
- Sem CPF/telefone/e-mail/localização. Referência de conta guardada como HMAC + dica dos 3 últimos caracteres.

---

## Briefing original do pacote
Pacote de briefing para desenvolver um web app 3D de quiz gastronômico no estabelecimento, com brinde e resgate controlado.

### Como usar
1. Extraia os documentos na pasta do projeto que você já criou. Não mova nem substitua seus assets. Compare arquivos homônimos antes de incorporar.
2. Inicie o Claude Code nessa pasta e envie o texto de PROMPT-INICIAL.md.
3. O Claude deve inventariar os assets existentes, ler AGENTS.md/CLAUDE.md e os documentos antes de implementar.
4. Desenvolver por etapas locais, com testes e revisão visual. Não publicar sem autorização.

### Arquivos
AGENTS.md: contrato de execução; CLAUDE.md: entrada do Claude; PROMPT-INICIAL.md: mensagem pronta; docs/01 a 11: produto, 3D, UX, arquitetura, brindes, operação, validação, pesquisa, assets e aceite; content/questions.seed.json: 32 perguntas; config/campaign.example.json: exemplo desativado de campanha; VALIDACAO-DO-PACOTE.md: conferência documental.

### O que já está decidido como proposta
Conceito Da massa ao forno. Oito perguntas; quatro de pizza napolitana, duas de cozinha italiana e duas de café/sobremesas. Cena 3D com pizza evoluindo sobre uma bancada italiana e forno ao fundo. Brinde por conclusão de partida autorizada, sem sorteio ou prêmio variável por acerto. Replay livre em demonstração não gera novos brindes.

### O que precisa de decisão do restaurante
Brinde e quantidade, período, validade, unidade de participação e roteiro da equipe. Default técnico: um convite por conta/comanda, gerado pela equipe. Isso é uma proposta operacional, não uma decisão atribuída ao cliente. Nome, textos de oferta e marca final precisam ser confirmados antes de ativar campanha real.

### Limites desta entrega (do pacote)
São documentos e dados iniciais, não um app implementado. Os assets da pasta local do usuário não foram inspecionados pelo autor deste pacote. O Claude deverá fazer essa inspeção no ambiente em que desenvolver. Conferência estrutural dos dados não é revisão visual do aplicativo nem aprovação editorial da marca.

### Atualização de identidade
Leia docs/11-IDENTIDADE-E-RECONHECIMENTOS.md: AVPN nº 1166, categoria Excellent Pizzerias 2026 e aplicação da identidade observada na peça enviada. Pasta local informada: mateiriais/ (a pasta real encontrada é `materiais/` — ver docs/ASSETS.md). Este pacote atualizado substitui o anterior; se o desenvolvimento já começou, incorporar as mudanças de contexto sem reiniciar ou sobrescrever código.
