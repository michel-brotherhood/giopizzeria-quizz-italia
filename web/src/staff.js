// Painel da equipe. Sem PIN ou segredo no código: autenticação e autorização acontecem no servidor.
import { api, newKey } from './game/api.js';

const $ = (id) => document.getElementById(id);
const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtT = (d) => (d ? fmt.format(new Date(d)) : '—');
let csrf = null;
let me = null;
let pendingVoucherInput = null; // token/código consultado, mantido só em memória
let redeemKey = null;

const STATE_PT = { issued: 'Disponível para entrega', redeemed: 'Já entregue', expired: 'Expirado', cancelled: 'Cancelado' };
const CAMP_PT = { disabled: 'Desativada', active: 'Ativa', paused: 'Pausada', closed: 'Encerrada' };

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}

const call = (path, opts = {}) => api(path, { ...opts, headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(opts.headers ?? {}) } });

function errText(e) {
  if (e.network) return 'Sem conexão com o servidor. Nada foi alterado — tente de novo.';
  return e.message;
}

// ---------- sessão ----------
async function init() {
  // QR do cliente abre /equipe/#v=TOKEN: guardamos em memória e limpamos a URL (GET nunca consome).
  const m = location.hash.match(/v=([A-Za-z0-9_-]{20,})/);
  if (m) { pendingVoucherInput = m[1]; history.replaceState(null, '', location.pathname); }
  try {
    const r = await call('/api/staff/me');
    onLogged(r);
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('login-view').hidden = false;
  $('app-view').hidden = true;
  $('logout').hidden = true;
  $('who').textContent = '';
}

function onLogged(r) {
  csrf = r.csrfToken;
  me = r.operator;
  $('login-view').hidden = true;
  $('app-view').hidden = false;
  $('logout').hidden = false;
  $('who').textContent = `${me.displayName} · ${me.role === 'manager' ? 'gerente' : 'atendente'}`;
  const env = $('env');
  if (r.env && r.env !== 'production') { env.hidden = false; env.textContent = `ambiente: ${r.env}`; }
  $('tab-manage').hidden = me.role !== 'manager';
  $('tab-regs').hidden = me.role !== 'manager';
  if (r.env === 'production') $('is-test-wrap').hidden = true;
  refreshOverview();
  if (pendingVoucherInput) { selectTab('check'); lookup(pendingVoucherInput); }
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  $('login-msg').textContent = '';
  try {
    const r = await api('/api/staff/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
    ev.target.reset();
    onLogged({ ...r, ...(await api('/api/staff/me')) });
  } catch (e) {
    $('login-msg').textContent = errText(e);
  }
});

$('logout').addEventListener('click', async () => {
  try { await call('/api/staff/logout', { method: 'POST', body: {} }); } catch { /* sessão já inválida */ }
  csrf = null; me = null;
  showLogin();
});

// ---------- abas ----------
function selectTab(name) {
  for (const t of ['invite', 'check', 'manage', 'regs']) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`panel-${t}`).hidden = t !== name;
  }
  if (name === 'manage') loadCampaigns();
  if (name === 'regs') loadRegistrations();
}
for (const t of ['invite', 'check', 'manage', 'regs']) $(`tab-${t}`).addEventListener('click', () => selectTab(t));

// ---------- cadastros (gerente) ----------
const fmtDT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
async function loadRegistrations() {
  const body = $('regs-body');
  try {
    const r = await call('/api/staff/registrations');
    body.replaceChildren(
      el('dl', { class: 'counters' },
        el('div', {}, el('dt', {}, 'Cadastros'), el('dd', {}, String(r.total))),
        el('div', {}, el('dt', {}, 'Aceitam promoções'), el('dd', {}, String(r.marketing))),
        el('div', {}, el('dt', {}, 'Últimas 24 h'), el('dd', {}, String(r.last24h)))),
      r.recent.length ? el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'Nome'), el('th', {}, 'WhatsApp'), el('th', {}, 'E-mail'), el('th', {}, 'Promoções'), el('th', {}, 'Quando'))),
        el('tbody', {}, ...r.recent.map((x) => el('tr', {},
          el('td', {}, x.name), el('td', {}, `+${x.phone}`), el('td', {}, x.email), el('td', {}, x.marketing ? 'sim' : 'não'), el('td', {}, fmtDT.format(new Date(x.createdAt)))))))) : el('p', { class: 'help' }, 'Nenhum cadastro ainda.'));
  } catch (e) {
    body.replaceChildren(el('p', { class: 'msg' }, errText(e)));
  }
}
$('regs-del-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = ev.target.email.value.trim();
  const msg = $('regs-del-msg');
  if (!email || !window.confirm(`Excluir definitivamente o cadastro de ${email}?`)) return;
  try {
    await call('/api/staff/registrations/delete', { method: 'POST', body: { email } });
    msg.textContent = 'Cadastro excluído.';
    ev.target.reset();
    loadRegistrations();
  } catch (e) {
    msg.textContent = errText(e);
  }
});

