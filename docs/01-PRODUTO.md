# Produto — Da massa ao forno

## Proposta
Web app para clientes da Gio Pizzeria: oito descobertas sobre gastronomia italiana acompanhando o preparo cenográfico de uma pizza napolitana. A experiência aproveita espera à mesa, cria conversa e termina com um brinde quando houver convite e campanha válidos. Nome proposto: Gio — Da massa ao forno. Não usar Passaporte do Japão nem elementos do outro projeto.

## Diferencial
Cada resposta completa uma etapa visível: panetto na bancada, massa aberta, molho, mozzarella, folhas, pala, forno e pizza pronta. Acerto e erro alteram feedback e score, não estragam a pizza nem excluem do brinde. Não afirmar que essa sequência ilustrativa é demonstração técnica exata da cozinha da Gio.

## Partida
Oito perguntas: pizza, cozinha, pizza, dolci, pizza, cozinha, pizza, dolci. Categorias: pizza (4), cucina (2), dolci (2). Quatro alternativas por pergunta, uma correta; 100 pontos por acerto, máximo 800. Duração estimada dois a três minutos, sem limite de tempo ou ranking.
Após responder, bloquear novas respostas, mostrar correta e explicação, avançar manualmente. Perguntas não se repetem por ID ou topicGroup na mesma partida. Alternativas por ID; nunca corrigir pelo índice depois de sortear. Banco inicial de 32: 16/8/8. Famílias semelhantes excluídas na mesma partida.
Servidor monta e persiste a partida autorizada; cliente não escolhe perguntas nem score. Demo pode usar banco local e RNG injetável. Priorizar perguntas não vistas quando possível na demo; não prometer que duas pessoas nunca verão a mesma pergunta.

## Brinde: default de produto proposto
Brinde fixo por conclusão, sem nota mínima ou sorteio. Unidade proposta: uma conta/comanda autorizada pela equipe = um convite = uma partida premiável = um voucher. Um grupo pode responder junto no mesmo celular. Rejogar não multiplica recompensa.
Se o restaurante preferir regra por pessoa ou nota mínima, tratar como mudança explícita de regra, operação e comunicação; não habilitar silenciosamente. Não usar tempo, aleatoriedade ou share como critério de elegibilidade.

## MVP
Abertura, partida, feedback, resultado, modo demo, campanha real com reserva e convite, voucher, painel mínimo da equipe, estoque/validades, resgate único, logs operacionais e modo leve visual.
Fora: delivery, pagamento, integração POS, cadastro de clientes, ranking público, multiplayer sincronizado, IA em tempo real, cupons compráveis, roleta, realidade aumentada e PWA offline completa.

## Métricas mínimas
Contadores operacionais agregados: convites, partidas concluídas, reservas ativas, vouchers e resgates. Sem marketing analytics por padrão. Não coletar respostas com dados pessoais nem vincular comanda a nome de consumidor.
