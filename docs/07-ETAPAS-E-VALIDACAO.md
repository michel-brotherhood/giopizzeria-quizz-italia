# Etapas com validação

## 0 — Inventário
Ler docs, inspecionar assets, identificar stack e preservar arquivos. Criar ASSETS.md/STATUS.md. Registrar quais logos/cores/fontes foram realmente encontradas. Pendências comerciais não bloqueiam motor nem cenário; bloqueiam ativação real.

## 1 — Recorte vertical 3D
Abertura, uma pergunta, feedback, pizza evoluindo e resultado em DEMO. Testar em 390x844 e 1440x900. Revisar materiais/composição e corrigir antes de expandir. Three.js real no caminho principal; modo leve reproduz identidade. Sem código resgatável fictício.

## 2 — Motor e conteúdo
Integrar 32 perguntas, distribuição 4/2/2 e famílias. Testes determinísticos de sorteio, pontuação, idempotência de resposta e conteúdo. Verificar sementes variadas e ausência de repetição. Validar fontes e revisar linguagem; banco é proposta editorial.

## 3 — Backend e equipe
Migrations, autenticação, autorização, campanha, convite, reserva, respostas servidor, emissão e resgate. Testar em PostgreSQL isolado. Disputar última unidade com duas sessões; confirmar voucher em duas transações; repetir conclusão e requisições após timeout. Critério: uma reserva/voucher/entrega, invariantes mantidas.

## 4 — Integração e falhas
Conectar telas ao estado canônico, retomar sessão, testar rede offline no meio da resposta e da emissão, recuperar sem duplicar. Testar câmera negada com código digitável, storage corrompido e token inválido. Confirmar que GET/previews de link não resgatam.

## 5 — Visual, mobile e acessibilidade
Capturas de início/pergunta longa/feedback/resultado/voucher/painel em viewports relevantes: 360x800,390x844,768x1024,1440x900,844x390. Testar zoom 200%, teclado, contraste efetivo e reduced-motion. Verificar ausência de scroll horizontal e foco perdido. Medir build e 3D com ambiente identificado; emulação não equivale a teste em celular físico.

## 6 — Pré-entrega
Rodar lint, unitários, conteúdo, integração, E2E e build. Rever diffs, logs, assets/licenças, fontes e ausência de segredos. README, manual da equipe, operação e backup/restore documentados. Corrigir problemas antes de declarar etapa pronta. Repetir checks afetados por novas alterações, sem ciclos redundantes quando nada mudou.

## Evidência
Registrar etapa, comandos e resultados, ambiente, capturas, problemas corrigidos, limitações e próximo passo. Distinguir passou/falhou/não executado. Não alegar pentest ou medição de campo a partir de checklist. Se não há browser, revisão visual pendente. Se não há PostgreSQL disponível, testes concorrentes pendentes, não simular aprovação.
Concluir desenvolvimento local separado de aprovação comercial e publicação. Campanha real só ativa com oferta e operação confirmadas.
