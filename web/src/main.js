// Máquina de estados da experiência do cliente:
// boot -> welcome -> question(asking/submitting/feedback) -> completing -> result | recovery
// O estado do brinde vem SEMPRE do servidor; a cena 3D só recebe eventos.
import bank from '../../content/questions.seed.json';
import { DemoAdapter, ServerAdapter, store } from './game/adapters.js';
import { newKey } from './game/api.js';
import { CATEGORY_LABELS, ROUND_SIZE } from '../../shared/quiz.js';
import { createLightScene } from './scene/light-scene.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

const BENCH = [
  'Na bancada: o panetto descansa sobre a farinha.',
  'Na bancada: a massa foi aberta à mão.',
  'Na bancada: o molho de tomate foi espalhado.',
  'Na bancada: a mozzarella foi distribuída.',
  'Na bancada: folhas de manjericão.',
  'Na bancada: um fio de azeite.',
  'A pala se aproxima da pizza.',
  'A pizza entrou no forno.',
  'A pizza saiu do forno.',
  'Pizza pronta.',
];

const server = new ServerAdapter();
const demo = new DemoAdapter(bank.questions);

const ctx = {
  mode: null,            // 'demo' | 'server'
  campaign: null,        // campanha pública atual (GET /api/campaign/current)
  inviteToken: null,     // apenas em memória
  state: null,           // estado canônico da partida
  current: null,         // pergunta atual (pública)
  feedback: null,        // feedback da pergunta atual
  pending: null,         // { questionId, selectedOptionId, key }
  busy: false,
  serverVoucherState: null,
  retryTimer: null,
  pollTimer: null,
};

// ---------------------------------------------------------------- cena
let scene = null;
let sceneStage = 0;
let lightMode = false;

function setStage(n, opts) {
  sceneStage = n;
  scene?.setStage(n, opts);
  $('scene-status').textContent = BENCH[n] ?? '';
}

async function mountScene(light) {
  scene?.dispose();
  scene = null;
  const stage = $('stage');
  if (light) {
    scene = createLightScene(stage);
    scene.setStage(sceneStage);
    return;
  }
  try {
    const mod = await import('./scene/scene.js');
    if (lightMode) return; // usuário trocou durante o carregamento
    const quality = (navigator.deviceMemory && navigator.deviceMemory <= 2) ? 'low' : 'high';
    scene = await mod.createScene(stage, {
      reducedMotion, quality,
      onFail: () => { setLightMode(true, true); },
    });
    scene.setStage(sceneStage, { instant: true });
  } catch (e) {
    console.warn('[cena] usando modo leve:', e.message);
    setLightMode(true, true);
  }
}

function setLightMode(on, automatic = false) {
  lightMode = on;
  $('light-toggle').setAttribute('aria-pressed', String(on));
  $('light-toggle').textContent = on ? (automatic ? 'Modo leve (auto)' : 'Modo leve') : 'Modo leve';
  if (!automatic) store.setLocal('gio.light', on);
  mountScene(on);
}

// ---------------------------------------------------------------- telas
function show(screen, focusId) {
  app.dataset.screen = screen;
  if (focusId) requestAnimationFrame(() => $(focusId)?.focus({ preventScroll: false }));
}

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

function setModePill() {
  const pill = $('mode-pill');
  if (ctx.mode === 'demo') { pill.hidden = false; pill.textContent = 'Demonstração'; pill.className = 'pill pill-demo'; }
  else if (ctx.mode === 'server' && ctx.state?.session?.campaign?.isTest) { pill.hidden = false; pill.textContent = 'Teste'; pill.className = 'pill pill-test'; }
  else pill.hidden = true;
}

function rewardLine(name, qty) {
  return qty && qty > 1 ? `${qty} × ${name}` : name;
}

