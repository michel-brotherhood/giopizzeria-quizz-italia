# Gio Pizzeria — Da massa ao forno
Pacote de direção visual e assets • 19/11/2026

Copie esta pasta para a raiz do app existente. Abra `PROMPT-PARA-CLAUDE.md` e envie o conteúdo ao Claude Code. O objetivo é refinar o app existente a partir da prévia, preservando regras, backend e conteúdo aprovados.

## Conteúdo
- `referencias/previa-desktop-mobile.png`: conceito visual produzido anteriormente; referência, não interface pronta.
- `docs/DIRECAO-VISUAL.md`: composição, marca, materiais, responsividade e movimento.
- `docs/ASSETS-E-INTEGRACAO.md`: mapa de arquivos e limites de uso.
- `docs/CRITERIOS-DE-ACEITE.md`: verificação da implementação pelo Claude.
- `tokens/gio.css`: valores iniciais de cores, espaçamento, tipografia e estados.
- `assets/marca/originais/`: os seis arquivos originais enviados, sem redesenho.
- `assets/cenario/`: cozinha sem interface, pizza ou textos; PNG original, PNG ampliado e WebP.
- `assets/pizza/`: pizza isolada com transparência; PNG original, PNG ampliado e WebP.
- `assets/manifesto.json`: dimensões e formatos reais.
- `contexto-original/`: CLAUDE.md e PROMPT-INICIAL.md recebidos, preservados.

## Resolução e natureza dos assets
O cenário original e a prévia têm 1672 × 941 px. A pizza original tem 1254 × 1254 px, com canal alpha. A pasta `alta` contém versões ampliadas por interpolação: cenário 3840 × 2161 px e pizza 2508 × 2508 px. Ampliação não recupera detalhes inexistentes; os originais também estão incluídos. Os logos mantêm sua resolução original.

O cenário e a pizza foram gerados separadamente com a prévia como referência. Não são extrações exatas de camadas da imagem anterior. São imagens raster: este pacote não contém GLB, malhas, materiais PBR separados, animações ou os oito estados da pizza. Para o jogo 3D real, o Claude deve construir a cena com base na direção; as imagens servem como referência e fallback estático. A pizza isolada representa apenas a etapa com molho, mozzarella e manjericão.

As perguntas visíveis na prévia são ilustrativas. Os conteúdos e a campanha reais devem vir do projeto existente. O brinde não foi definido neste pacote.
