// Descadastro de promoções pelo link pessoal (/sair/#t=TOKEN). O token fica no fragmento: não vai para
// logs do servidor nem para o Referer. Só age depois do clique (pré-visualizações de link não descadastram).
import { api } from './game/api.js';

const $ = (id) => document.getElementById(id);
const m = location.hash.match(/t=([0-9a-f]{32})/);
const token = m?.[1] ?? null;
if (token) history.replaceState(null, '', location.pathname);

function done(text) {
  $('s-ask').hidden = true;
  $('s-msg').textContent = text;
  $('s-title').focus();
}

if (!token) {
  done('Este link está incompleto. Para parar de receber promoções, escreva para privacidade@giopizzeria.com.br a partir do e-mail cadastrado.');
} else {
  $('s-ask').hidden = false;
  $('s-confirm').addEventListener('click', async () => {
    const btn = $('s-confirm');
    btn.disabled = true;
    $('s-msg').textContent = 'Enviando…';
    try {
      await api('/api/promocoes/sair', { method: 'POST', body: { token } });
      $('s-title').textContent = 'Pronto';
      done('Você não vai mais receber promoções da Gio. Se mudar de ideia, é só marcar a opção de novidades no próximo cadastro do quiz.');
    } catch (e) {
      btn.disabled = false;
      $('s-msg').textContent = e.code === 'NETWORK' || e.code === 'TIMEOUT'
        ? 'Sem conexão. Nada foi alterado ainda; tente de novo.'
        : e.message;
    }
  });
}
