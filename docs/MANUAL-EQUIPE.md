# Manual da equipe — Da massa ao forno (1 página)

> Enquanto a campanha real não for aprovada, o painel mostra apenas a campanha **[TESTE]**. Nada emitido nela tem valor.

## Antes do turno
1. Abra **`/equipe/`** no celular/tablet do salão e entre com **seu** usuário e senha (cada pessoa tem o seu; não compartilhe).
2. Confira o quadro **Campanha**: estado *Ativa*, nome do brinde e **Disponível** maior que zero.

## Liberar um convite (1 por conta/comanda)
1. Aba **Convite** → digite só o **número/código da comanda** (ex.: `0423`, `MESA 12`). Nunca nome, CPF ou telefone.
2. **Gerar convite** → o cliente escaneia o QR com a câmera do celular.
3. Mensagens:
   - *Convite criado* — normal.
   - *Já tinha um convite não usado* — saiu um link novo; o anterior parou de valer.
   - *Já está jogando ou concluiu* — o link **retoma a mesma partida** (útil se o cliente fechou o navegador). Não gera outro brinde.
   - *Esta conta já participou* — a partida dessa conta expirou ou foi cancelada; não há nova participação.
   - *Esgotado / pausada / sem campanha* — não há brinde para liberar agora; o cliente pode jogar a demonstração.

## Conferir e entregar o brinde
1. O cliente mostra a tela **Brinde Gio** com QR e código (`XXXXX-XXXXX`).
2. Aba **Conferir brinde** → **Ler QR com a câmera** ou digite o código → **Consultar**.
   *Consultar não entrega nada.*
3. Confira: estado **Disponível para entrega**, nome do brinde, **conta** (últimos dígitos) e validade.
4. **Confirmar entrega…** → leia o resumo → **Confirmar entrega**. Só então entregue o item.
5. Se aparecer:
   - **Já entregue** (com horário e quem entregou) → não entregue de novo.
   - **Expirado / Cancelado** → não entregue; política de exceção é decisão da gerência, fora do app.
   - **Sem conexão** → a entrega **não** foi confirmada. Consulte de novo quando a rede voltar.
   - **TESTE — SEM VALOR DE RESGATE** → é um teste; não entregue produto.

## Não fazer
- Não aceitar **print/foto** como única prova: sempre consultar no painel.
- Não gerar convite para “outra pessoa da mesma mesa” na mesma comanda: a regra proposta é 1 convite por conta.
- Não anotar códigos ou links em papel/grupo de mensagens.

## Gerente
Aba **Gerenciar**: criar campanha (nasce desativada), ajustar estoque (nunca abaixo do já reservado/emitido), ativar, pausar (bloqueia novos convites e inícios, preserva quem já está jogando e brindes emitidos) e encerrar. Campanha **real** só ativa quando o servidor tiver `REAL_CAMPAIGNS_ENABLED=true`, decisão do responsável.