// ---------- visão geral ----------
async function refreshOverview() {
  try {
    const r = await call('/api/staff/overview');
    const c = r.campaign;
    const body = $('campaign-body');
    if (!c) {
      body.replaceChildren(el('p', {}, 'Nenhuma campanha ativa. O jogo funciona em modo demonstração (sem brinde).'));
      return;
    }
    body.replaceChildren(
      el('p', { class: 'c-name' }, c.isTest ? el('span', { class: 'tag test' }, 'TESTE · sem valor') : null, ' ', c.name, ' ', el('span', { class: `tag st-${c.state}` }, CAMP_PT[c.state])),
      el('p', {}, el('strong', {}, 'Brinde: '), c.rewardName ?? '—', c.quantityPerVoucher ? ` (×${c.quantityPerVoucher})` : ''),
      el('dl', { class: 'counters' },
        el('div', {}, el('dt', {}, 'Disponível'), el('dd', {}, String(c.available))),
        el('div', {}, el('dt', {}, 'Reservado (em jogo)'), el('dd', {}, String(c.reservedCount))),
        el('div', {}, el('dt', {}, 'Emitidos'), el('dd', {}, String(c.awardedCount))),
        el('div', {}, el('dt', {}, 'Entregues'), el('dd', {}, String(c.redeemedCount))),
        el('div', {}, el('dt', {}, 'Estoque total'), el('dd', {}, String(c.totalStock)))),
      el('p', { class: 'help' }, `Período: ${fmtT(c.startsAt)} – ${fmtT(c.endsAt)}. Convite ${c.invitationTtlMinutes} min · partida ${c.sessionTtlMinutes} min · voucher ${c.rewardTtlMinutes} min.`),
      r.invitations.length ? el('details', {}, el('summary', {}, 'Últimos convites'),
        el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Conta'), el('th', {}, 'Criado'), el('th', {}, 'Convite'), el('th', {}, 'Partida'), el('th', {}, 'Brinde'))),
          el('tbody', {}, r.invitations.map((i) => el('tr', {}, el('td', {}, i.accountRefHint), el('td', {}, fmtT(i.createdAt)), el('td', {}, i.state), el('td', {}, i.sessionState ?? '—'), el('td', {}, i.voucherState ?? '—')))))) : null,
    );
  } catch (e) {
    if (e.code === 'UNAUTHENTICATED') return showLogin();
    $('campaign-body').replaceChildren(el('p', { class: 'msg' }, errText(e)));
  }
}
setInterval(() => { if (me && !document.hidden) refreshOverview(); }, 20000);

// ---------- convite ----------
$('invite-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const out = $('invite-out');
  const btn = ev.target.querySelector('button');
  btn.disabled = true;
  try {
    const r = await call('/api/staff/invitations', { method: 'POST', body: { accountRef: new FormData(ev.target).get('accountRef') } });
    const kindText = {
      created: 'Convite criado.',
      reissued: 'Esta conta já tinha um convite não usado: geramos um novo link (o anterior deixou de valer).',
      recovery: 'Esta conta já está jogando ou concluiu: este link retoma a MESMA partida (não gera novo brinde).',
    }[r.kind];
    const qr = el('div', { class: 'qr', role: 'img', 'aria-label': 'QR do convite para o cliente escanear' });
    qr.innerHTML = r.qrSvg; // SVG gerado pelo servidor
    out.replaceChildren(el('div', { class: 'result ok' },
      el('p', {}, el('strong', {}, kindText), ` Conta ${r.accountRefHint}.`),
      qr,
      el('p', { class: 'help' }, 'Peça para o cliente escanear com a câmera do celular.', r.expiresAt ? ` Válido até ${fmtT(r.expiresAt)}.` : ''),
      el('details', {}, el('summary', {}, 'Mostrar link'), el('p', { class: 'mono' }, r.url))));
    ev.target.reset();
    refreshOverview();
  } catch (e) {
    out.replaceChildren(el('div', { class: 'result bad' }, el('p', {}, errText(e))));
  } finally {
    btn.disabled = false;
  }
});

