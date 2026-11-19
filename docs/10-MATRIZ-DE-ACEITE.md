# Matriz de aceite

| Área | Verificação | Resultado exigido |
|---|---|---|
| Conteúdo | 32 entradas | 16/8/8, quatro opções únicas e fontes resolvidas |
| Sorteio | Sementes variadas | 8 IDs/famílias únicos e sequência 4/2/2 |
| Pontuação | 0/1/7/8 acertos | 0/100/700/800, independente da posição da opção |
| Resposta | Duplo clique/retry/conflito | Sem duplicar, sem sobrescrever aceita |
| Cena | Oito avanços com acerto/erro | Pizza evolui igualmente; score correto |
| Convite | Mesmo convite em dois dispositivos | Uma sessão e uma reserva |
| Conta | Reemissão para mesma conta | Unicidade por campanha/conta |
| Estoque | Duas sessões disputam último item | Uma reserva; nenhum contador negativo |
| Conclusão | Dois pedidos ou timeout | Um voucher e uma conversão de reserva |
| Expiração | Completar e expirar simultaneamente | Um estado terminal coerente, sem estoque duplicado |
| Resgate | Dois operadores confirmam | Uma entrega, outra resposta já entregue |
| Consulta | GET, link preview e lookup | Nenhuma entrega confirmada |
| Segurança | Cliente altera score/eligibility | Não afeta elegibilidade servidor |
| Equipe | Cliente chama rota staff | Acesso negado; segredo ausente do bundle |
| Sessão | Reload e rede intermitente | Retomada canônica, sem inventar sucesso |
| Voucher | Expirado/cancelado/entregue | Mensagem correta, sem novo resgate |
| Oferta | Edição de campanha | Voucher anterior preserva snapshot |
| Pausa | Campanha pausada | Bloqueia novos inícios; preserva direitos ativos |
| Demo | Concluir repetidamente | Nenhum brinde real |
| Gráficos | WebGL falha/context loss | Jogo e sessão continuam em modo leve |
| Acessibilidade | Teclado, zoom, movimento reduzido | Interface utilizável e foco previsível |
| Mobile | Viewports definidos | Sem cortes, sobreposição ou scroll horizontal |
| Performance | Build produção | Medidas reais e desvios documentados |
| Operação | Ensaio com equipe | Convite -> jogo -> consulta -> entrega completos |

Pronto para teste local não significa pronto para campanha real. Relatório deve explicitar testes não executados, assets provisórios e decisões comerciais pendentes. É obrigatório testar banco real para afirmar concorrência validada.
