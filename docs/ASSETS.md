# Inventário de assets e decisões de identidade

Inspeção feita em 18/11/2026 no ambiente de desenvolvimento (Linux), abrindo os arquivos (renderização de SVG/PNG/PDF em folhas de contato, extração de prévias dos CR2 com `dcraw -e`, quadros do vídeo com `ffmpeg`).

## Caminho real da pasta
O briefing cita `mateiriais/`. **Essa pasta não existe.** A pasta real encontrada na raiz é **`materiais/`** (grafia correta). Nenhuma pasta foi renomeada; os originais não foram alterados. Tudo que o app usa são **cópias** em `web/public/`.

## Marca (`materiais/Marca/`)
| Arquivo | O que é (visto) | Uso no app |
|---|---|---|
| `Logotipo_FA/AI (SVG)/3. Tres Tintas/…Tres_Tintas_A.svg` | Logo em forma de **pala**: fundo creme `#f4e9d5`, contorno vermelho `#d5392c`, texto “GIO PIZZERIA / NAPOLETANA” azul `#1d2140`. viewBox 566.93×793.7. Vetor real. | `web/public/brand/gio-logo-tres-tintas-a.svg` — barra superior e painel da equipe (sem deformar). |
| `…Tres_Tintas_B.svg` | Mesma pala com fundo azul, texto creme, contorno vermelho. | Copiado (`gio-logo-tres-tintas-b.svg`), reserva para fundos escuros. |
| `…Una_Tinta_A.svg` / `_B.svg` | Uma cor (azul / creme). | Favicon (A); B em reserva. |
| Variantes `Dos Tintas`, `Blanco y Negro`, PNG/JPG/EPS/PDF/AI | Mesmas peças em outros formatos. | Não usadas (SVG é suficiente). |
| `Cores/Cores pantone x CMYK_240724_215332.pdf` | **Areia 10-9 C #EEDEBD · Laranja 179 C #E03C31 · Preto 5395 CP #202B34 · Azul 282 C #041E42** | Tokens de cor em `web/src/styles/app.css`. |
| `Fontes/Latinotype - ArquitectaHeavy.otf (1)` e `…ArquitectaThin.otf (1)` | Arquitecta (Latinotype), pesos Heavy e Thin. | **Não usada no app desde o redesenho de 19/11/2026** (licença web não confirmada; em produção ela não existia e o site caía na fonte do sistema). Substituída por fontes livres embutidas no build — ver “Tipografia”. |
| `logos selos avpn e 50top/Associazione-Verace-Pizza-Napoletana-Logo (1).png` | Selo circular AVPN (Pulcinella com pala). | Cópia reduzida 240 px `web/public/brand/avpn-logo.png`, 44 px na abertura. |
| `…/43db8e057beb44eba0c450b430002e8c.png` | Logo horizontal AVPN. | Não usado. |
| `…/ExcellentPizz26_pdf.pdf` | Selo vermelho “EXCELLENT PIZZERIAS 2026” (vetorial, sem bitmap embutido — conferido). | Convertido com `pdftocairo -svg` → `web/public/brand/50top-excellent-2026.svg`, 44 px na abertura. |
| `…/50-top-pizza.png` | Logotipo “50 TOP PIZZA”. | Não usado (o selo Excellent 2026 é o reconhecimento específico). |

**Divergência registrada:** os SVG do logo usam `#d5392c / #1d2140 / #f4e9d5`, levemente diferentes dos Pantone do PDF (`#E03C31 / #041E42 / #EEDEBD`). O logo é usado como arquivo original, sem recolorir; a UI usa os valores Pantone do PDF.

**Ajuste de acessibilidade:** `#E03C31` sobre creme tem contraste 3,6:1 (reprova AA para texto pequeno). Para texto e botões usamos `#C0322A` (tom mais profundo do mesmo vermelho): 5,41:1 com o texto creme do botão (`#FFFAF0`) e 4,92:1 como texto sobre o papel (`#F7EFDF`). Azul `#041E42` sobre papel: 14,47:1. O `#E03C31` original fica em linhas, molduras e acentos. Verificado em `tests/unit/contrast.test.js`.

## Fotografias e vídeo (`materiais/`)
| Arquivos | Conteúdo visto | Uso |
|---|---|---|
| `gio-2/6/18/35/43/52/54.jpg` (3648×5472) | Pizzas, focaccia com burrata, sobremesa em taça, vinho, mesa de madeira e tijolo aparente. | `gio-18`, `gio-6`, `gio-43` → WebP 720 px (≈46–66 KB) em “Sobre a Gio”. Sem recorte de rostos (não há pessoas nessas três). |
| `0210_feed_1/2.png`, `0710_feed_1/2.png`, `1010_feed_1/2.jpg` (1080×1350) | Peças de feed (marinara com alho, panela gratinada com pão, pizza fatiada). | Referência de estilo (luz quente, madeira/tijolo). Não usados no app (têm composição/grafismos próprios). |
| `IMG_8228…8303.CR2` (RAW ~30 MB) | Prévias extraídas: pizzas e focaccia em mesa de madeira, vinho. | Apenas referência. Ignorados no Git (`.gitignore`), originais preservados. |
| `1510_reels_GIO.mp4` (2160×3840, 25,8 s) | Reel: pizza com presunto e pesto, serviço de vinho, avental com logo. | Referência de ambiente. Não usado; ignorado no Git. |

