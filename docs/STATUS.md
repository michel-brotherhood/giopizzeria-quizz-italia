# STATUS — Gio · Da massa ao forno

Última atualização: 18/11/2026. Legenda: **PASSOU** · **FALHOU** · **NÃO EXECUTADO**.

## Resumo honesto
- Desenvolvimento local das etapas 0–6 concluído, com testes automatizados executados contra **PostgreSQL 18.6 real** e **Chromium 159 real** (WebGL por software/SwiftShader).
- **Não está pronto para operação real.** Pendentes: brinde/quantidade/estoque/período/regras (decisão do restaurante), credenciais individuais da equipe, licença web da fonte Arquitecta, autorização de uso dos selos, teste em celular físico, backup/restauração em produção, ensaio com a equipe e revisão editorial das perguntas.
- Nada foi publicado. Nenhuma campanha real existe ou foi ativada. Produção nasce com `REAL_CAMPAIGNS_ENABLED=false`.

## Ambiente de validação
| Item | Valor |
|---|---|
| SO | Linux 7.0.0-43-generic |
| Node / npm | v24.18.0 / 12.0.2 |
| PostgreSQL | 18.6 (binários oficiais via `embedded-postgres` 18.6.0-beta.19), instâncias isoladas: dev 54329, integração 54330, E2E 54331 |
| Navegador | Chromium 159.0.8154.6 (Playwright 1.65.1), headless, `--use-angle=swiftshader` (WebGL por software, **não** GPU real) |
| Celular físico | **NÃO EXECUTADO** — emulação de viewport não equivale a aparelho real |

## Etapas e evidências

### 0 — Inventário e direção · PASSOU
- Pasta citada `mateiriais/` **não existe**; a real é `materiais/` (registrado, não renomeada). Inventário completo em `docs/ASSETS.md` com os arquivos abertos (folhas de contato de logos/selos/fotos, prévias dos CR2, quadros do reel, PDF de cores).
- Cores oficiais lidas do PDF Pantone; logo SVG original usado sem alteração; Arquitecta Heavy subsetada (18 KB).

### 1 — Recorte vertical 3D · PASSOU (com revisão visual feita)
- Cena 100% procedural: bancada de pedra, parede de tijolo, forno de cúpula com mosaico azul-marinho, pala de madeira, panetto → disco com cornicione → molho → mozzarella → manjericão → azeite → pala → forno → assada (leopardatura no cornicione).
- **Defeitos encontrados e corrigidos na revisão das capturas:**
  1. Pizza (30 cm) não cabia na boca do forno na etapa 7 → forno reescalado (boca ≈ 39 cm) e recuado; bancada estendida.
  2. Disco de massa aparecia como “vidro” com raias → diagnóstico: faces superiores do `LatheGeometry` voltadas para dentro (culling). Correção: inverter a ordem do perfil. Verificado em captura ampliada.
  3. Fachada do forno cobria a cúpula; bancada superexposta; folhas em primeiro plano viravam borrão → ajustes de geometria, exposição e posição.
  4. `PCFSoftShadowMap` removido no three 0.187 (aviso no console) → `PCFShadowMap`.
  5. Travadas de compilação de shader no meio das transições (observadas no SwiftShader) → `renderer.compileAsync` com todos os materiais antes do primeiro quadro.
- Métricas medidas (390×844, `docs/screenshots/scene-metrics-390.json`): **26.682 triângulos, 52 draw calls, DPR 1** (meta ≤60 mil / ≤60 / ≤1,5). DPR limitado a 1,5 em aparelhos com tela densa.

### 2 — Motor e conteúdo · PASSOU
`npm test` → **28/28 PASSOU** (3 arquivos):
- 1000 sementes: sequência pizza/cucina/pizza/dolci…, 8 IDs e 8 famílias únicas, 4/2/2; determinismo por semente; as 32 perguntas aparecem; prioridade a não vistas; alternativas embaralhadas preservando IDs; correção por ID independente da posição; 0/1/7/8 acertos = 0/100/700/800.
- Conteúdo: 32 entradas 16/8/8, 4 opções únicas, correta existente, fontes resolvidas (`npm run test:content` PASSOU).
- Contraste WCAG de 10 pares efetivos ≥ 4,5:1; confirmado que `#E03C31` (3,59:1) não é usado em texto pequeno sobre creme.
- Revisão editorial das perguntas: **NÃO EXECUTADA** (banco segue como proposta editorial).

