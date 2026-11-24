import { getById, getPacotes, upsert, remove } from '../store.js';
import { total, aReceber, status, STATUS_TEXTO } from '../core/calc.js';
import { brl, esc, novoId } from '../core/util.js';

/** Parseia "14:00 às 17:00" em { inicio: "14:00", fim: "17:00" }. */
function parseHorario(horario) {
  if (!horario) return { inicio: '', fim: '' };
  const m = horario.match(/(\d{1,2}[:h]\d{0,2})\s*(?:às|as|-|a)\s*(\d{1,2}[:h]\d{0,2})/i);
  if (!m) return { inicio: horario, fim: '' };
  const norm = t => t.replace('h', ':').replace(/:$/, ':00').replace(/^(\d):/, '0$1:').replace(/:(\d)$/, ':0$1');
  return { inicio: norm(m[1]), fim: norm(m[2]) };
}

/** Junta dois campos de hora em "HH:MM às HH:MM" (ou só um se fim vazio). */
function juntarHorario(inicio, fim) {
  if (!inicio && !fim) return '';
  if (!fim) return inicio;
  return `${inicio} às ${fim}`;
}

export function renderForm(el, id) {
  const existente = id && getById(id);
  const pacotes = getPacotes();
  const p = existente ? structuredClone(existente) : {
    id: novoId(), cliente: '', aniversariante: '', endereco: '', data: '', horario: '',
    itens: [{ nome: 'Animação', valor: '' }, { nome: 'Recreação', valor: '' }],
    recebido: '', obs: '',
  };
  const $ = s => el.querySelector(s);

  const { inicio: hInicio, fim: hFim } = parseHorario(p.horario);

  el.innerHTML = `
  <header class="barra"><a href="#/" class="voltar">‹ Voltar</a><h1>${existente ? 'Editar festa' : 'Nova festa'}</h1></header>
  <div class="form">
    <label>Nome do cliente<input name="cliente" autocomplete="off"></label>
    <label>Nome do aniversariante<input name="aniversariante" autocomplete="off"></label>
    <label>Data da festa<input name="data" type="date"></label>

    <div class="duas" style="margin-top:14px">
      <label style="margin-top:0">
        <span style="display:block;font-size:.9rem;color:var(--mut);font-weight:600">Início</span>
        <input name="hInicio" type="time" style="margin-top:4px">
      </label>
      <label style="margin-top:0">
        <span style="display:block;font-size:.9rem;color:var(--mut);font-weight:600">Término</span>
        <input name="hFim" type="time" style="margin-top:4px">
      </label>
    </div>

    <label>Endereço da festa<input name="endereco" autocomplete="off"></label>

    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:22px">
      <h2 style="margin:0">Pacote da festa</h2>
      <a href="#/pacotes" style="font-size:.82rem;color:var(--pri);font-weight:600">Gerenciar pacotes</a>
    </div>

    ${pacotes.length ? `
      <div class="chips" id="chipsPacotes">
        ${pacotes.map(pk => {
          const t = (pk.itens ?? []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
          return `<button type="button" class="chip" data-pacote="${pk.id}">${esc(pk.nome)} · ${brl(t)}</button>`;
        }).join('')}
      </div>
    ` : `<p style="color:var(--mut);font-size:.84rem;margin:6px 0 10px">Você pode criar pacotes prontos na aba <b>Pacotes</b>.</p>`}

    <div id="itens"></div>
    <button class="sec" id="addItem" type="button">+ Adicionar item personalizado</button>

    <label>Valor já recebido (R$)<input name="recebido" type="number" inputmode="decimal" step="0.01" min="0"></label>
    <div class="totais" id="totais"></div>

    <label>Observações<textarea name="obs" rows="4"></textarea></label>
    <p class="erro" id="erro"></p>
    <button class="prim" id="salvar" type="button">Salvar festa</button>
    ${existente ? '<button class="perigo" id="excluir" type="button">Excluir festa</button>' : ''}
  </div>`;

  // Preenche campos simples
  ['cliente', 'aniversariante', 'data', 'endereco', 'recebido', 'obs'].forEach(k => {
    const campo = $(`[name=${k}]`);
    campo.value = p[k];
    campo.addEventListener('input', () => { p[k] = campo.value; totais(); });
  });

  // Preenche e liga campos de horário
  const campoInicio = $('[name="hInicio"]');
  const campoFim    = $('[name="hFim"]');
  campoInicio.value = hInicio;
  campoFim.value    = hFim;
  function atualizarHorario() {
    p.horario = juntarHorario(campoInicio.value, campoFim.value);
  }
  campoInicio.addEventListener('change', atualizarHorario);
  campoFim.addEventListener('change', atualizarHorario);

  // Selecionar pacote pré-pronto
  const chipsEl = $('#chipsPacotes');
  if (chipsEl) {
    chipsEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-pacote]');
      if (!btn) return;
      const pk = pacotes.find(item => item.id === btn.dataset.pacote);
      if (!pk) return;

      const temValores = p.itens.some(i => Number(i.valor) > 0);
      if (temValores && !confirm(`Aplicar "${pk.nome}" e substituir os itens atuais?`)) return;

      p.itens = (pk.itens ?? []).map(i => ({ nome: i.nome, valor: i.valor }));
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === btn));
      itens();
      totais();
    });
  }

  function totais() {
    const s = status(p);
    $('#totais').innerHTML = `
      <div><span>Total da festa</span><b>${brl(total(p))}</b></div>
      <div><span>Valor a receber</span><b>${brl(aReceber(p))}</b></div>
      <div><span>Situação</span><b class="selo ${s}">${STATUS_TEXTO[s]}</b></div>`;
  }
  function itens() {
    $('#itens').innerHTML = p.itens.map((it, i) => `
      <div class="item">
        <input data-i="${i}" data-k="nome" value="${esc(it.nome)}" placeholder="Ex: Animação">
        <input data-i="${i}" data-k="valor" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(it.valor)}" placeholder="R$">
        <button class="x" data-del="${i}" type="button" aria-label="Remover item">×</button>
      </div>`).join('');
  }
  $('#itens').addEventListener('input', e => {
    const { i, k } = e.target.dataset;
    if (i !== undefined) { p.itens[i][k] = e.target.value; totais(); }
  });
  $('#itens').addEventListener('click', e => {
    if (e.target.dataset.del !== undefined) { p.itens.splice(+e.target.dataset.del, 1); itens(); totais(); }
  });
  $('#addItem').onclick = () => { p.itens.push({ nome: '', valor: '' }); itens(); totais(); };

  $('#salvar').onclick = () => {
    if (!p.data) { $('#erro').textContent = 'Informe a data da festa.'; return; }
    atualizarHorario();
    p.recebido = Number(p.recebido) || 0;
    p.itens = p.itens.filter(i => i.nome.trim() || Number(i.valor))
                     .map(i => ({ nome: i.nome.trim(), valor: Number(i.valor) || 0 }));
    upsert(p);
    location.hash = '#/';
  };

  if (existente) {
    $('#excluir').onclick = () => {
      if (confirm('Excluir esta festa? O evento do Google Agenda também será removido.')) {
        remove(p.id);
        location.hash = '#/';
      }
    };
  }

  itens(); totais();
}
