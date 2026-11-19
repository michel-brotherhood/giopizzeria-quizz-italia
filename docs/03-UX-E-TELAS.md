# Telas e linguagem

## Entrada
Título Da massa ao forno. Apoio Oito perguntas, uma viagem pelos sabores da Itália. Sem campanha válida: Jogar para descobrir. Com campanha/convite: mostrar nome exato do brinde reservado e regras recebidas do servidor antes de começar. Não usar Ganhe uma pizza: a pizza da cena é cenográfica, não o prêmio prometido.
Botões Começar e Como funciona. Controle Modo leve. Acesso de funcionário em rota própria, sem senha em JS.
QR de mesa abre landing pública; convite individual fornecido pela equipe autoriza a partida com recompensa. Sem convite, mostrar Peça à equipe seu acesso para participar com brinde e permitir demo identificada.

## Partida
Pergunta X de 8, categoria, progresso textual e cena. Quatro botões com alvo >=44x44 px e foco visível. A pergunta mais longa deve caber por scroll natural, sem truncar alternativas. Feedback Boa! Você acertou ou Mais um sabor para descobrir, correta e explicação. Próxima pergunta; na última Ver minha pizza.
Spinner/estado enviando impede cliques duplicados. Sem rede: manter seleção pendente e tentar novamente com mesma chave de idempotência; nunca avançar assumindo aceite do servidor. Demo continua sem emissão de voucher.

## Resultado
Pizza pronta e Você acertou X de 8. Mensagem A melhor parte é descobrir junto. Exibir status do brinde a partir da API: disponível, entregue, expirado ou cancelado. Enquanto resposta final incerta: Estamos conferindo sua conclusão, com reconsulta, sem criar novo pedido.
Brinde válido: nome/quantidade, condições, horário limite local e QR/código para a equipe. Instrução Mostre esta tela à equipe. Compartilhamento, se existir, compartilha somente score e URL pública, nunca código do brinde.
Depois de resgatado, mostrar Entrega confirmada e hora recebida do servidor. Recarregar mantém estado. Replay em demo explicitamente não emite outro brinde.

## Voucher
Não incluir botão cliente Resgatar que finalize a entrega. QR é credencial a ser apresentada, não prova de entrega. Oferecer código digitável para equipe em caso de câmera indisponível. Reservas e expiração informadas pelo relógio do servidor; relógio local não decide validade.

## Equipe
Login; campanha atual; disponibilidade; criar convite com referência opaca de conta; consultar voucher via QR ou código; conferir nome do brinde e confirmar entrega com ação explícita. Separar CONSULTAR de CONFIRMAR: abrir link ou ler QR por GET jamais consome o voucher.
Confirmar abre resumo e botão Confirmar entrega. Mostrar claramente já entregue, expirado, inválido, cancelado ou sem conexão. Não aceitar screenshot como única validação. Registrar operador e horário. Listas não exibem tokens completos; código só quando necessário ao fluxo.

## Acessibilidade
Texto real no DOM; canvas decorativo aria-hidden. Contraste AA nas cores efetivas, teclado, zoom 200%, safe areas, reduced-motion e feedback por texto/ícone além de cor. Compartilhamento cancelado não é erro. Mensagens objetivas sem culpar cliente por falha de estoque/rede.