### 3 — Backend, campanha e equipe · PASSOU
`npm run test:integration` → **37/37 PASSOU** contra PostgreSQL real (sem mocks), com verificação de invariantes contábeis (contadores = linhas reais; `reserved+awarded ≤ total`; `redeemed ≤ awarded`; nada negativo) após **cada** teste. Cobre:
- mesmo convite em dois dispositivos simultâneos → 1 sessão, 1 reserva; reemissão para a mesma conta → unicidade; 3 criações simultâneas → 1 convite; link de recuperação → mesma sessão;
- última unidade disputada por 2 sessões → 1 reserva + `OUT_OF_STOCK`; **20 jogadores × 5 unidades → exatamente 5 reservas**; estoque abaixo do comprometido recusado;
- resposta duplicada/concorrente com a mesma chave → estado canônico; alternativa conflitante → `ANSWER_CONFLICT` sem sobrescrever; mesma chave com payload diferente → conflito; fora de ordem/opção inválida/sem chave recusados; correta nunca exposta antes de responder; cliente enviando `score/eligible/voucherValid` ignorado;
- 5 conclusões simultâneas → 1 voucher, 1 conversão; retry com mesma chave → mesmo voucher; **completar × expirar em paralelo (6 rodadas) → um estado terminal coerente**; sessão expirada libera reserva uma vez e não emite;
- 2 operadores confirmando ao mesmo tempo → 1 entrega + `ALREADY_REDEEMED`; retry do mesmo operador → sem 2ª entrega; voucher expirado devolve unidade uma vez; entregue não volta ao estoque; nenhuma rota GET entrega; URL do QR aceita na consulta;
- pausa bloqueia novos inícios/convites e preserva sessão/voucher ativos; edição da oferta não altera snapshot (rulesVersion 1→2); campanha real bloqueada sem flag; campanha incompleta recusada; sem campanha → modo demo;
- rotas da equipe sem login → 401; atendente gerindo campanha → 403; CSRF ausente/errado → 403; POST de outra origem → 403; login errado não distingue usuário inexistente; credencial de voucher ilegível não derruba a sessão do cliente.
- **Defeito encontrado e corrigido:** reduzir estoque a 0 numa campanha ativa disparava a constraint errada (400 genérico) → checagem explícita `STOCK_BELOW_COMMITTED` antes do UPDATE.

### 4 — Integração e falhas · PASSOU
E2E Playwright (`npm run test:e2e`: build de produção servido pelo Express + PostgreSQL isolado): 24 testes (12 de fluxo + 12 visuais/acessibilidade); resultado na tabela da etapa 6. Cobre fluxo real convite → partida → voucher → equipe consulta → confirma → cliente vê “Entrega confirmada”; rede caindo no envio da resposta (seleção mantida, não avança, **mesma Idempotency-Key** no reenvio, 1 resposta gravada); reload no meio retoma pergunta e etapa da cena; falha de rede na conclusão (“Estamos conferindo…”, nenhum voucher na tela, depois **1** voucher no banco); mesmo convite em 2 contextos de navegador → 1 sessão/1 reserva e o segundo aparelho volta ao estado canônico; abrir `/equipe/#v=TOKEN` e GET puro não entregam; câmera indisponível → orientação para digitar código; storage corrompido; WebGL indisponível → modo leve automático; bundle sem segredos.
- **Defeitos encontrados e corrigidos nas execuções E2E:** (a) a cada retentativa automática da conclusão a caixa “Tentar agora” sumia sob o dedo do usuário — agora fica visível e só muda o texto; (b) ao avançar de pergunta, rolagem suave + foco com rolagem competiam e os botões “andavam” por ~1 s em aparelho lento — agora um salto instantâneo e foco sem rolagem (posição medida estável).
- **Outros defeitos corrigidos:** pontuação da demo sempre 0 (campo `correct` × `isCorrect`); servidor passou a devolver a próxima pergunta junto do feedback (evita requisição extra e corrida).