function renderWelcome() {
  const offer = $('offer');
  offer.replaceChildren();
  offer.hidden = true;
  offer.classList.remove('test');
  const start = $('btn-start');
  const c = ctx.campaign;
  if (ctx.inviteToken) {
    offer.hidden = false;
    offer.append(el('h3', {}, 'Convite recebido'));
    if (c) {
      if (c.isTest) { offer.classList.add('test'); offer.append(el('p', { class: 'test-banner' }, 'Campanha de teste — sem valor de resgate')); }
      offer.append(el('p', { class: 'reward' }, rewardLine(c.rewardName, c.quantityPerVoucher)));
      if (c.rulesText) offer.append(el('p', {}, c.rulesText));
      offer.append(el('p', { class: 'small' }, `Válido até ${fmtDay.format(new Date(c.endsAt))}, ${fmtTime.format(new Date(c.endsAt))} (horário de Brasília). Ao começar, reservamos uma unidade para a sua partida. O brinde não depende da pontuação.`));
    } else {
      offer.append(el('p', {}, 'Vamos conferir seu convite com o servidor ao começar.'));
    }
    start.textContent = 'Começar com brinde';
  } else if (c) {
    offer.hidden = false;
    offer.append(el('h3', {}, 'Brinde da casa'));
    offer.append(el('p', {}, 'Peça à equipe seu acesso para participar com brinde.'));
    offer.append(el('p', { class: 'small' }, 'Sem convite, você pode jogar a demonstração — ela não emite brinde.'));
    start.textContent = 'Jogar demonstração';
  } else {
    start.textContent = 'Jogar para descobrir';
  }
  // Com convite, a oferta aparece ANTES do botão (o cliente vê o brinde antes de começar);
  // sem convite, o aviso vem depois, para o CTA ficar visível sem rolagem.
  const actions = start.closest('.actions');
  if (ctx.inviteToken) actions.before(offer); else actions.after(offer);
  setStage(0, { instant: true });
  show('welcome');
}

function renderProgress(answered) {
  const ol = $('progress');
  ol.replaceChildren(...Array.from({ length: ROUND_SIZE }, (_, i) => el('li', { class: i < answered ? 'done' : i === answered ? 'now' : '' })));
}

function renderQuestion() {
  const s = ctx.state.session;
  const q = ctx.current;
  const n = s.answeredCount + (ctx.feedback ? 0 : 1);
  const pos = ctx.feedback ? ctx.feedback.position + 1 : s.answeredCount + 1;
  $('q-count').textContent = `Pergunta ${pos} de ${ROUND_SIZE}`;
  $('q-cat').textContent = CATEGORY_LABELS[q.category] ?? q.category;
  renderProgress(ctx.feedback ? pos : pos - 1);
  $('bench').textContent = BENCH[ctx.feedback ? pos : pos - 1];
  $('q-text').textContent = q.question;
  const opts = $('options');
  opts.replaceChildren(...q.options.map((o, i) => {
    const b = el('button', { type: 'button', class: 'opt', 'data-option': o.id },
      el('span', { class: 'letter', 'aria-hidden': 'true' }, 'ABCD'[i]),
      el('span', { class: 'txt' }, o.text),
      el('span', { class: 'mark' }));
    b.addEventListener('click', () => choose(o.id));
    return b;
  }));
  $('netbox').hidden = true;
  $('score-line').textContent = `Pontos: ${s.score}`;
  void n;
  if (ctx.feedback) applyFeedback(false); else $('feedback').hidden = true;
  if (ctx.pending && ctx.pending.questionId === q.id) markPending();
}

function markPending() {
  for (const b of $('options').querySelectorAll('.opt')) {
    b.disabled = true;
    if (b.dataset.option === ctx.pending.selectedOptionId) { b.classList.add('pending'); b.setAttribute('aria-busy', 'true'); b.querySelector('.mark').textContent = 'Enviando…'; }
  }
}

