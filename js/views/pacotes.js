// Gerenciamento de pacotes pré-prontos (lista na aba Pacotes + formulário #/pacote/:id)
import { getPacotes, getPacoteById, upsertPacote, removePacote } from '../store.js';
import { brl, esc, novoId } from '../core/util.js';

/** Gera o HTML da lista de pacotes para exibir na aba Pacotes da tela inicial. */
export function htmlListaPacotes(pacotes) {
  if (!pacotes.length) {
    return `<p class="vazio">Nenhum pacote salvo ainda.<br>Toque em <b>+</b> para criar seu primeiro pacote pronto.</p>`;
  }
  return pacotes.map(p => {
    const totalPacote = (p.itens ?? []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const itensTexto = (p.itens ?? []).map(i => `${esc(i.nome)} (${brl(i.valor)})`).join(' · ');
    return `<a class="card" style="border-left-color:var(--pri)" href="#/pacote/${p.id}">
      <div class="linha1"><b>${esc(p.nome) || 'Sem nome'}</b><span style="font-weight:700;color:var(--pri)">${brl(totalPacote)}</span></div>
      <div class="info" style="margin-top:4px">${itensTexto || 'Sem itens'}</div>
    </a>`;
  }).join('');
}

/** Formulário de criação/edição de pacote — rota #/pacote/novo ou #/pacote/:id */
export function renderPacoteForm(el, id) {
  const existente = id ? getPacoteById(id) : null;
  const p = existente ? structuredClone(existente) : {
    id: novoId(),
    nome: '',
    itens: [{ nome: 'Animação', valor: '' }, { nome: 'Recreação', valor: '' }],
  };
  const $ = s => el.querySelector(s);

  el.innerHTML = `
  <header class="barra">
    <a href="#/pacotes" class="voltar">‹ Voltar</a>
    <h1>${existente ? 'Editar pacote' : 'Novo pacote'}</h1>
  </header>
  <div class="form">
    <label>Nome do pacote<input id="pNome" autocomplete="off" placeholder="Ex: Pacote Ouro"></label>

    <h2>Itens do pacote</h2>
    <div id="pItens"></div>
    <button class="sec" id="pAddItem" type="button">+ Adicionar item</button>

    <div class="totais" id="pTotal" style="margin-top:16px"></div>

    <p class="erro" id="pErro"></p>
    <button class="prim" id="pSalvar" type="button">Salvar pacote</button>
    ${existente ? '<button class="perigo" id="pExcluir" type="button">Excluir pacote</button>' : ''}
  </div>`;

  $('#pNome').value = p.nome;
  $('#pNome').addEventListener('input', () => { p.nome = $('#pNome').value; });

  function totalPacote() {
    const t = p.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    $('#pTotal').innerHTML = `<div><span>Total do pacote</span><b>${brl(t)}</b></div>`;
  }

  function itens() {
    $('#pItens').innerHTML = p.itens.map((it, i) => `
      <div class="item">
        <input data-i="${i}" data-k="nome" value="${esc(it.nome)}" placeholder="Ex: Animação">
        <input data-i="${i}" data-k="valor" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(it.valor)}" placeholder="R$">
        <button class="x" data-del="${i}" type="button" aria-label="Remover item">×</button>
      </div>`).join('');
  }

  $('#pItens').addEventListener('input', e => {
    const { i, k } = e.target.dataset;
    if (i !== undefined) { p.itens[i][k] = e.target.value; totalPacote(); }
  });
  $('#pItens').addEventListener('click', e => {
    if (e.target.dataset.del !== undefined) { p.itens.splice(+e.target.dataset.del, 1); itens(); totalPacote(); }
  });
  $('#pAddItem').onclick = () => { p.itens.push({ nome: '', valor: '' }); itens(); totalPacote(); };

  $('#pSalvar').onclick = () => {
    if (!p.nome.trim()) { $('#pErro').textContent = 'Dê um nome ao pacote.'; return; }
    p.nome = p.nome.trim();
    p.itens = p.itens.filter(i => i.nome.trim() || Number(i.valor))
                     .map(i => ({ nome: i.nome.trim(), valor: Number(i.valor) || 0 }));
    if (!p.itens.length) { $('#pErro').textContent = 'Adicione pelo menos um item.'; return; }
    upsertPacote(p);
    location.hash = '#/pacotes';
  };

  if (existente) {
    $('#pExcluir').onclick = () => {
      if (confirm('Excluir este pacote? Festas já cadastradas não serão alteradas.')) {
        removePacote(p.id);
        location.hash = '#/pacotes';
      }
    };
  }

  itens(); totalPacote();
}
