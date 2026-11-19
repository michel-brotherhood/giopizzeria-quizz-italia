# Operação e API de referência

## Operação proposta no salão
QR de mesa abre o jogo. Funcionário libera um convite por conta/comanda usando painel. Cliente responde junto com sua mesa ou individualmente no mesmo dispositivo. Ao finalizar, apresenta voucher; equipe consulta, confirma e entrega o item configurado. Brinde, horários, consumo mínimo e validade ainda não foram definidos pelo responsável; não presumir consumo mínimo.
Preparar manual de uma página para equipe, com criação de convite, consulta, confirmação e erros comuns. Não integrar caixa nesta etapa. A referência de conta é fornecida manualmente e deve ser única dentro da campanha; reabertura de comanda não deve criar nova elegibilidade automaticamente.

## API proposta
GET /api/campaign/current: oferta pública e disponibilidade, sem credenciais.
POST /api/player/exchange: troca de convite por sessão; reserva e idempotência.
GET /api/player/session: estado da sessão autenticada, pergunta atual e progresso.
POST /api/player/session/answer: questionId, selectedOptionId e chave idempotente; servidor decide validade/score.
POST /api/player/session/complete: gera ou retorna voucher da sessão concluída.
GET /api/player/voucher: status do voucher pertencente à sessão; sem exposição pública por ID sequencial.
POST /api/staff/login e logout: sessão de equipe; rate limit em login.
POST /api/staff/invitations: campanha e referência opaca de conta, operador autenticado.
POST /api/staff/vouchers/lookup: token/código no corpo, retorna consulta sem mudar status.
POST /api/staff/vouchers/redeem: confirma entrega com autenticação/CSRF e idempotência.
Rotas de gestão mínima de campanha para gerente: configurar, ativar, pausar e consultar totais. Atendente cria convite/consulta/entrega, não altera oferta/estoque.

## Contratos comuns
Erros com código estável e mensagem segura: CAMPAIGN_DISABLED, OUT_OF_STOCK, INVITATION_EXPIRED, SESSION_EXPIRED, ANSWER_CONFLICT, ALREADY_REDEEMED, VOUCHER_EXPIRED, RATE_LIMITED. Retornar estado canônico em repetição idempotente. Idempotency-Key vinculado a operador/sessão + rota + hash do payload: mesma chave com payload diferente deve retornar conflito. Chave não é autorização.
Não colocar token do voucher em query string da API ou log. Se câmera lê uma URL, extrair token no cliente e enviar por POST; configurar página de apresentação sem terceiros e redigir logs do reverse proxy. Avaliar fragmento para evitar transmissão automática do token no GET.

## Decisões pendentes
Item e quantidade do brinde; estoque por campanha; validade; unidade de participação; equipe responsável; credenciais individuais; período; domínio; hospedagem; regras públicas aprovadas. Desenvolvimento usa mock de oferta visual em demo e campanha de teste isolada, sem inventar promoção real.
