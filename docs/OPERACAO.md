# Operação, deploy e backup (VPS/Dokku)

> Nada disto foi executado: não houve deploy, nem criação de serviço, domínio ou banco de produção. É o roteiro para quando houver autorização.

## Primeiro deploy
```bash
# na VPS
dokku apps:create gio-quiz
dokku postgres:create gio-quiz-db
dokku postgres:link gio-quiz-db gio-quiz          # define DATABASE_URL
dokku config:set gio-quiz APP_ENV=production NODE_ENV=production \
  SESSION_SECRET="$(openssl rand -base64 48)" PUBLIC_BASE_URL=https://<domínio> \
  SERVE_STATIC=true COOKIE_SECURE=true TRUST_PROXY=1 REAL_CAMPAIGNS_ENABLED=false
dokku domains:set gio-quiz <domínio>
dokku letsencrypt:enable gio-quiz                 # HTTPS obrigatório (cookies Secure)
# na máquina de desenvolvimento
git remote add dokku dokku@<vps>:gio-quiz
git push dokku main
# operadores (um por pessoa)
dokku run gio-quiz npm run staff:create -- --user <login> --name "<Nome>" --role manager
```
- O buildpack Node roda `npm run build` (Vite) e `app.json` roda `node server/db/migrate.js` no predeploy; healthcheck em `/api/health`.
- `embedded-postgres` é devDependency (só dev/testes). Se o build ficar pesado, usar `NPM_CONFIG_PRODUCTION`/Dockerfile — a decidir.
- **Não trocar `SESSION_SECRET` com campanha ativa.** Ele também (a) deriva a chave que cifra o token do voucher para o cliente reabrir o QR — após a troca, a equipe ainda consulta/entrega pelo código (guardado como hash), mas a tela do cliente falha ao reexibir o QR; e (b) é a chave do HMAC da referência de conta — após a troca, a mesma comanda deixaria de ser reconhecida na campanha corrente, quebrando a regra de um convite por conta. Trocar só entre campanhas.

## Ativar uma campanha real (somente com autorização do responsável)
1. Gerente cria a campanha no painel com brinde, quantidade, regras públicas, período, estoque e validades.
2. Responsável muda `REAL_CAMPAIGNS_ENABLED=true` (`dokku config:set`), o que reinicia o app.
3. Gerente ativa a campanha. Pausar bloqueia novos convites/inícios e preserva direitos já emitidos.
4. Encerrar: botão Encerrar (não invalida vouchers emitidos até a validade). Depois, voltar `REAL_CAMPAIGNS_ENABLED=false`.

## Backup e restauração (testar antes do lançamento real — **pendente**)
```bash
dokku postgres:export gio-quiz-db > gio-$(date +%F).dump
# restauração em banco de teste:
dokku postgres:create gio-restore-test
dokku postgres:import gio-restore-test < gio-AAAA-MM-DD.dump
dokku postgres:connect gio-restore-test   # conferir contagens de campaigns/vouchers
```
Não foi possível testar localmente: os binários embutidos não incluem `pg_dump`/`pg_restore`.

## Logs
O app registra só método, caminho (sem query), status e duração para `/api/*`. Tokens viajam no corpo (POST) ou no fragmento (#), que não chega ao servidor. Mesmo assim, configurar o nginx do Dokku para não registrar corpo/headers sensíveis.

## Rollback
`dokku ps:rollback` / redeploy de um commit anterior. As migrations são aditivas; não há passo que invalide vouchers em circulação. Manter o mesmo `SESSION_SECRET`.
