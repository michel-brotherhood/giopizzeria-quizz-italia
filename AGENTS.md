# Contrato de desenvolvimento — Gio Pizzeria

## Missão
Construir web app 3D moderno, rápido no celular e vinculado à identidade real da Gio. Ler docs/01 a 11 e o conteúdo inicial. Instruções diretas do responsável prevalecem. Não copiar a estética japonesa do outro projeto: manter o rigor do processo, criar expressão italiana própria.

## Antes de implementar
Inspecionar repositório, estado Git e assets já presentes. Preservar trabalho do usuário. Abrir imagens e vetores para entender logo, cores e estilo; não decidir identidade pelo nome dos arquivos. Criar docs/ASSETS.md e docs/STATUS.md com inventário, decisões e lacunas. Não alegar ter visto asset que não abriu.

## Processo
Apresentar plano curto e avançar autonomamente no trabalho local reversível autorizado. Desenvolver em mudanças pequenas. Em cada etapa: implementar, testar, abrir no navegador, revisar, corrigir e registrar evidências. Não parar apenas no plano e não pedir aprovação para toda escolha de código. Perguntar sobre bloqueios concretos, mantendo tarefas independentes em progresso.
Não implantar, contratar serviço, alterar domínio, fazer merge ou ativar brindes reais sem autorização específica já existente.

## Regras técnicas
Projeto vazio: JavaScript ES modules, Vite, Three.js, Node.js/Express e PostgreSQL para fluxo real de brindes. Sem React/TypeScript por padrão. Adaptar se houver stack existente adequada, explicando a razão. Verificar versões e APIs na documentação oficial antes de usar; lockfile no Git. Bibliotecas extras apenas com motivo e licença registrados.
Interface semântica no DOM; Three.js é cenário, não requisito de interação. Não usar apenas fundo estático como entrega 3D principal; oferecer fallback que mantenha identidade e jogabilidade.
Separar motor de perguntas, estado visual e regras de recompensa. Pontuação e conclusão relevantes ao resgate são verificadas no servidor. Nunca aceitar score, stock, voucherValid ou eligible enviados pelo cliente como autoridade.

## Segurança e operação
Modo demo não emite prêmio real. Campanha real desligada por padrão. Sem segredo VITE_* ou credencial no bundle. Autenticação de equipe real no backend, autorização por função, sessões seguras, CSRF em mutações, rate limit e logs sem tokens. Nenhum PIN de equipe embutido no front.
Resgate é transacional, de uso único e confirmado pela equipe. QR/link público de mesa não prova presença nem dá direito a prêmios ilimitados. Não usar localStorage como antifraude. Não prometer segurança perfeita: limite real é por convite/conta validada, não por pessoa física.
Não adicionar coleta de CPF, telefone, e-mail, fingerprint ou localização. Não condicionar brinde a avaliação, publicação ou cadastro sem nova instrução.

## Diagnóstico e testes
Reproduzir falhas, formular hipóteses, verificar a causa e só então corrigir. Testar regras e concorrência com banco real de teste. Não substituir testes transacionais por mocks. Não mudar testes para ocultar defeitos. Rodar scripts aplicáveis e registrar pass/fail/não executado.
Revisar em 360x800, 390x844, 768x1024, 1440x900 e 844x390; incluir zoom e pergunta longa. Sem ferramenta de navegador: declarar revisão visual pendente.

## Entrega
README de execução/deploy, .env.example sem valores reais, migrations, seed de teste, testes, relatório de validação, capturas e pendências. Não chamar de pronto para operação se resgate, campanha, brinde ou treinamento da equipe estiverem pendentes. A direção visual também precisa de revisão; build passar não basta.


## Atualização de contexto — materiais e reconhecimento
A pasta de referência informada pelo usuário é `mateiriais/`, na raiz do projeto, com essa grafia. Começar a inspeção por ela, incluindo subpastas e documentos, sem renomeá-la automaticamente. Se ausente, procurar variantes e registrar o caminho real encontrado. Não alegar acesso aos arquivos até inspecioná-los no ambiente de desenvolvimento.
Ler também docs/11-IDENTIDADE-E-RECONHECIMENTOS.md. Gio: certificada AVPN nº 1166; reconhecida na categoria Excellent Pizzerias do 50 Top Pizza Latin America 2026. Usar denominações precisas e assets originais disponíveis; não inventar colocação numérica nem transformar o reconhecimento em título de campeã.