function applyFeedback(moveFocus = true) {
  const f = ctx.feedback;
  const q = ctx.current;
  for (const b of $('options').querySelectorAll('.opt')) {
    const id = b.dataset.option;
    b.disabled = true;
    b.removeAttribute('aria-busy');
    b.classList.remove('pending');
    const mark = b.querySelector('.mark');
    if (id === f.correctOptionId) { b.classList.add('correct'); mark.textContent = '✓ Correta'; }
    else if (id === f.selectedOptionId) { b.classList.add('wrong'); mark.textContent = '✕ Sua resposta'; }
    else { b.classList.add('dim'); mark.textContent = ''; }
  }
  const box = $('feedback');
  box.hidden = false;
  box.className = `feedback ${f.correct ? 'ok' : 'no'}`;
  $('fb-title').textContent = f.correct ? '✓ Boa! Você acertou' : 'Mais um sabor para descobrir';
  const correct = q.options.find((o) => o.id === f.correctOptionId);
  $('fb-answer').textContent = f.correct ? `Resposta: ${correct?.text}` : `Resposta correta: ${correct?.text}`;
  $('fb-expl').textContent = f.explanation;
  $('btn-next').textContent = f.position + 1 >= ROUND_SIZE ? 'Ver minha pizza' : 'Próxima pergunta';
  $('score-line').textContent = `Pontos: ${ctx.state.session.score}`;
  $('netbox').hidden = true;
  if (moveFocus) requestAnimationFrame(() => $('fb-title').focus());
}

// ---------------------------------------------------------------- partida
async function choose(optionId) {
  if (ctx.busy || ctx.feedback) return;
  const q = ctx.current;
  ctx.pending = { questionId: q.id, selectedOptionId: optionId, key: newKey() };
  if (ctx.mode === 'server') store.set('gio.pending', ctx.pending);
  markPending();
  await submitAnswer();
}

async function submitAnswer(attempt = 0) {
  clearTimeout(ctx.retryTimer);
  const p = ctx.pending;
  if (!p) return;
  ctx.busy = true;
  try {
    const adapter = ctx.mode === 'server' ? server : demo;
    const r = await adapter.answer(p.questionId, p.selectedOptionId, p.key);
    ctx.pending = null;
    store.del('gio.pending');
    ctx.feedback = r;
    ctx.nextQuestion = r.next ?? null;
    Object.assign(ctx.state.session, { score: r.score, answeredCount: r.answeredCount });
    applyFeedback();
    renderProgress(r.answeredCount);
    $('bench').textContent = BENCH[r.answeredCount];
    setStage(r.answeredCount);
    if (r.correct) scene?.celebrate();
  } catch (e) {
    handleAnswerError(e, attempt);
  } finally {
    ctx.busy = false;
  }
}

function netbox(container, text, onRetry) {
  const box = $(container);
  box.hidden = false;
  box.replaceChildren(el('p', {}, text), el('button', { type: 'button', class: 'btn btn-secondary', onclick: onRetry }, 'Tentar agora'));
}

async function handleAnswerError(e, attempt) {
  if (e.network) {
    const wait = Math.min(15000, 2000 * 2 ** attempt);
    const letter = 'ABCD'[ctx.current.options.findIndex((o) => o.id === ctx.pending.selectedOptionId)];
    netbox('netbox', `Sem conexão no momento. Sua resposta (${letter}) está guardada aqui e será enviada assim que a rede voltar. Nada avança sem a confirmação do servidor.`, () => submitAnswer(attempt + 1));
    ctx.retryTimer = setTimeout(() => submitAnswer(attempt + 1), wait);
    return;
  }
  if (['ANSWER_CONFLICT', 'QUESTION_OUT_OF_ORDER', 'IDEMPOTENCY_CONFLICT'].includes(e.code)) {
    // Outro aparelho ou retry anterior já respondeu: volta ao estado canônico.
    ctx.pending = null; store.del('gio.pending');
    await resumeServer();
    return;
  }
  ctx.pending = null; store.del('gio.pending');
  showServerError(e);
}

