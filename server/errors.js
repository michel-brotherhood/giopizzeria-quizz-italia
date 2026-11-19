export class AppError extends Error {
  constructor(code, status, message, extra) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

// Mensagens seguras e objetivas, sem culpar o cliente.
const M = {
  CAMPAIGN_DISABLED: [409, 'Não há campanha com brinde ativa no momento.'],
  CAMPAIGN_PAUSED: [409, 'A campanha está pausada. Fale com a equipe.'],
  CAMPAIGN_NOT_STARTED: [409, 'A campanha ainda não começou.'],
  CAMPAIGN_ENDED: [409, 'A campanha está encerrada ou sem tempo suficiente para uma partida.'],
  OUT_OF_STOCK: [409, 'Os brindes desta campanha estão esgotados no momento.'],
  INVITATION_INVALID: [404, 'Convite não reconhecido. Peça um novo acesso à equipe.'],
  INVITATION_EXPIRED: [410, 'Este convite expirou. Peça um novo acesso à equipe.'],
  INVITATION_CANCELLED: [410, 'Este convite foi cancelado pela equipe.'],
  INVITATION_USED: [409, 'Esta conta já participou desta campanha.'],
  SESSION_REQUIRED: [401, 'Partida não encontrada neste aparelho.'],
  SESSION_EXPIRED: [410, 'O tempo desta partida terminou.'],
  SESSION_CANCELLED: [410, 'Esta partida foi cancelada pela equipe.'],
  SESSION_COMPLETED: [409, 'Esta partida já foi concluída.'],
  SESSION_INCOMPLETE: [409, 'Ainda faltam perguntas para concluir a partida.'],
  QUESTION_OUT_OF_ORDER: [409, 'Esta não é a pergunta atual da partida.'],
  INVALID_OPTION: [400, 'Alternativa inválida.'],
  ANSWER_CONFLICT: [409, 'Esta pergunta já foi respondida com outra alternativa.'],
  IDEMPOTENCY_CONFLICT: [409, 'Chave de repetição usada com outro conteúdo.'],
  IDEMPOTENCY_KEY_REQUIRED: [400, 'Cabeçalho Idempotency-Key obrigatório.'],
  VOUCHER_NOT_FOUND: [404, 'Código não encontrado.'],
  VOUCHER_EXPIRED: [410, 'Este brinde expirou.'],
  VOUCHER_CANCELLED: [410, 'Este brinde foi cancelado.'],
  ALREADY_REDEEMED: [409, 'Este brinde já foi entregue.'],
  UNAUTHENTICATED: [401, 'Faça login para continuar.'],
  FORBIDDEN: [403, 'Sua função não permite esta ação.'],
  CSRF_FAILED: [403, 'Sessão de segurança inválida. Recarregue a página.'],
  BAD_REQUEST: [400, 'Requisição inválida.'],
  INVALID_CREDENTIALS: [401, 'Usuário ou senha incorretos.'],
  RATE_LIMITED: [429, 'Muitas tentativas. Aguarde um pouco e tente de novo.'],
  CAMPAIGN_INCOMPLETE: [422, 'Campanha incompleta para ativação.'],
  REAL_CAMPAIGNS_LOCKED: [403, 'Ativação de campanha real bloqueada neste ambiente (REAL_CAMPAIGNS_ENABLED desligado).'],
  TEST_CAMPAIGN_IN_PRODUCTION: [403, 'Campanha de teste não pode ser ativada em produção.'],
  ANOTHER_CAMPAIGN_ACTIVE: [409, 'Já existe outra campanha ativa.'],
  STOCK_BELOW_COMMITTED: [409, 'O estoque não pode ficar abaixo do já reservado/entregue.'],
  CAMPAIGN_NOT_FOUND: [404, 'Campanha não encontrada.'],
  INVALID_STATE: [409, 'Operação não permitida no estado atual.'],
  NOT_FOUND: [404, 'Não encontrado.'],
};

export function err(code, extra, message) {
  const [status, msg] = M[code] ?? [500, 'Erro interno.'];
  return new AppError(code, status, message ?? msg, extra);
}
