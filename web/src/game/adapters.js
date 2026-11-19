// Duas fontes de partida com a mesma interface:
//  - DemoAdapter: banco local, sem brinde (nunca emite voucher);
//  - ServerAdapter: partida autorizada, montada e corrigida no servidor.
import { api } from './api.js';
import { drawRound, isCorrect, publicQuestion, scoreOf, ROUND_SIZE } from '../../../shared/quiz.js';

const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage indisponível: segue em memória */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* idem */ } },
  getLocal(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  setLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* idem */ } },
};
export { store };

const DEMO_KEY = 'gio.demo.v1';
const demoScore = (answers) => scoreOf(answers.map((a) => ({ isCorrect: a.correct === true })));

function newPlayId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function cryptoRng() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export class DemoAdapter {
  constructor(bank) {
    this.kind = 'demo';
    this.bank = bank;
    this.round = null;
    this.answers = [];
  }

  /** Retoma a demo da aba (se íntegra) ou começa outra. Storage corrompido é descartado. */
  resume() {
    const saved = store.get(DEMO_KEY);
    const valid = saved && Array.isArray(saved.round) && saved.round.length === ROUND_SIZE && Array.isArray(saved.answers)
      && saved.answers.length <= ROUND_SIZE && saved.round.every((q) => q && q.id && Array.isArray(q.options) && q.correctOptionId);
    if (!valid) { if (saved) store.del(DEMO_KEY); return null; }
    this.round = saved.round; this.answers = saved.answers;
    this.playId = typeof saved.playId === 'string' ? saved.playId : newPlayId();
    return this.state();
  }

  start() {
    const seen = new Set(store.getLocal('gio.demo.seen') ?? []);
    this.round = drawRound(this.bank, cryptoRng, { seen });
    this.answers = [];
    this.playId = newPlayId();
    const nextSeen = [...seen, ...this.round.map((q) => q.id)].slice(-24);
    store.setLocal('gio.demo.seen', nextSeen);
    this.persist();
    return this.state();
  }

  persist() { store.set(DEMO_KEY, { round: this.round, answers: this.answers, playId: this.playId }); }
  clear() { store.del(DEMO_KEY); this.round = null; this.answers = []; this.playId = null; }

  state() {
    const n = this.answers.length;
    return {
      demo: true,
      session: {
        state: n >= ROUND_SIZE && this.completed ? 'completed' : 'active',
        total: ROUND_SIZE,
        answeredCount: n,
        score: demoScore(this.answers),
        current: n < ROUND_SIZE ? publicQuestion(this.round[n]) : null,
        answered: this.answers.map((a, i) => ({ question: publicQuestion(this.round[i]), ...a })),
      },
      voucher: null,
    };
  }

  async answer(questionId, selectedOptionId) {
    const pos = this.answers.length;
    const q = this.round[pos];
    const existing = this.answers.find((a) => a.questionId === questionId);
    if (existing) return { ...existing, score: demoScore(this.answers), answeredCount: this.answers.length, duplicate: true };
    if (!q || q.id !== questionId) throw Object.assign(new Error('Pergunta fora de ordem'), { code: 'QUESTION_OUT_OF_ORDER' });
    const a = {
      position: pos, questionId, selectedOptionId, correct: isCorrect(q, selectedOptionId),
      correctOptionId: q.correctOptionId, explanation: q.explanation, sourceId: q.sourceId,
    };
    this.answers.push(a);
    this.persist();
    const next = pos + 1 < ROUND_SIZE ? publicQuestion(this.round[pos + 1]) : null;
    return { ...a, next, score: demoScore(this.answers), answeredCount: this.answers.length };
  }

  async complete() {
    this.completed = true;
    const s = this.state();
    s.session.state = 'completed';
    this.saveResult();
    return s; // demo: nunca há voucher
  }

  /** Envia as escolhas para o servidor guardar no cadastro (ele recorrige). Não bloqueia o resultado. */
  saveResult() {
    if (this.answers.length !== ROUND_SIZE || !this.playId || this.savedPlayId === this.playId) return;
    this.savedPlayId = this.playId;
    const body = { playId: this.playId, answers: this.answers.map((a) => ({ questionId: a.questionId, selectedOptionId: a.selectedOptionId })) };
    const send = async (attempt) => {
      try {
        await api('/api/play/result', { method: 'POST', body });
      } catch (e) {
        const retry = e.code === 'NETWORK' || e.code === 'TIMEOUT' || (e.status >= 500);
        if (retry && attempt < 3) setTimeout(() => send(attempt + 1), 3000 * 2 ** attempt);
      }
    };
    send(0);
  }
}

export class ServerAdapter {
  constructor() { this.kind = 'server'; }
  exchange(token) { return api('/api/player/exchange', { method: 'POST', body: { token } }); }
  load() { return api('/api/player/session'); }
  answer(questionId, selectedOptionId, key) {
    return api('/api/player/session/answer', { method: 'POST', body: { questionId, selectedOptionId }, headers: { 'idempotency-key': key } });
  }
  complete(key) { return api('/api/player/session/complete', { method: 'POST', body: {}, headers: { 'idempotency-key': key } }); }
  voucher() { return api('/api/player/voucher'); }
  leave() { return api('/api/player/leave', { method: 'POST', body: {} }); }
}