function next() {
  if (!ctx.feedback) return;
  const answered = ctx.feedback.position + 1;
  if (answered >= ROUND_SIZE) return finish();
  ctx.current = ctx.nextQuestion ?? ctx.state.session.current;
  ctx.feedback = null;
  ctx.nextQuestion = null;
  renderQuestion();
  // Um único salto instantâneo para o topo + foco sem rolagem (duas rolagens concorrentes deixavam
  // os botões "andando" por ~1 s em aparelhos lentos).
  window.scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(() => $('q-text').focus({ preventScroll: true }));
}

async function finish(attempt = 0) {
  clearTimeout(ctx.retryTimer);
  // Na primeira tentativa a caixa de rede começa oculta; nas retentativas ela continua visível
  // (o botão não some sob o dedo de quem está tocando).
  if (attempt === 0) { show('completing', 'c-title'); $('c-netbox').hidden = true; }
  else { const p = $('c-netbox').querySelector('p'); if (p) p.textContent = 'Tentando de novo…'; }
  setStage(9);
  if (ctx.mode === 'demo') {
    const s = await demo.complete();
    ctx.state = s;
    return renderResult();
  }
  const sid = ctx.state.session.id;
  let key = store.get('gio.completeKey');
  if (!key || key.sid !== sid) { key = { sid, key: newKey() }; store.set('gio.completeKey', key); }
  ctx.completeKey = ctx.completeKey?.sid === sid ? ctx.completeKey : key;
  try {
    const s = await server.complete(ctx.completeKey.key);
    ctx.state = s;
    renderResult();
  } catch (e) {
    if (e.network) {
      const wait = Math.min(15000, 2000 * 2 ** attempt);
      netbox('c-netbox', 'Ainda sem resposta do servidor. Vamos tentar de novo automaticamente — nenhum brinde é considerado válido antes da confirmação.', () => finish(attempt + 1));
      ctx.retryTimer = setTimeout(() => finish(attempt + 1), wait);
      return;
    }
    showServerError(e);
  }
}

function voucherCard(v) {
  const card = el('article', { class: `voucher ${v.state}`, 'aria-labelledby': 'v-title' });
  const head = el('div', { class: 'voucher-head' }, el('strong', { id: 'v-title' }, 'Brinde Gio'),
    el('span', {}, { issued: 'Disponível', redeemed: 'Entregue', expired: 'Expirado', cancelled: 'Cancelado' }[v.state] ?? v.state));
  card.append(head);
  if (v.isTest) card.append(el('p', { class: 'test-banner' }, 'Teste — sem valor de resgate'));
  const body = el('div', { class: 'voucher-body' });
  body.append(el('p', { class: 'reward' }, rewardLine(v.rewardName, v.quantity)));
  if (v.rulesText) body.append(el('p', { class: 'rules' }, v.rulesText));
  if (v.state === 'issued' && v.credentialUnavailable) {
    body.append(el('p', { class: 'show' }, 'Não conseguimos exibir o código agora. Chame a equipe para conferir sua conta.'));
  } else if (v.state === 'issued') {
    const qr = el('div', { class: 'qr', role: 'img', 'aria-label': 'Código QR do brinde para a equipe' });
    qr.innerHTML = v.qrSvg; // SVG gerado pelo nosso servidor (biblioteca qrcode), sem conteúdo do usuário
    body.append(qr,
      el('p', { class: 'code', 'aria-label': `Código para digitar: ${v.code.split('').join(' ')}` }, v.code),
      el('p', { class: 'show' }, 'Mostre esta tela à equipe.'),
      el('p', { class: 'expiry' }, `Válido até ${fmtTime.format(new Date(v.expiresAt))} (horário de Brasília), conforme o relógio do servidor.`));
  } else if (v.state === 'redeemed') {
    body.append(el('p', { class: 'show' }, `✓ Entrega confirmada às ${fmtTime.format(new Date(v.redeemedAt))}.`));
  } else if (v.state === 'expired') {
    body.append(el('p', { class: 'show' }, `Este brinde expirou às ${fmtTime.format(new Date(v.expiresAt))}. Fale com a equipe se precisar de ajuda.`));
  } else if (v.state === 'cancelled') {
    body.append(el('p', { class: 'show' }, 'Este brinde foi cancelado pela equipe.'));
  }
  card.append(body);
  return card;
}