// ---------- conferir ----------
function voucherBox(v) {
  const box = el('div', { class: `result ${v.state === 'issued' ? 'ok' : 'bad'}` });
  if (v.isTest) box.append(el('p', { class: 'tag test big' }, 'TESTE — SEM VALOR DE RESGATE'));
  box.append(
    el('p', { class: 'v-state' }, STATE_PT[v.state] ?? v.state),
    el('p', {}, el('strong', {}, 'Brinde: '), `${v.quantity > 1 ? `${v.quantity} × ` : ''}${v.rewardName}`),
    el('p', {}, el('strong', {}, 'Conta: '), v.accountRefHint),
    el('p', {}, el('strong', {}, 'Emitido: '), fmtT(v.issuedAt), ' · ', el('strong', {}, 'Válido até: '), fmtT(v.expiresAt)));
  if (v.state === 'redeemed') box.append(el('p', {}, el('strong', {}, 'Entregue em: '), fmtT(v.redeemedAt), v.redeemedBy ? ` por ${v.redeemedBy}` : ''));
  if (v.state === 'issued') {
    box.append(el('button', { type: 'button', class: 's-btn primary', onclick: () => openConfirm(v) }, 'Confirmar entrega…'));
  }
  return box;
}

async function lookup(input) {
  const out = $('check-out');
  out.replaceChildren(el('p', {}, 'Consultando…'));
  pendingVoucherInput = input;
  try {
    const r = await call('/api/staff/vouchers/lookup', { method: 'POST', body: { code: input } });
    redeemKey = null;
    out.replaceChildren(voucherBox(r.voucher));
  } catch (e) {
    out.replaceChildren(el('div', { class: 'result bad' }, el('p', {}, errText(e))));
  }
}

$('check-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = new FormData(ev.target).get('code');
  if (v) lookup(String(v));
});

function openConfirm(v) {
  $('cd-body').replaceChildren(
    v.isTest ? el('p', { class: 'tag test big' }, 'TESTE — SEM VALOR DE RESGATE') : null,
    el('p', {}, `Entregar ${v.quantity > 1 ? `${v.quantity} × ` : ''}${v.rewardName} para a conta ${v.accountRefHint}?`),
    el('p', { class: 'help' }, 'Depois de confirmar, este brinde não pode ser usado de novo.'));
  $('confirm-dialog').showModal();
}
$('cd-no').addEventListener('click', () => $('confirm-dialog').close());
$('cd-yes').addEventListener('click', async () => {
  const btn = $('cd-yes');
  btn.disabled = true;
  redeemKey = redeemKey ?? newKey(); // mesma chave em retentativas desta confirmação
  try {
    const r = await call('/api/staff/vouchers/redeem', { method: 'POST', body: { code: pendingVoucherInput }, headers: { 'idempotency-key': redeemKey } });
    $('confirm-dialog').close();
    $('check-out').replaceChildren(el('div', { class: 'result ok' }, el('p', { class: 'v-state' }, '✓ Entrega confirmada'), voucherBox(r.voucher)));
    redeemKey = null;
    refreshOverview();
  } catch (e) {
    $('confirm-dialog').close();
    const extra = e.code === 'ALREADY_REDEEMED' && e.details ? ` (${fmtT(e.details.redeemedAt)}${e.details.redeemedBy ? `, por ${e.details.redeemedBy}` : ''})` : '';
    $('check-out').replaceChildren(el('div', { class: 'result bad' }, el('p', {}, errText(e) + extra),
      e.network ? el('p', { class: 'help' }, 'A entrega NÃO foi confirmada. Consulte de novo antes de entregar.') : null));
    if (!e.network) redeemKey = null;
  } finally {
    btn.disabled = false;
  }
});