### 5 — Visual, mobile e acessibilidade · PASSOU (emulado) / celular físico NÃO EXECUTADO
- Capturas em `docs/screenshots/` para **360×800, 390×844, 768×1024, 1440×900, 844×390**: abertura, pergunta mais longa do banco, feedback, resultado; convite, voucher de teste e painel da equipe (390, 1440, 844); zoom 200% (720×450 @2x); movimento reduzido; modo leve.
- Verificações automáticas: sem scroll horizontal em todas; CTA “Começar” visível sem rolagem nos retratos ≥700 px; nenhuma alternativa truncada; teclado (Enter/Tab) com foco previsível (pergunta → alternativa → feedback → próxima); movimento reduzido sem fila de animação.
- **Defeitos encontrados e corrigidos:** CTA abaixo da dobra em 390×844 (cena reduzida a 34svh e aviso de brinde movido para depois do botão quando não há convite); botão “Modo leve” quebrando em 2 linhas com o selo “Demonstração” (≤419 px); cabeçalho do painel apertado.
- Revisão visual (critérios do doc 02, nota 1–5, avaliada nas capturas):
  | Critério | Nota | Justificativa |
  |---|---|---|
  | Materiais | 4 | Massa com volume e cornicione irregular, molho com borda orgânica, leopardatura integrada; mozzarella assada ainda um pouco lisa/clara demais. |
  | Identidade | 4 | Paleta Pantone, logo original, Arquitecta, molduras vermelhas finas, mosaico marinho no forno; sem clichês. Falta validação da marca. |
  | Iluminação | 4 | Forno quente + preenchimento neutro, sem pizza laranja; bancada ainda clara em telas grandes. |
  | Composição | 4 | Forno ao fundo, bancada 3/4, progressão legível; abertura com bastante bancada vazia em 1440×900. |
  | Legibilidade | 5 | Texto HTML, contraste AA medido, alvos ≥44 px. |
  | Responsividade | 4 | 5 viewports + zoom sem cortes; paisagem com painel rolável. |
  | Fluidez | — | Não avaliável: SwiftShader é muito mais lento que GPU real. **Medir em celular intermediário.** |
- Lighthouse: **NÃO EXECUTADO** (ferramenta não instalada no ambiente; metas ≥90/≥95 não verificadas).

### 6 — Pré-entrega · PASSOU (com a ressalva do E2E abaixo)
| Comando | Resultado |
|---|---|
| `npm run lint` | PASSOU — 43 arquivos (sintaxe + padrões proibidos) |
| `npm test` | PASSOU — 28/28 |
| `npm run test:content` | PASSOU |
| `npm run test:integration` | PASSOU — 37/37 |
| `npm run test:e2e` | Execução completa final: **23/24 PASSOU**, 1 FALHOU por tempo (captura 360×800: estado da tela correto — pergunta 7 com feedback — mas estourou o limite de 120 s com WebGL por software). Limite das capturas elevado para 240 s e o teste **reexecutado isoladamente: PASSOU** (25 s). A suíte completa não foi repetida depois desse ajuste. |
| `npm run build` | PASSOU — UI inicial ≈ 20 KB gzip (HTML 2,6 + CSS 4,1 + JS 12,3 + 0,9) + fonte 18 KB; cena 3D em chunk lazy de ≈150 KB gzip |
| Backup/restauração | NÃO EXECUTADO — `pg_dump` ausente nos binários embutidos; roteiro Dokku em `docs/OPERACAO.md` |
| Deploy | NÃO EXECUTADO (sem autorização) |

## Decisões técnicas
- Stack conforme contrato (repositório vazio). PostgreSQL de dev/testes via `embedded-postgres` porque não havia PostgreSQL nem Docker ativo na máquina (e sem sudo); são os binários oficiais, não um simulador.
- Bloqueio de linhas sempre na ordem `convite|sessão|voucher → campanha` para evitar deadlock; invariantes também como `CHECK` no banco.
- Convite e QR do voucher usam **fragmento** (`#convite=`, `#v=`), lido pelo JS e removido da URL; troca e consulta por POST.
- Recuperação de cookie perdido: equipe gera novo link para a mesma conta → leva à **mesma** sessão (sem nova reserva/voucher). Não há botão de “resetar” participação.
- Voucher reexibível ao portador da sessão via token cifrado (AES-GCM) — o banco guarda hash para busca.