## Decisões de direção visual derivadas dos assets
- **Paleta (redesenho):** noite na pizzaria — cena 3D em tela cheia, painel no Azul 282C com texto Areia, CTA no vermelho 179C aprofundado (#C0322A), brasa #FF9A4A só para a etapa atual e a categoria. O voucher continua em papel creme, como um cupom físico.
- **Pala como ponte:** a pala de madeira da cena 3D tem silhueta de pala real (ombros arredondados afunilando ao cabo), objeto cenográfico **separado** do logotipo — o logo plano fica íntegro no DOM.
- **Forno:** cúpula em mosaico azul-marinho com faixa creme e linha vermelha (cores da marca aplicadas a material, sem logo na textura).
- **Ambiente:** bancada de mármore bardiglio com farinha, pendente quente sobre a massa, forno aceso a lenha (chamas e fagulhas em shader) e parede de tijolo na penumbra.
- **Sem dourado/preto genéricos**, sem monumentos ou bandeiras.

## Tipografia (redesenho 19/11/2026)
- **Outfit** (variável; SIL OFL 1.1, `@fontsource-variable/outfit`) em toda a interface — sans geométrica, como pede a direção visual (títulos 650–750, corpo 400–500, alternativas 550–650). Empacotada pelo Vite e servida do próprio domínio (CSP `font-src 'self'`).
- Uma versão intermediária usou Fraunces (serifa); foi removida ao aplicar a direção visual.

## Pacote de direção visual (`ref/Gio-Direcao-Visual-Assets`, 19/11/2026)
Lido integralmente (LEIA-PRIMEIRO, PROMPT, docs, tokens, manifesto) e inspecionado visualmente (prévia, cenário, pizza, logos). Cenário e pizza são imagens geradas pelo próprio pacote como referência/reserva — não são modelos 3D; a cena 3D foi construída à parte. Usados no app (WebP redimensionado com Pillow/Lanczos):
| Origem no pacote | No app | Uso |
|---|---|---|
| `marca/originais/GIOPizzeria__Logotipo_Tres_Tintas_C.png` | `brand/gio-logo-tres-tintas-c.webp` (159×240, só margem transparente recortada) | cabeçalho |
| `marca/originais/Associazione-Verace-Pizza-Napoletana-Logo (1).png` | `brand/avpn-selo.webp` (124×112) | tarja de reconhecimento |
| `marca/originais/50-top-pizza.png` | `brand/50top-pizza.webp` (128×128) | tarja de reconhecimento |
| `cenario/originais/cozinha-sem-interface.png` | `scene/cozinha-960.webp`, `scene/cozinha-1672.webp` | imagem de espera e reserva sem WebGL |
| `pizza/originais/pizza-mozzarella-transparente.png` | `scene/pizza-mozzarella-720.webp` | reserva sem WebGL, só na etapa Manjericão |
As versões `alta/` (ampliadas por interpolação) não são usadas e ficam fora do Git.

## Fonte fora do Git (histórico)
O repositório é público; por isso `materiais/Marca/Fontes/` e `web/public/fonts/*.woff2` estão no `.gitignore` (não redistribuir fonte comercial). Para gerar o subset localmente, com o OTF fornecido pela Gio:
```bash
pip install fonttools brotli
pyftsubset "materiais/Marca/Fontes/Latinotype - ArquitectaHeavy.otf (1)" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+00B7" \
  --flavor=woff2 --layout-features='kern,liga' --output-file=web/public/fonts/arquitecta-heavy-sub.woff2
```
O app não referencia mais esse arquivo; o comando fica só como registro.

## Lacunas / pendências
- **Licença web da Arquitecta:** ainda não confirmada; por isso o app usa Fraunces e Outfit (OFL). Se a licença for confirmada, a Arquitecta pode voltar em rótulos.
- **Uso dos selos AVPN e 50 Top Pizza:** arquivos presentes; confirmar com o restaurante a autorização de uso gráfico nesse contexto.
- Modelos 3D externos: **nenhum** usado. Cena 100% procedural (sem licença de terceiros).
- Bibliotecas: three 0.187.0 (MIT), express 5.3.0 (MIT), pg 8.23.1 (MIT), helmet 8.3.0 (MIT), express-rate-limit 8.7.4 (MIT), cookie-parser 1.4.7 (MIT), qrcode 1.5.4 (MIT — gera o QR no servidor). Dev: vite 8.3.8, vitest 5.1.1, @playwright/test 1.65.1 (Apache-2.0), concurrently 10.0.7, embedded-postgres 18.6.0-beta.19 (MIT — PostgreSQL real para dev/testes; não vai para produção).