function renderResult() {
  clearInterval(ctx.pollTimer);
  const s = ctx.state.session;
  setStage(9);
  $('r-score').textContent = String(Math.round(s.score / 100));
  const area = $('voucher-area');
  area.replaceChildren();
  const actions = $('result-actions');
  actions.replaceChildren();
  if (ctx.mode === 'server') {
    if (ctx.state.voucher) {
      area.append(voucherCard(ctx.state.voucher));
      if (ctx.state.voucher.state === 'issued') ctx.pollTimer = setInterval(pollVoucher, 15000);
    } else {
      area.append(el('div', { class: 'demo-note' }, el('p', {}, 'Estamos conferindo seu brinde.'),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => finish() }, 'Conferir novamente')));
    }
    actions.append(el('button', { type: 'button', class: 'btn btn-secondary', onclick: startDemo }, 'Jogar de novo (demonstração)'));
    area.append(el('p', { class: 'small' }, 'Jogar de novo é só pela diversão: a demonstração não emite outro brinde.'));
  } else {
    area.append(el('div', { class: 'demo-note' },
      el('p', {}, el('strong', {}, 'Modo demonstração: '), 'nenhum brinde é emitido nesta partida.'),
      el('p', {}, ctx.campaign ? 'Para participar com brinde, peça à equipe o seu acesso.' : 'Obrigado por jogar com a gente!')));
    actions.append(el('button', { type: 'button', class: 'btn btn-primary', onclick: startDemo }, 'Jogar de novo'));
    if (ctx.serverVoucherState) actions.append(el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => resumeServer() }, 'Voltar ao meu brinde'));
  }
  const list = $('review-list');
  list.replaceChildren(...s.answered.map((a) => {
    const correct = a.question.options.find((o) => o.id === a.correctOptionId)?.text;
    return el('li', {}, el('span', {}, a.question.question), el('br'),
      el('span', { class: a.correct ? 'r-ok' : 'r-no' }, a.correct ? '✓ Acertou' : '✕ Não foi dessa vez'), ` — ${correct}`);
  }));
  setModePill();
  show('result', 'r-title');
}

async function pollVoucher() {
  if (document.hidden || ctx.mode !== 'server') return;
  try {
    const r = await server.voucher();
    if (r.voucher && r.voucher.state !== ctx.state.voucher?.state) {
      ctx.state.voucher = r.voucher;
      renderResult();
    }
  } catch { /* rede instável: tenta no próximo ciclo; não altera o que está na tela */ }
}

function startDemo() {
  clearInterval(ctx.pollTimer);
  if (ctx.mode === 'server' && ctx.state?.voucher) ctx.serverVoucherState = ctx.state.voucher.state;
  ctx.mode = 'demo';
  demo.clear();
  ctx.state = demo.start();
  enterQuestions();
}

function enterQuestions() {
  ctx.feedback = null;
  ctx.current = ctx.state.session.current;
  setModePill();
  setStage(ctx.state.session.answeredCount, { instant: true });
  renderQuestion();
  show('question', 'q-text');
}

const MSG = {
  SESSION_EXPIRED: 'O tempo desta partida terminou e o brinde reservado voltou ao estoque. Fale com a equipe se precisar de ajuda.',
  SESSION_CANCELLED: 'Esta partida foi cancelada pela equipe.',
  SESSION_REQUIRED: 'Não encontramos uma partida neste aparelho. Se você já começou, peça à equipe um novo link de acesso: a mesma partida será retomada, sem perder respostas.',
};

function showServerError(e) {
  $('x-title').textContent = e.code === 'OUT_OF_STOCK' ? 'Brindes esgotados' : e.code?.startsWith('INVITATION') ? 'Convite indisponível' : 'Algo não saiu como esperado';
  $('x-msg').textContent = MSG[e.code] ?? e.message;
  const acts = $('x-actions');
  acts.replaceChildren(
    el('button', { type: 'button', class: 'btn btn-primary', onclick: startDemo }, 'Jogar a demonstração'),
    el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => location.reload() }, 'Recarregar'));
  show('recovery', 'x-title');
}

