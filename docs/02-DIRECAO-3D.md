# Direção 3D — bancada napolitana contemporânea

## Ambiente
Diorama de uma pequena cozinha italiana: bancada de pedra clara, forno arredondado ao fundo, madeira natural na pala, cerâmica artesanal e ingredientes bem modelados. A cena principal é o preparo da pizza; arquitetura e luz dão contexto. Nada de Coliseu, Torre de Pisa e bandeiras empilhados como decoração genérica.
Usar assets reais da pasta como referência prioritária de identidade. Não presumir cores oficiais. Referência de comunicação enviada pelo usuário: creme de papel, vermelho vivo e azul-marinho, com moldura gráfica e logo em formato de pala. Usar essa hierarquia como direção visual e conferir valores exatos nos arquivos de mateiriais/. Terracota e verde de manjericão entram como materiais/ingredientes, não como substituição da paleta da marca. Evitar dourado e preto genéricos como sinônimo de premium.

## Materiais e modelagem
Massa com volume orgânico, borda irregular moderada e roughness fosca; molho com espessura discreta; mozzarella em manchas de formas diferentes; folhas com curvatura; pala de madeira com espessura convincente. Pizza napolitana, não modelo industrial rígido de fatias triangulares com queijo esticando.
Texturas e manchas de cocção devem parecer integradas; não colocar pontos pretos aleatórios uniformes como única modelagem. Render não deve apresentar comida carbonizada ou crua no estado final. Modelo procedural inicial permitido; substituir por asset otimizado se o resultado visual exigir.
Luz principal quente do forno, preenchimento neutro para comida e sombras de contato leves. Evitar pizza laranja pela iluminação excessiva. Nada de reflexos espelhados em todos os materiais, chamas com física pesada ou fumaça constante.

## Estados da cena
Abertura: bancada em perspectiva de três quartos; forno ao fundo; logo no DOM e CTA claro.
Perguntas 1–5: pequenas mudanças na pizza sobre bancada. Pergunta 6: pala se aproxima. Pergunta 7: pizza vai para o forno por animação curta. Pergunta 8: volta assada. Resultado: enquadramento hero da pizza pronta; voucher aparece na UI, nunca escrito em textura 3D.
Essa é uma progressão cenográfica lúdica. Não sincronizar perguntas e estágio como receita real obrigatória.
Acertos: brilho discreto em detalhe e selo textual; erros: explicação gentil e mesma evolução de cena. Nota não altera tamanho, sabor ou qualidade do brinde.

## Layout e movimento
Mobile: palco 3D compacto no topo e painel legível abaixo; CTA inicial deve estar visível sem esperar cena carregar. Desktop: cena lateral e painel de leitura até ~560 px. Texto e alternativas sempre HTML com superfície calma, sem transparência prejudicial.
Transição UI 180–300 ms; estados de cena 400–800 ms. Sem rotação livre, drag obrigatório, giroscópio, áudio automático ou entrada bloqueante. Reduced-motion: posições estáticas e troca direta. Modo leve mantém composição em SVG ou quadro estático; quiz e resgate continuam completos.

## Critérios visuais
Revisar materiais, identidade, iluminação, composição, legibilidade, responsividade e fluidez, com notas 1–5 justificadas. Objetivo mínimo 4 por item, sem defeito bloqueante. Capturar início, pergunta longa, feedback, resultado e voucher. Não concluir que está bonito apenas pela presença de Three.js.


## Tradução da peça enviada para o web app
A peça de referência apresenta papel creme texturizado, linhas e moldura vermelhas, tipografia azul-marinho, recortes de fotografia e marca em forma de pala. A observação vale para essa peça; não é um manual completo de identidade. Buscar as versões oficiais em mateiriais/.
Levar o papel para superfícies leves de UI e para apresentação do resultado; o vermelho para CTAs e acentos, o marinho para textos e detalhes. Textura discreta, comprimida e fora da área de texto pequeno; não sacrificar contraste. Tipografia final depende das fontes encontradas.
A pala oferece ligação natural entre a marca e a cena, sem deformar o logotipo nem transformar a própria logo em objeto de física. Usar a logo plana e íntegra no DOM; pala cenográfica como objeto separado.
A bancada e o forno permanecem o centro 3D. Elementos gráficos enquadram a cena; não simular panfleto de papel inteiro dentro do canvas. Fotos de equipe e pizzas reais podem aparecer em uma área opcional Sobre a Gio, usando arquivos originais, sem recortar rostos ou recriar pessoas por IA.
Reconhecimentos em área discreta da abertura/Sobre a Gio; nada de painel de troféus cobrindo o botão ou certificados piscando a cada acerto. Ver docs/11 para redação.