// Leitura de QR: BarcodeDetector quando disponível; senão, código digitável.
let stream = null;
$('scan-btn').addEventListener('click', async () => {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    $('check-out').replaceChildren(el('div', { class: 'result bad' }, el('p', {}, 'Leitura por câmera indisponível neste navegador. Digite o código mostrado abaixo do QR.')));
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    $('check-out').replaceChildren(el('div', { class: 'result bad' }, el('p', {}, 'Câmera não autorizada. Digite o código mostrado abaixo do QR.')));
    return;
  }
  const video = $('scan-video');
  video.srcObject = stream;
  $('scanner').hidden = false;
  await video.play();
  const det = new window.BarcodeDetector({ formats: ['qr_code'] });
  const loop = async () => {
    if (!stream) return;
    try {
      const codes = await det.detect(video);
      if (codes[0]?.rawValue) { stopScan(); return lookup(codes[0].rawValue); }
    } catch { /* quadro sem leitura */ }
    requestAnimationFrame(loop);
  };
  loop();
});
function stopScan() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('scanner').hidden = true;
}
$('scan-stop').addEventListener('click', stopScan);

// ---------- gerenciar ----------
async function loadCampaigns() {
  const list = $('campaign-list');
  try {
    const r = await call('/api/staff/campaigns');
    list.replaceChildren(...r.campaigns.map((c) => el('div', { class: 'camp' },
      el('p', {}, c.isTest ? el('span', { class: 'tag test' }, 'TESTE') : null, ' ', el('strong', {}, c.name), ' ', el('span', { class: `tag st-${c.state}` }, CAMP_PT[c.state])),
      el('p', { class: 'help' }, `Brinde: ${c.rewardName ?? '—'} · estoque ${c.totalStock} · disponível ${c.available} · emitidos ${c.awardedCount} · entregues ${c.redeemedCount}`),
      c.missing.length && c.state !== 'closed' ? el('p', { class: 'help' }, `Falta para ativar: ${c.missing.join(', ')}`) : null,
      el('div', { class: 'row' },
        ['disabled', 'paused'].includes(c.state) ? el('button', { class: 's-btn', type: 'button', onclick: () => campAction(c.id, 'activate') }, 'Ativar') : null,
        c.state === 'active' ? el('button', { class: 's-btn', type: 'button', onclick: () => campAction(c.id, 'pause') }, 'Pausar') : null,
        c.state !== 'closed' ? el('button', { class: 's-btn', type: 'button', onclick: () => campStock(c) }, 'Alterar estoque') : null,
        c.state !== 'closed' ? el('button', { class: 's-btn danger', type: 'button', onclick: () => campAction(c.id, 'close') }, 'Encerrar') : null))));
  } catch (e) {
    list.replaceChildren(el('p', { class: 'msg' }, errText(e)));
  }
}
async function campAction(id, action) {
  try {
    await call(`/api/staff/campaigns/${id}/${action}`, { method: 'POST', body: {} });
  } catch (e) {
    $('campaign-list').prepend(el('p', { class: 'msg' }, errText(e)));
    return;
  }
  loadCampaigns(); refreshOverview();
}
function campStock(c) {
  const form = el('form', { class: 'row' },
    el('label', {}, 'Novo estoque total ', el('input', { name: 'totalStock', type: 'number', min: String(c.reservedCount + c.awardedCount), value: String(c.totalStock) })),
    el('button', { class: 's-btn primary', type: 'submit' }, 'Salvar'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await call(`/api/staff/campaigns/${c.id}`, { method: 'PATCH', body: { totalStock: Number(new FormData(form).get('totalStock')) } });
      loadCampaigns(); refreshOverview();
    } catch (e) { form.append(el('p', { class: 'msg' }, errText(e))); }
  });
  $('campaign-list').prepend(form);
}
$('campaign-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const body = {};
  for (const [k, v] of f.entries()) if (v !== '') body[k] = v;
  body.isTest = f.get('isTest') === 'on';
  for (const k of ['startsAt', 'endsAt']) if (body[k]) body[k] = new Date(body[k]).toISOString();
  try {
    await call('/api/staff/campaigns', { method: 'POST', body });
    $('campaign-msg').textContent = 'Campanha criada (desativada).';
    ev.target.reset();
    loadCampaigns();
  } catch (e) {
    $('campaign-msg').textContent = errText(e);
  }
});

init();
