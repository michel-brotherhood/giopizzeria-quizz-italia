# Direção visual

## Ideia central
A experiência é uma pequena visita à bancada de um pizzaiolo. Cada pergunta concluída avança o preparo da pizza. A gastronomia dá o ritmo; a interface organiza a participação com clareza. Evitar aparência de painel administrativo ou cardápio de delivery.

## Identidade
Usar o logo fornecido como imagem, com proporção preservada e sem filtros de cor. Não remontar suas letras. O logo colorido funciona sobre navy; o arquivo claro funciona em áreas escuras quando a leitura exigir. Inspecionar cada original antes de escolher. Manter um respiro mínimo equivalente a 20% da largura do símbolo em torno da marca. Esse respiro é uma recomendação deste layout, não um manual oficial da Gio.

Paleta proposta, aproximada da prévia:
| Papel | Valor |
|---|---|
| Fundo navy | #0B0E1D |
| Painel | #121624 |
| Creme principal | #F3E8CF |
| Texto secundário | #C7BEAD |
| Vermelho de ação | #D92E20 |
| Borda discreta | #756F66 |
| Sucesso após confirmação | #88C89B |

Não aplicar vermelho em todos os contornos. Reservá-lo à ação principal, seleção e progresso. A luz do forno traz os tons âmbar; eles não viram uma nova cor de interface. Validar contraste nos estados reais, incluindo disabled, hover e foco.

## Tipografia
O logo continua sendo o asset original. Para a UI, iniciar com uma sans legível de boa presença, usando a fonte licenciada já instalada no projeto. Na ausência, usar system-ui. Não alegar ter identificado a fonte exata da prévia. Títulos com peso 650–750, corpo com 400–500 e opções com 550–650. Pergunta: cerca de 30–38px desktop e 23–28px mobile, com quebra natural. Corpo: 16–18px. Evitar textos pequenos sobre a cena.

## Layout desktop
Cabeçalho compacto com logo à esquerda, título e contador de perguntas à direita. Área principal: cenário amplo à esquerda e quiz sólido à direita. Painel com largura confortável para quatro alternativas, confirmando a seleção em botão separado. Limitar a aplicação a aproximadamente 1440px e centralizar em telas maiores; usar altura mínima, permitindo rolagem em janelas baixas. Não fixar tudo em 100vh com conteúdo cortado.

Na implementação, não reproduzir a carcaça de notebook ou celular da apresentação. Elas existem apenas para demonstrar os formatos. Também não incluir 'PRÉVIA VISUAL' na interface de produção.

## Layout mobile
Uma coluna: cabeçalho, cena compacta, progresso, pergunta, opções e ação. Cena com proporção inicial 16:10 e possibilidade de reduzir altura em telas baixas. Nunca esconder as opções sob botão fixo. Padding de 16–20px, opções com alvo mínimo de 48px de altura. Permitir rolagem vertical. Os selos podem aparecer no rodapé da abertura ou conclusão, sem ocupar espaço de resposta em todas as perguntas.

## Cena e materiais
Câmera em três quartos elevados, com leve perspectiva e foco na pizza. Pedra cinza quente, madeira com veios reais, cerâmica fosca, farinha irregular. Ingredientes fisicamente apoiados; sem objetos orbitando. Massa clara antes de assar, molho vermelho natural, mozzarella branca e manjericão verde. O forno fica no fundo e oferece luz quente, sem competir com o quiz. Não exagerar bloom, fumaça ou brilho plástico.

Iluminação de referência: luz principal suave acima à esquerda; luz quente do forno ao fundo; sombras de contato sob pizza, tábua e recipientes. Nas versões 3D, usar geometria e texturas compatíveis com dispositivos móveis e controlar o pixel ratio. Pausar renderização contínua quando a aba não estiver visível ou a cena estiver parada.

## Estados e movimento
Seleção: borda e pequeno indicador vermelho, sem ícone de acerto. Confirmação: bloquear envio duplicado enquanto houver processamento. Feedback: texto curto e explicação; apresentar estado correto e incorreto sem depender só de verde/vermelho. Transição de preparo: 350–700ms, discreta, sem câmera giratória. Atualizar o estado mesmo com movimento reduzido, usando corte ou fade curto. Erro de rede mantém pergunta e seleção e oferece nova tentativa.

## Progresso correto
Oito marcadores devem representar oito perguntas concluídas. A etapa culinária aparece como informação complementar. Exemplo proposto: 1 bancada/massa; 2 abertura; 3 molho; 4 mozzarella; 5 manjericão/azeite; 6 preparo para forno; 7 forno; 8 finalização. Esse mapeamento é direção de implementação, não conteúdo já existente. A pizza avança também em respostas erradas; pontuação e aprendizado são independentes do avanço visual.

## Reconhecimentos
Usar os assets enviados em escala secundária, com proporções preservadas e sem recriar selos por IA. Uma tarja creme pode melhorar legibilidade. Não escrever 'campeã', 'top 50 do mundo' ou posição numérica. A referência recebida informa AVPN nº 1166 e Excellent Pizzerias do 50 Top Pizza Latin America 2026; conferir materiais canônicos antes de publicar.
