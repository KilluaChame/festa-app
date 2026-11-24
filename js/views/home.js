import { getAll } from '../store.js';
import { total, aReceber, status, STATUS_TEXTO } from '../core/calc.js';
import { brl, esc, hoje, fmtData } from '../core/util.js';
import { estadoSync } from '../sync/github.js';

let aba = 'proximas';

export function renderHome(el) {
  const todas = getAll(), h = hoje();
  const chave = p => p.data + (p.horario || '');
  const proximas = todas.filter(p => p.data >= h).sort((a, b) => chave(a).localeCompare(chave(b)));
  const passadas = todas.filter(p => p.data <  h).sort((a, b) => chave(b).localeCompare(chave(a)));
  const lista = aba === 'proximas' ? proximas : passadas;
  const falta = todas.reduce((s, p) => s + aReceber(p), 0);
  const noMes = todas.filter(p => p.data.startsWith(h.slice(0, 7))).length;

  el.innerHTML = `
  <header class="topo">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h1>Minhas Festas</h1>
      <a href="#/config" style="color:#fff;font-size:.85rem;opacity:.85" aria-label="Configurações">⚙ Config</a>
    </div>
    <div class="resumo">
      <div class="destaque"><span>Total a receber</span><strong>${brl(falta)}</strong></div>
      <div><span>Festas no mês</span><strong>${noMes}</strong></div>
    </div>
    ${badgeSync()}
  </header>
  <nav class="abas">
    <button data-aba="proximas" class="${aba === 'proximas' ? 'on' : ''}">Próximas (${proximas.length})</button>
    <button data-aba="passadas" class="${aba === 'passadas' ? 'on' : ''}">Passadas (${passadas.length})</button>
  </nav>
  <section class="lista">
    ${lista.length ? lista.map(card).join('') :
      `<p class="vazio">${aba === 'proximas' ? 'Nenhuma festa marcada. Toque em + para cadastrar.' : 'Nenhuma festa passada.'}</p>`}
  </section>
  <a class="fab" href="#/nova" aria-label="Nova festa">+</a>`;

  el.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; renderHome(el); });
}

/** Badge discreto de status de sincronização. */
function badgeSync() {
  const { status, mensagem } = estadoSync;
  const estilos = {
    ok:            'background:rgba(255,255,255,.18);color:#fff',
    sincronizando: 'background:rgba(255,255,255,.18);color:#fff',
    pendente:      'background:rgba(255,200,61,.25);color:#fff',
    erro:          'background:rgba(194,58,58,.35);color:#fff',
    ocioso:        '',
  };
  if (status === 'ocioso') return '';
  const textos = {
    ok:            '✓ Sincronizado',
    sincronizando: '↻ Sincronizando…',
    pendente:      '⏳ Pendente',
    erro:          '✗ Erro de sync — toque em Config',
  };
  const estilo = estilos[status] ?? '';
  const texto  = textos[status] ?? mensagem;
  return `<div style="margin-top:8px;padding:4px 10px;border-radius:999px;font-size:.78rem;display:inline-block;${estilo}">${texto}</div>`;
}

function card(p) {
  const s = status(p);
  return `<a class="card ${s}" href="#/festa/${p.id}">
    <div class="linha1"><b>${esc(p.aniversariante) || 'Sem nome'}</b><span class="selo ${s}">${STATUS_TEXTO[s]}</span></div>
    <div class="info">${fmtData(p.data)}${p.horario ? ' às ' + esc(p.horario) : ''}</div>
    <div class="info">Cliente: ${esc(p.cliente) || '-'}</div>
    <div class="valores"><span>Total ${brl(total(p))}</span><span>Falta <b>${brl(aReceber(p))}</b></span></div>
  </a>`;
}