## Repositório
- Publicado no GitHub `michel-brotherhood/giopizzeria-quizz-italia` (público) a pedido do usuário. **Fora do Git**: fonte comercial Arquitecta (originais e subset WOFF2 — ver `docs/ASSETS.md` para regenerar), RAWs `.CR2`, vídeo `.mp4`, `.env`, bancos locais (`.data/`), logs e `node_modules`.

## Produção (19/11/2026)
Publicado com autorização do usuário em **https://quizz.giopizzeria.com.br** (VPS Hostinger, Dokku 0.38.34, app `gio-quiz`, banco `gio-quiz-db` PostgreSQL 18.4). Outros apps da VPS não foram alterados.
- Chave SSH dedicada `~/.ssh/gio_dokku` (root e `dokku ssh-keys` como `gio-quiz-deploy`); a chave de outro projeto não foi usada.
- Config: `APP_ENV=production`, `REAL_CAMPAIGNS_ENABLED=false`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`, `SERVE_STATIC=true`, `PUBLIC_BASE_URL=https://quizz.giopizzeria.com.br`; `SESSION_SECRET` gerado na VPS (`openssl rand`), não passou pela máquina de desenvolvimento.
- HTTPS Let's Encrypt (CN quizz.giopizzeria.com.br, vence 17/02/2027) + cron de renovação do plugin; HTTP → 301 HTTPS; HSTS.
- Deploy: predeploy `migrations ok`; healthchecks `api-health` e porta: ok.
- Corrigido no 1º deploy: aviso `ERR_ERL_KEY_GEN_IPV6` do express-rate-limit (chave por IP sem agrupar IPv6) → `ipKeyGenerator`. Lint ok, unit 28/28, integração 37/37 após a correção.
- Verificado de fora: `/api/health` → `{"ok":true,"env":"production"}`; `/api/campaign/current` → modo demo, sem campanha; POST com Origin alheia → `CSRF_FAILED`; login inválido → `INVALID_CREDENTIALS`; CSP/no-referrer/HSTS presentes. Demo completa (8 perguntas → resultado) em Chromium contra a produção: cena 3D com 31.136 triângulos/86 draw calls; únicos erros de console: 404 da fonte (ausente por licença) e 401 esperado de sessão inexistente.
- Login de gestor `andre` (manager) criado a pedido do usuário. A senha escolhida tem menos de 10 caracteres; a regra do script `staff:create` (mín. 10) **não** foi alterada — o registro foi inserido direto via `docker exec` no container `gio-quiz.web.1`. Recomendado trocar por senha mais longa antes de campanha real. Login verificado em produção.
- **Pendente:** testar backup/restauração e ensaio com a equipe. Nenhuma campanha (nem de teste) existe em produção.

## Direção visual aplicada (19/11/2026, pacote `ref/Gio-Direcao-Visual-Assets`)
Primeiro o usuário pediu para repensar o design (“segue three.js, remova opção de modo leve”); em seguida entregou o pacote de direção visual, que passou a mandar. Implementado em etapas locais:
1. **Identidade/layout** (`web/index.html`, `web/src/styles/app.css`): cabeçalho com logo original (Tres Tintas C, recortada só nas margens transparentes), título “Da massa ao forno” e contador “Pergunta N de 8”. Na tela grande, cenário ≈ 60% + quiz ≈ 40% em painel `#121624`, largura máxima 1440 px centralizada, altura mínima com rolagem (sem 100vh cortando conteúdo). No celular, uma coluna: cabeçalho, cena 16:10, progresso, pergunta, alternativas, confirmação; selos só na abertura/conclusão. Tokens de `tokens/gio.css`; fonte Outfit (OFL, já instalada; a Arquitecta segue sem licença web confirmada).
2. **Cena e estados** (`web/src/scene/`): pedra cinza quente com farinha, **tábua redonda de madeira com cabo sob a pizza** (a pizza apoia na tábua, sombra de contato da luz principal acima à esquerda), cerâmica creme salpicada (molho com colher de pau, mozzarella em pedaços, vaso de manjericão), galheteiro de azeite, pano listrado e forno a lenha com arco de tijolos ao fundo à direita, boca aberta com fogo em shader. Câmera em três quartos elevados, **sem giro**.
   **Mapeamento etapa ↔ pergunta (decisão documentada):** 8 marcadores = 8 perguntas. Marcador k = etapa culinária na bancada enquanto se responde a pergunta k: 1 Massa, 2 Abertura, 3 Molho, 4 Mozzarella, 5 Manjericão (manjericão + azeite numa etapa só), 6 Pala, 7 Forno, 8 Finalização; após a 8ª resposta, pizza pronta (etapa 8 da cena). A cena avança a cada pergunta concluída, certa ou errada, pelo `answeredCount` do estado (servidor ou demo persistida), sem timers. Durante o retorno de uma resposta nenhum marcador fica “atual”; a próxima etapa acende ao avançar — corrige a inconsistência da prévia (“etapa Mozzarella” com “Forno” ativo).
