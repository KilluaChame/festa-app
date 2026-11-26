import { getAll, getPacotes, getBolsas } from '../store.js';
import { total, recebido, aReceber, status, statusGrupo, STATUS_TEXTO } from '../core/calc.js';
import { brl, esc, hoje, fmtData } from '../core/util.js';
import { estadoSync } from '../sync/github.js';
import { estadoAgenda } from '../sync/agenda.js';
import { htmlListaPacotes } from './pacotes.js';
import { htmlListaMateriais, bindEventosMateriais } from './materiais.js';

let aba = 'proximas';

export function setAba(novaAba) {
  aba = novaAba;
}

export function renderHome(el) {
  const todas = getAll(), pacotes = getPacotes(), bolsas = getBolsas(), h = hoje();
  const mesAtual = h.slice(0, 7);
  const chave = p => p.data + (p.horario || '');
  const proximas = todas.filter(p => p.data >= h).sort((a, b) => chave(a).localeCompare(chave(b)));
  const passadas = todas.filter(p => p.data <  h).sort((a, b) => chave(b).localeCompare(chave(a)));

  const falta = todas.reduce((s, p) => s + aReceber(p), 0);
  const festasMes = todas.filter(p => p.data.startsWith(mesAtual));
  const feitoMes = festasMes.reduce((s, p) => s + total(p), 0);
  const recebidoMes = festasMes.reduce((s, p) => s + recebido(p), 0);
  const faltaMes = festasMes.reduce((s, p) => s + aReceber(p), 0);
  const corMes = statusGrupo(feitoMes, recebidoMes, faltaMes);
  const infoMes = faltaMes > 0
    ? `Falta ${brl(faltaMes)} · Ver meses ›`
    : feitoMes > 0 ? 'Tudo recebido · Ver meses ›' : 'Ver meses ›';

  let conteudoLista = '';
  if (aba === 'pacotes') {
    conteudoLista = htmlListaPacotes(pacotes);
  } else if (aba === 'materiais') {
    conteudoLista = htmlListaMateriais(bolsas);
  } else {
    const lista = aba === 'proximas' ? proximas : passadas;
    conteudoLista = lista.length ? lista.map(card).join('') :
      `<p class="vazio">${aba === 'proximas' ? 'Nenhuma festa marcada. Toque em + para cadastrar.' : 'Nenhuma festa passada.'}</p>`;
  }

  const FAB = {
    pacotes:   { href: '#/pacote/novo',   label: 'Novo pacote' },
    materiais: { href: '#/material/novo', label: 'Novo conjunto' },
  };
  const fab = FAB[aba] ?? { href: '#/nova', label: 'Nova festa' };

  el.innerHTML = `
  <header class="topo">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h1>Minhas Festas</h1>
      <a href="#/config" style="color:#fff;font-size:.85rem;opacity:.85" aria-label="Configurações">⚙ Config</a>
    </div>
    <div class="resumo">
      <div class="destaque"><span>Total a receber</span><strong>${brl(falta)}</strong></div>
      <a href="#/mensal" class="${corMes}" aria-label="Ver faturamento por mês">
        <span>Feito no mês (${festasMes.length})</span>
        <strong>${brl(feitoMes)}</strong>
        <div class="sub">${infoMes}</div>
      </a>
    </div>
    ${badgeSync()}
  </header>
  <nav class="abas">
    <button data-aba="proximas"  class="${aba === 'proximas'  ? 'on' : ''}">Próximas (${proximas.length})</button>
    <button data-aba="passadas"  class="${aba === 'passadas'  ? 'on' : ''}">Passadas (${passadas.length})</button>
    <button data-aba="pacotes"   class="${aba === 'pacotes'   ? 'on' : ''}">Pacotes (${pacotes.length})</button>
    <button data-aba="materiais" class="${aba === 'materiais' ? 'on' : ''}">Materiais (${bolsas.length})</button>
  </nav>
  <section class="lista">
    ${conteudoLista}
  </section>
  <a class="fab" href="${fab.href}" aria-label="${fab.label}">+</a>`;

  el.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
    aba = b.dataset.aba;
    if (location.hash === '#/pacotes' || location.hash === '#/materiais') {
      history.replaceState(null, '', '#/');
    }
    renderHome(el);
  });

  if (aba === 'materiais') {
    bindEventosMateriais(el, () => renderHome(el));
  }
}

/** Badges discretos de status (GitHub sync + Google Agenda). */
function badgeSync() {
  const badges = [];

  // Badge GitHub
  const gs = estadoSync.status;
  if (gs !== 'ocioso') {
    const cores = {
      ok: 'rgba(255,255,255,.18)', sincronizando: 'rgba(255,255,255,.18)',
      pendente: 'rgba(255,200,61,.25)', erro: 'rgba(194,58,58,.35)',
    };
    const textos = {
      ok: '⇅ Sync', sincronizando: '↻ Sync…', pendente: '⏳ Sync', erro: '✗ Sync — Config',
    };
    badges.push(`<div style="padding:4px 10px;border-radius:999px;font-size:.78rem;background:${cores[gs] ?? 'transparent'};color:#fff">${textos[gs] ?? gs}</div>`);
  }

  // Badge Google Agenda
  const ag = estadoAgenda.status;
  if (ag !== 'ocioso') {
    const cores = {
      ok: 'rgba(255,255,255,.18)', sincronizando: 'rgba(255,255,255,.18)',
      erro: 'rgba(194,58,58,.45)',
    };
    const textos = {
      ok: '📅 Agenda', sincronizando: '📅 Agenda…', erro: '✗ Agenda — tocar para corrigir',
    };
    badges.push(`<a href="#/config" style="padding:4px 10px;border-radius:999px;font-size:.78rem;background:${cores[ag] ?? 'transparent'};color:#fff">${textos[ag] ?? ag}</a>`);
  }

  if (!badges.length) return '';
  const msgErro = ag === 'erro' && estadoAgenda.mensagem
    ? `<div style="margin-top:6px;font-size:.78rem;color:#fff;opacity:.95">${esc(estadoAgenda.mensagem)}</div>`
    : '';
  return `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${badges.join('')}</div>${msgErro}`;
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