async function startWithInvite() {
  const btn = $('btn-start');
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  try {
    const r = await server.exchange(ctx.inviteToken);
    ctx.inviteToken = null;
    ctx.mode = 'server';
    ctx.state = r;
    afterServerState();
  } catch (e) {
    if (e.network) {
      const offer = $('offer');
      offer.append(el('p', { role: 'alert' }, 'Sem conexão para conferir o convite. Tente novamente em instantes.'));
    } else {
      ctx.inviteToken = null;
      showServerError(e);
    }
  } finally {
    btn.disabled = false; btn.removeAttribute('aria-busy');
  }
}

function afterServerState() {
  const s = ctx.state.session;
  setModePill();
  if (s.state === 'completed') return renderResult();
  if (s.state === 'expired') return showServerError({ code: 'SESSION_EXPIRED' });
  if (s.state === 'cancelled') return showServerError({ code: 'SESSION_CANCELLED' });
  if (s.answeredCount >= ROUND_SIZE) return finish();
  ctx.feedback = null;
  ctx.current = s.current;
  setStage(s.answeredCount, { instant: true });
  renderQuestion();
  show('question', 'q-text');
  // Resposta que ficou pendente antes de um recarregamento: reenvia com a MESMA chave.
  const p = store.get('gio.pending');
  if (p && p.questionId === s.current?.id && typeof p.key === 'string') {
    ctx.pending = p;
    markPending();
    submitAnswer();
  } else if (p) {
    store.del('gio.pending');
  }
}

async function resumeServer() {
  try {
    ctx.state = await server.load();
    ctx.mode = 'server';
    afterServerState();
    return true;
  } catch (e) {
    if (e.code === 'SESSION_REQUIRED') return false;
    if (e.network) return 'network';
    showServerError(e);
    return true;
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  // Convite chega no fragmento (#convite=...): lido em memória e removido da URL imediatamente.
  const m = location.hash.match(/convite=([A-Za-z0-9_-]{20,200})/);
  if (m) {
    ctx.inviteToken = m[1];
    history.replaceState(null, '', location.pathname);
  }

  const savedLight = store.getLocal('gio.light');
  const saveData = navigator.connection?.saveData === true;
  lightMode = savedLight ?? saveData;
  $('light-toggle').setAttribute('aria-pressed', String(lightMode));
  $('light-toggle').addEventListener('click', () => setLightMode(!lightMode));
  $('btn-how').addEventListener('click', () => $('how-dialog').showModal());
  $('btn-next').addEventListener('click', next);
  $('btn-start').addEventListener('click', () => {
    if (ctx.inviteToken) return startWithInvite();
    startDemo();
  });

  // A cena carrega em paralelo; o CTA não espera por ela.
  mountScene(lightMode);

  const [campaign, resumed] = await Promise.all([
    fetch('/api/campaign/current', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ctx.inviteToken ? Promise.resolve(false) : resumeServer(),
  ]);
  ctx.campaign = campaign?.mode === 'campaign' ? campaign.campaign : null;
  if (resumed === true) return;

  // Demonstração em andamento nesta aba: retoma.
  if (!ctx.inviteToken) {
    const d = demo.resume();
    if (d && d.session.answeredCount > 0 && d.session.answeredCount < ROUND_SIZE) {
      ctx.mode = 'demo';
      ctx.state = d;
      return enterQuestions();
    }
  }
  renderWelcome();
  if (resumed === 'network') {
    $('offer').hidden = false;
    $('offer').append(el('p', { role: 'status' }, 'Sem conexão com o servidor agora. A demonstração funciona normalmente.'));
  }
}

window.__gioDebug = { sceneInfo: () => scene?.info ?? null, stage: () => sceneStage, sceneState: () => scene?.debugState?.() ?? null, settle: () => scene?.settle?.() };
boot();
