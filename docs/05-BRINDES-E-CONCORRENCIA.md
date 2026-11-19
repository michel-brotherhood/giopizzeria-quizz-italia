# Brindes — contrato do servidor

## Decisão e limite
Proposta: o mesmo brinde para cada partida autorizada concluída, independente de nota. Oferta só fica ativa após o restaurante definir item, quantidade, estoque, datas e regras públicas. Campanha real começa disabled. Item fictício em testes é isolado, marcado DEMONSTRAÇÃO — SEM VALOR DE RESGATE.
Não usar frase enquanto durarem os estoques para cancelar retrospectivamente uma recompensa já reservada. Verificar disponibilidade e reservar uma unidade ANTES de confirmar ao cliente a partida com brinde.

## Caminho feliz
1. Equipe autenticada cria convite para conta válida; unicidade por campanha/conta.
2. Cliente troca convite por sessão através de POST idempotente. Em transação, bloquear campanha/convite, conferir datas/estoque, criar uma sessão e reservar uma unidade. Mesmo convite retomado devolve mesma sessão, não faz nova reserva.
3. Servidor sorteia oito perguntas e persiste ordem. Recebe uma resposta por pergunta em sequência e retorna feedback. Não aceitar resposta de pergunta fora da sessão.
4. Na conclusão, transação bloqueia sessão/reserva, confirma oito respostas válidas, converte a reserva em voucher único e registra snapshot da recompensa. Repetir conclusão retorna o mesmo voucher. Nunca deduzir estoque duas vezes.
5. Equipe consulta voucher sem consumi-lo. POST de confirmar entrega muda issued -> redeemed atomicamente e registra operador. Dois operadores simultâneos: somente um confirma nova entrega; outro recebe já entregue.

## Contabilidade e invariantes
available = totalStock - reservedCount - awardedCount.
awardedCount inclui vouchers issued e redeemed, ainda comprometidos; redeemedCount é subconjunto de awardedCount, nunca deve ser subtraído novamente para calcular available.
Reserva de sessão: reservedCount +1. Conversão: reservedCount -1, awardedCount +1. Resgate: redeemedCount +1, sem outra baixa.
Reserva expirada: reservedCount -1 uma vez. Voucher issued expirado/cancelado sem entrega: awardedCount -1 uma vez. Voucher redeemed não volta ao estoque automaticamente. Nunca cancelar ou expirar redeemed para recompor estoque.
Exigir 0 <= redeemedCount <= awardedCount e reservedCount + awardedCount <= totalStock. Bloqueios de linhas e constraints; não fazer read-modify-write só no JavaScript.

## Validades
Valores de estudo: convite 30 min, sessão com reserva 20 min, voucher 60 min, todos configuráveis e visíveis. Implementar timestamps em UTC e exibir America/Sao_Paulo. Ao iniciar, expiração da sessão é min(agora + sessionTtl, campaign.endsAt); voucher expiresAt = min(conclusão + rewardTtl, campaign.endsAt). Não iniciar se janela restante insuficiente para experiência mínima configurada.
Rotina de expiração periódica e checagem lazy em endpoints críticos, com atualizações condicionais idempotentes. Corrida completar/expirar usa mesmos bloqueios. Se expiração venceu, não emitir voucher nem reaproveitar reserva liberada. Não depender do cliente aberto para liberar estoque.

## Estados
Convite: created -> exchanged ou expired/cancelled.
Sessão: active -> completed ou expired/cancelled; reservationState reserved -> converted/released.
Voucher: issued -> redeemed ou expired/cancelled. Estados terminais não voltam sem operação administrativa explícita e auditada; não é escopo permitir reset manual indiscriminado.
Pausar campanha bloqueia novos convites/inícios, mas preserva sessões e vouchers existentes até sua validade. Encerrar vendas de participação não invalida entrega já autorizada. Documentar encerramento e liquidação operacional separadamente do botão de pausa.

## Falhas e abuso
Cookie apagado não cria nova elegibilidade: convite já trocado tem uma sessão única. Se recuperação segura falhar, equipe consulta a conta e pode cancelar sessão antiga, liberar reserva e reemitir acesso auditado sem gerar voucher adicional; definir esse fluxo antes de expor ferramenta de recuperação.
Foto/QR pode ser compartilhado; token é credencial de portador. Atendimento confere conta associada e status no painel; não prometer vinculação biométrica nem um brinde por pessoa física. Geolocalização e IP não provam presença.
Em falha de rede, não entregar com base só na animação/screenshot; política de exceção comercial da equipe é externa ao app. Nunca concluir resgate offline silenciosamente.

## Estoque e campanha
Alteração de totalStock não pode ficar abaixo do comprometido. Oferta versionada não muda nome/quantidade de voucher emitido. A edição não retroage snapshots. Criação/ativação de campanha exige campos completos, estoque positivo, período válido e regras públicas; ausência impede ativação com erro explicativo.
