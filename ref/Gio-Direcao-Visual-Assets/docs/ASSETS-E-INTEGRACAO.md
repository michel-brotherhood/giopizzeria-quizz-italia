# Assets e integração

## Arquivos fornecidos
| Arquivo/pasta | Uso |
|---|---|
| referencias/previa-desktop-mobile.png | Referência da composição; não usar como interface |
| assets/cenario/originais/cozinha-sem-interface.png | Master nativo 1672×941; ambiente sem pizza |
| assets/cenario/alta/cozinha-sem-interface-ampliado.png | Master ampliado 3840×2161; apresentação/composição |
| assets/cenario/web/cozinha-sem-interface.webp | Modo leve e carregamento inicial |
| assets/pizza/originais/pizza-mozzarella-transparente.png | Master nativo 1254×1254 RGBA; etapa ilustrada |
| assets/pizza/alta/pizza-mozzarella-transparente-ampliado.png | Ampliação 2508×2508 com alpha preservado |
| assets/pizza/web/pizza-mozzarella-transparente.webp | Ilustração de etapa em modo leve |
| assets/marca/originais/GIOPizzeria__Logotipo_Tres_Tintas_C.png | Logo colorido da Gio |
| assets/marca/originais/GIOPizzeria__Logotipo_Una_Tinta_B.png | Variante original; inspecionar contraste |
| assets/marca/originais/GIOPizzeria__Logotipo_Una_Tinta_C.png | Variante original; inspecionar contraste |
| assets/marca/originais/50-top-pizza.png | Selo 50 Top Pizza original |
| assets/marca/originais/43db8e057beb44eba0c450b430002e8c.png | Assinatura horizontal AVPN original |
| assets/marca/originais/Associazione-Verace-Pizza-Napoletana-Logo (1).png | Selo circular AVPN original |

A resolução exata de cada logo está no manifesto. Não foram vetorizados nem ampliados artificialmente. Não inventar SVG com um bitmap embutido para chamar de vetor.

## Integração proposta
Copiar apenas assets usados para uma pasta pública adequada do app, mantendo originais deste pacote como referência. Use nomes estáveis e imports ou URLs compatíveis com a stack existente. Exiba logos com contain e dimensões explícitas. Para o cenário, use cover e ajuste o enquadramento em cada viewport, garantindo que a tábua continue visível. Não cortar o logo com cover.

Para compor a pizza e o cenário em modo leve, trate ambos como uma composição única com coordenadas proporcionais e ponto de apoio na tábua. Não posicione a pizza em coordenadas fixas da janela. O asset isolado pode exigir ajuste de escala e sombra; não foi extraído da mesma câmera e não deve ser tratado como encaixe perfeito. A sombra de contato pode ser aplicada no contêiner, sem pintar o PNG original.

Para renderização real 3D, os PNGs não oferecem textura UV nem mapas normal/roughness; não aplicá-los em uma esfera e declarar o modelo pronto. Construir geometria e materiais da massa, coberturas, recipientes e cenário, ou usar modelos com licença verificada e registrada. O forno e a pizza devem ter estados reais na cena. Não há arquivos GLB neste ZIP.

## Desempenho
Usar WebP no app e masters PNG apenas quando necessários. Criar variantes responsivas a partir dos originais conforme a dimensão efetiva de exibição, sem enviar o PNG ampliado para todos os celulares. Reservar espaço com width/height ou aspect-ratio. Carregar primeiro a tela inicial e só então recursos de etapas futuras. O modo leve deve funcionar sem WebGL, com a mesma pergunta e progresso. Não deixar um asset decorativo bloquear a emissão de feedback.

## Proveniência
Marca: arquivos fornecidos pelo usuário, preservados. Prévia: imagem gerada anteriormente nesta conversa. Cenário e pizza isolada: novos assets gerados com base na direção da prévia. Versões ampliadas: interpolação Lanczos, sem promessa de detalhe nativo 4K. WebP: conversão otimizada dos originais. Não há fonte tipográfica externa, modelo 3D externo ou fotografia de terceiros adicionados neste pacote.
