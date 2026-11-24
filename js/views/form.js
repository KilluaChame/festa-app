import { getById, upsert, remove } from '../store.js';
import { total, aReceber, status, STATUS_TEXTO } from '../core/calc.js';
import { brl, esc, novoId } from '../core/util.js';

export function renderForm(el, id) {
  const existente = id && getById(id);
  const p = existente ? structuredClone(existente) : {
    id: novoId(), cliente: '', aniversariante: '', endereco: '', data: '', horario: '',
    itens: [{ nome: 'Animação', valor: '' }, { nome: 'Recreação', valor: '' }],
    recebido: '', obs: ''
  };
  const $ = s => el.querySelector(s);

  el.innerHTML = `
  <header class="barra"><a href="#/" class="voltar">‹ Voltar</a><h1>${existente ? 'Editar festa' : 'Nova festa'}</h1></header>
  <div class="form">
    <label>Nome do cliente<input name="cliente" autocomplete="off"></label>
    <label>Nome do aniversariante<input name="aniversariante" autocomplete="off"></label>
    <div class="duas">
      <label>Data da festa<input name="data" type="date"></label>
      <label>Horário contratado<input name="horario" placeholder="14:00 às 17:00"></label>
    </div>
    <label>Endereço da festa<input name="endereco" autocomplete="off"></label>

    <h2>Pacote da festa</h2>
    <div id="itens"></div>
    <button class="sec" id="addItem" type="button">+ Adicionar item</button>

    <label>Valor já recebido (R$)<input name="recebido" type="number" inputmode="decimal" step="0.01" min="0"></label>
    <div class="totais" id="totais"></div>

    <label>Observações<textarea name="obs" rows="4"></textarea></label>
    <p class="erro" id="erro"></p>
    <button class="prim" id="salvar" type="button">Salvar festa</button>
    ${existente ? '<button class="perigo" id="excluir" type="button">Excluir festa</button>' : ''}
  </div>`;

  ['cliente', 'aniversariante', 'data', 'horario', 'endereco', 'recebido', 'obs'].forEach(k => {
    const campo = $(`[name=${k}]`);
    campo.value = p[k];
    campo.addEventListener('input', () => { p[k] = campo.value; totais(); });
  });

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
    p.recebido = Number(p.recebido) || 0;
    p.itens = p.itens.filter(i => i.nome.trim() || Number(i.valor)).map(i => ({ nome: i.nome.trim(), valor: Number(i.valor) || 0 }));
    upsert(p);
    location.hash = '#/';
  };
  if (existente) $('#excluir').onclick = () => {
    if (confirm('Excluir esta festa? Não dá para desfazer.')) { remove(p.id); location.hash = '#/'; }
  };

  itens(); totais();
}
