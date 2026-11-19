// Eventos operacionais. Nunca registrar tokens, códigos ou referência de conta em claro.
export function audit(client, event, f = {}) {
  return client.query(
    `INSERT INTO audit_events (event, operator_id, campaign_id, session_id, voucher_id, details)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [event, f.operatorId ?? null, f.campaignId ?? null, f.sessionId ?? null, f.voucherId ?? null, f.details ?? {}],
  );
}