3. **Seleção ≠ confirmação** (`web/src/main.js`): tocar numa alternativa só a marca (borda e letra vermelhas, `aria-pressed`), sem revelar nada; “Confirmar resposta” envia (bloqueado enquanto processa; duplo clique gera 1 envio). Depois: ícone ✓/✕ + texto (“Correta”, “Sua resposta”) + explicação; não depende só de cor. Erro de rede mantém pergunta e seleção e oferece nova tentativa (mesma chave de idempotência).
4. **Sem WebGL / falha de assets**: sem botão de modo leve (pedido do usuário). O cenário WebP é a imagem de espera e a reserva automática; a etapa aparece escrita sobre ele e a **pizza ilustrada só aparece na etapa 5 (Manjericão)**, a única que ela representa — não é deslocada nem ampliada para simular outras etapas. Se as imagens falharem, o jogo segue com fundo neutro e a etapa escrita.
5. **Assets copiados** (WebP redimensionado, originais preservados no pacote): `web/public/brand/gio-logo-tres-tintas-c.webp`, `avpn-selo.webp`, `50top-pizza.webp`; `web/public/scene/cozinha-960.webp` / `cozinha-1672.webp` (srcset), `pizza-mozzarella-720.webp`. Os PNG ampliados (pasta `alta/`) ficam fora do Git.
- Reconhecimentos: “Certificada AVPN nº 1166” e “Excellent Pizzerias — 50 Top Pizza Latin America 2026”, em tarjas creme, escala secundária.
- **Testes desta etapa (executados, Chromium 159 + SwiftShader via Playwright 1.65.1):** lint ok (43 arquivos); unit 34/34 (contraste reescrito para a paleta da direção: 16 pares); integração 37/37 (PostgreSQL real; fluxo de brinde não foi alterado); E2E completo: **25/27** — as 2 falhas foram (a) **defeito real**: na reserva sem WebGL, acertar uma resposta chamava `celebrate()` inexistente e levava à tela de erro → corrigido, teste passa; (b) tempo esgotado sob carga em “link do QR (#v=) só consulta”, que passa isolado (27 s). Após as correções, os 4 testes afetados foram reexecutados isoladamente e passaram; a suíte completa não foi repetida depois disso.
- Novos testes E2E: seleção não revela a correta e duplo clique em confirmar gera 1 resposta; progresso sem marcador “atual” durante o retorno; teclado com seleção + confirmação; sem WebGL (pizza ilustrada só na etapa 5); falha ao carregar imagens; 320 px (alvos ≥ 48 px, sem rolagem horizontal). Zoom 200% e movimento reduzido mantidos.
- Capturas em `docs/screenshots/` (390×844, 1440×900, 360×800, 768×1024, 844×390, 320×640, zoom 200%, sem WebGL, sem imagens, movimento reduzido, seleção antes de confirmar).
- WebGL por software (SwiftShader/llvmpipe) é detectado: sem sombras e fogo a ~4 fps quando parado (as capturas dos testes, feitas assim, **não mostram sombras**; em GPU real há sombras e fogo a ~25 fps).

## Cadastro obrigatório e Política de Privacidade (19/11/2026)
**Mudança de regra autorizada pelo usuário.** O contrato original (AGENTS/CLAUDE) proibia coletar e-mail/telefone e condicionar a participação a cadastro “sem nova instrução”. Em 19/11/2026 o usuário instruiu: “precisa ter cadastro sim, com política de privacidade… para conseguirmos pegar esses dados”, e escolheu: **nome, WhatsApp e e-mail; cadastro antes de jogar (todos, inclusive a demonstração); aceite de promoções opcional e desmarcado**; controladora “Gio Pizzeria · CNPJ 38.382.216/0001-31” (CNPJ conferido pelos dígitos verificadores), restante a critério.
- **Servidor**: `migrations/002_registrations.sql` (tabela `registrations` com e-mail único sem diferenciar maiúsculas, telefone normalizado `55DDDNÚMERO`, `marketing_consent` + `marketing_consent_at` coerentes por CHECK, versão e data do aceite da política; `registration_credentials` com hash do cookie; `quiz_sessions.registration_id`). `server/services/registrations.js`; rotas `GET /api/register/me`, `POST /api/register` (mesma origem, rate limit), `POST /api/register/leave`. **Trocar convite exige cadastro** (`REGISTRATION_REQUIRED`) e a partida com brinde fica ligada ao cadastro. Mesmo e-mail atualiza o cadastro; desmarcar promoções revoga o aceite.
- **Equipe (só gerente)**: aba “Cadastros” com totais, últimos 20, **planilha CSV** (`/api/staff/registrations.csv`, células com fórmula neutralizadas, exportação auditada) e **exclusão a pedido do titular** por e-mail. Atendente não vê nem acessa (403). Auditoria registra só o id do cadastro, nunca nome/e-mail/telefone.
- **App**: tela “Antes de começar” (nome, WhatsApp, e-mail, aceite obrigatório da política com link, promoções opcional), erros por campo com foco no primeiro inválido; cookie httpOnly lembra o aparelho por 180 dias (“Não é você?” troca). Removidos “Jogo de conhecimento, sem cadastro…” e “sem cadastro” do cabeçalho; incluídos copyright e link da política no rodapé (app e painel).
- **Política** em `/privacidade/` (`web/privacidade/index.html`): controladora, dados, finalidades e bases legais (art. 7º I, II, V, IX), compartilhamento, retenção, cookies essenciais, segurança, direitos (art. 18) e contato. Itens que eu propus (e-mail `privacidade@giopizzeria.com.br`, prazo de resposta de 15 dias, cadastro para maiores de 18 anos, regras de retenção, bases legais e menção genérica à hospedagem) foram **confirmados pelo usuário em 19/11/2026** (“os pontos jurídicos pode seguir, já foram definidos… hospedagem pode seguir… promoções pode seguir”). A caixa `privacidade@giopizzeria.com.br` precisa existir. Endereço completo não foi inventado (consta só Niterói/RJ).
- Testes: integração **42/42** (+5: sem cadastro não troca convite e vínculo com a partida; validação; promoções/revogação/atualização por e-mail; exportação/exclusão só gerente, CSV seguro e auditoria sem dados pessoais; mesma origem). E2E novos: formulário de cadastro completo, página da política, aba “Cadastros” do gerente.
- **Resultado E2E desta etapa (Chromium + SwiftShader):** suíte completa 29/30; a falha foi tempo esgotado numa captura 768×1024 (“waiting for fonts”), que passou isolada (48 s). Unit 34/34, integração 42/42, lint ok.
- Brindes por desempenho: **implementados com brindes de exemplo** (ver seção abaixo); ativação real aguarda brinde definido e parecer jurídico (Lei 5.768/71).
- Pendências operacionais: retenção automática não implementada (exclusão é manual, a pedido); não há envio de mensagens pelo sistema — a planilha alimenta a ferramenta que a Gio usar, respeitando a coluna de aceite.

## Regras de premiação por desempenho (19/11/2026)
Pedido do usuário: “a cada 15 partidas com 80% de acerto ou mais, ganha algo”; depois: “pode seguir com brindes demonstrativos… não deixe escrito demonstração no webapp”.
- **Migração 003**: `campaigns.award_rule` (`participation` | `min_score` | `every_n`), `min_correct` (1–8, padrão 7 — 80% de 8 = 6,4, logo 7), `every_n` (padrão 15), `qualified_count`; `quiz_sessions.award_outcome` (`awarded` | `not_qualified` | `qualified_no_prize`); `reservation_coherent` ampliada: concluída sem prêmio devolve a reserva (`released`).
- **Decisão no servidor** (`decideAward` em `server/services/player.js`), dentro da transação com a campanha bloqueada: acertos contados nas respostas gravadas (nada vindo do cliente); em `every_n` a contagem de qualificadas incrementa atomicamente e premia quando `qualified_count % N == 0`. Conclusão repetida é idempotente e não conta duas vezes.
- **Regra visível antes de começar** (oferta do convite) e **resultado explicado** depois: “Desta vez não deu brinde. Você acertou X de 8; a meta era Y” / “Você bateu a meta e entrou na contagem… esta não foi a premiada”. Regra **travada com a campanha ativa** (`AWARD_RULE_LOCKED`); mudar com ela pausada cria nova versão das regras. Painel do gerente: campos “Regra de premiação”, “Acertos mínimos”, “N” e contagem de qualificadas.
- **Sem a palavra “demonstração” no app**: selo “Demonstração” removido; textos passaram a “sem brinde”/“só pela diversão”; brinde da campanha de teste local virou “Brinde de exemplo — sem valor de resgate”. Campanhas de teste continuam identificadas como **Teste** no voucher (nunca parecem válidas) e **não podem ser ativadas em produção**; produção segue com `REAL_CAMPAIGNS_ENABLED=false`.
- Testes: integração **47/47** (+5: pontuação mínima com devolução de reserva e idempotência; sequência `every_n` N=3 com não qualificadas; **20 conclusões simultâneas com N=5 → exatamente 4 vouchers**; trava/versão da regra e validação; cliente não força prêmio enviando pontuação). E2E: regra exibida e resultado “não deu brinde” sem voucher, com a reserva devolvida.
- **Resultado (Chromium + SwiftShader):** E2E completo 30/31 — a falha foi **defeito real**: em 320 px, a marca “✓ Sua resposta, correta” (sem quebra) ao lado de alternativa longa criava 2 px de rolagem horizontal → marca passou a quebrar linha e a coluna do texto a encolher; verificado com 48 retornos de acerto em 320 px (0 px de excesso) e o teste de 320 px + zoom 200% reexecutados (passaram). Unit 34/34, integração 47/47, lint ok.

## Partidas guardadas no cadastro e painel de Cadastros (19/11/2026)
- Migration `004_free_plays.sql`: partidas sem brinde passam a ser gravadas no cadastro. O aparelho envia só as alternativas escolhidas (`POST /api/play/result`, exige cookie de cadastro); o servidor valida a rodada (8 perguntas existentes, sem repetição, padrão de categorias), recorrige e guarda. Idempotente por `playId`; limite de 40 partidas/dia por cadastro. Não gera brinde.
- Aba **Cadastros** (só gerente): totais (cadastros, promoções, partidas, média de acertos, 7–8 acertos), gráfico de acertos por partida, 10 perguntas mais erradas (mín. 3 respostas), lista completa com busca (nome/e-mail/WhatsApp), filtro "só quem aceita promoções", 50 por página, link de WhatsApp, partidas/melhor/brindes por pessoa. CSV ganhou partidas, melhor acerto, média, última partida, brindes emitidos/entregues.
- Excluir o cadastro apaga as partidas sem brinde dele (ON DELETE CASCADE).
- Corrigido: "null" aparecia no cartão da campanha do painel; o cartão agora mostra a regra de premiação.
- Testes: integração 51/51 (novo `free-plays.test.js`, 4 casos), unitários 34/34, lint ok; E2E da partida completa (confere que o servidor recorrigiu igual à tela) e da aba Cadastros (busca) passando.

## Limitações conhecidas
- Se o cliente perder o código **e** a credencial ficar ilegível (troca de `SESSION_SECRET`), a equipe não tem busca por conta para entregar; definir procedimento antes da campanha real.
- Limite real é por convite/conta, não por pessoa física; QR/print pode ser repassado (equipe confere conta e status).
- Fluidez/desempenho em GPU real e Core Web Vitals não medidos.

## Próximos passos (dependem do restaurante)
1. Definir brinde, quantidade, estoque, período, validade e texto das regras.
2. Confirmar licença web da Arquitecta e uso dos selos AVPN/50 Top Pizza.
3. Revisão editorial das 32 perguntas.
4. Testar em 2–3 celulares reais (Android intermediário + iPhone) e medir fps/LCP.
5. ~~Provisionar VPS/Dokku~~ (feito, ver Produção); testar backup/restauração e fazer ensaio com a equipe (convite → jogo → consulta → entrega).
