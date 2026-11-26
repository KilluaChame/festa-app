// Gerenciamento de bolsas e listas de materiais — aba Materiais e formulário #/bolsa/:id
import { getBolsas, getBolsaById, upsertBolsa, upsertBolsasLote, removeBolsa } from '../store.js';
import { esc, novoId } from '../core/util.js';

const CORES = ['verde', 'amarelo', 'vermelho', 'azul'];

const COR_LABEL = {
  verde: 'Tenho',
  amarelo: 'Reparo / Obs',
  vermelho: 'Não tenho',
  azul: 'Emprestado',
};

const ORDEM_TIPOS = ['Animação', 'Recreação', 'Outro'];

/** Listas iniciais de Animação e Recreação prontas para carregar com 1 toque. */
function criarBolsasPadrao() {
  const mat = nome => ({ id: novoId(), nome, cor: 'verde', obs: '' });
  return [
    {
      id: novoId(), tipo: 'Animação', numero: 1, nome: 'Itens avulsos (Animação)',
      cor: 'verde', obs: '',
      materiais: ['Caixa de Som', 'Saco de bolinha', '12 Bambolês'].map(mat),
    },
    {
      id: novoId(), tipo: 'Animação', numero: 2, nome: 'Bolsa de animação preta',
      cor: 'verde', obs: '',
      materiais: [
        '1 Tripé', '1 Corda', '2 Macarrões', '1 Galinha', '1 Futpano',
        '1 Pano de lanchinho', '2 Borrifadores', '2 copos medidores', '1 Bola',
        '1 saco de pregador', '1 Pasta de folha', '1 Estojo com lápis e giz',
        'Bola mania', '1 Bomba', '1 Caixa de estalinho',
      ].map(mat),
    },
    {
      id: novoId(), tipo: 'Animação', numero: 3, nome: 'Caixa de Fios',
      cor: 'verde', obs: '',
      materiais: [
        '1 Extensão', '1 Filtro de linha', '1 Microfone de fio com fio', '1 Adaptador',
      ].map(mat),
    },
    {
      id: novoId(), tipo: 'Animação', numero: 4, nome: 'Caixa do Microfone',
      cor: 'verde', obs: '',
      materiais: [
        'Microfone sem fio', 'Transmissor', 'Cabo de energia',
        'Cabo de áudio', '2 pilhas usadas', '2 pilhas novas',
      ].map(mat),
    },
    {
      id: novoId(), tipo: 'Animação', numero: 5, nome: 'Maleta de make',
      cor: 'verde', obs: '',
      materiais: [
        'Pincéis', 'Torre de tinta', 'Esponjas', 'Toalinha',
        'Lenço umedecido', 'Espelho', 'Toalha da mesa',
      ].map(mat),
    },
    {
      id: novoId(), tipo: 'Recreação', numero: 1, nome: 'Bolsa de Recreação',
      cor: 'verde', obs: '',
      materiais: [
        '12 Bambolês', '1 Bola de futebol', '1 bola leve', '1 Corda',
        '2 Macarrões', '1 Futpano', '1 Galinha', '2 bolinhas de sabão',
        '10 cones/tartarugas', '1 saco de pregador', '2 borrifadores',
        '2 copos medidores', '2 sacos de corrida', '1 pasta de folhas',
        '1 estojo com lápis e giz', '1 pano de lanchinho', '1 bomba',
        '1 saco de bola mania',
      ].map(mat),
    },
  ];
}

// Estado de filtro/busca da aba Materiais (preservado entre navegações)
let filtroCor = 'todas';
let termoBusca = '';

/** Indica se a bolsa (ou algum material dentro dela) possui uma cor específica. */
function bolsaTemCor(bolsa, cor) {
  return (bolsa.cor || 'verde') === cor || (bolsa.materiais ?? []).some(m => (m.cor || 'verde') === cor);
}

/** Indica se a bolsa tem alguma pendência (não está tudo verde). */
function bolsaTemPendencia(bolsa) {
  return (bolsa.cor || 'verde') !== 'verde' || (bolsa.materiais ?? []).some(m => (m.cor || 'verde') !== 'verde');
}

/** Texto legível do status da bolsa para badge. */
function textoStatusBolsa(bolsa) {
  const cor = bolsa.cor || 'verde';
  if (cor === 'azul' && bolsa.obs) return `Emprestado · ${bolsa.obs}`;
  return COR_LABEL[cor] ?? COR_LABEL.verde;
}

/** Contagem de materiais por cor em uma bolsa. */
function htmlResumoCores(materiais) {
  const counts = { verde: 0, amarelo: 0, vermelho: 0, azul: 0 };
  for (const m of materiais ?? []) {
    const c = CORES.includes(m.cor) ? m.cor : 'verde';
    counts[c]++;
  }
  return CORES.filter(c => counts[c] > 0)
    .map(c => `<span class="mat-stat"><span class="dot ${c}" aria-hidden="true"></span>${counts[c]}</span>`)
    .join('');
}

/** Renderiza os cards das bolsas filtradas (usado na inicialização e na busca ao vivo). */
function htmlResultadosMateriais(bolsas) {
  const q = termoBusca.trim().toLowerCase();

  const filtradas = bolsas.filter(b => {
    if (filtroCor === 'pendencias' && !bolsaTemPendencia(b)) return false;
    if (CORES.includes(filtroCor) && !bolsaTemCor(b, filtroCor)) return false;
    if (!q) return true;
    const textoBolsa = `${b.tipo} ${b.numero} ${b.nome ?? ''} ${b.obs ?? ''}`.toLowerCase();
    if (textoBolsa.includes(q)) return true;
    return (b.materiais ?? []).some(m => `${m.nome} ${m.obs ?? ''}`.toLowerCase().includes(q));
  });

  if (!filtradas.length) {
    return `<p class="vazio" style="padding:24px 12px">Nenhuma bolsa encontrada para este filtro.</p>`;
  }

  const tipos = [...new Set(filtradas.map(b => b.tipo || 'Outro'))].sort((a, b) => {
    const ia = ORDEM_TIPOS.indexOf(a), ib = ORDEM_TIPOS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  return tipos.map(tipo => {
    const deste = filtradas
      .filter(b => (b.tipo || 'Outro') === tipo)
      .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

    const cards = deste.map(b => {
      const cor = CORES.includes(b.cor) ? b.cor : 'verde';
      const mats = b.materiais ?? [];
      const titulo = `#${b.numero ?? 1}${b.nome ? ` · ${b.nome}` : ` · ${b.tipo || 'Bolsa'}`}`;

      // Mostra alertas de itens não-verdes (ou itens que bateram na busca)
      const destaques = mats.filter(m => {
        const mc = CORES.includes(m.cor) ? m.cor : 'verde';
        if (q && `${m.nome} ${m.obs ?? ''}`.toLowerCase().includes(q)) return true;
        return mc !== 'verde';
      });

      const destaquesHtml = destaques.length ? `
        <div class="mat-alertas">
          ${destaques.map(m => {
            const mc = CORES.includes(m.cor) ? m.cor : 'verde';
            const det = m.obs
              ? (mc === 'azul' ? `com ${m.obs}` : m.obs)
              : (mc !== 'verde' ? COR_LABEL[mc] : '');
            return `<div class="mat-alerta">
              <span class="dot ${mc}" aria-hidden="true"></span>
              <span>${esc(m.nome)}</span>${det ? `<span class="mat-alerta-obs">— ${esc(det)}</span>` : ''}
            </div>`;
          }).join('')}
        </div>` : '';

      return `<a class="card ${cor}" href="#/bolsa/${esc(b.id)}">
        <div class="linha1">
          <b>${esc(titulo)}</b>
          <span class="selo ${cor}">${esc(textoStatusBolsa(b))}</span>
        </div>
        ${cor === 'amarelo' && b.obs ? `<div class="info" style="margin-top:4px">Obs: ${esc(b.obs)}</div>` : ''}
        <div class="mat-meta">
          <span class="info">${mats.length} ${mats.length === 1 ? 'item' : 'itens'}</span>
          <span class="mat-stats">${htmlResumoCores(mats)}</span>
        </div>
        ${destaquesHtml}
      </a>`;
    }).join('');

    return `<h2 class="mat-grupo">${esc(tipo)} (${deste.length})</h2>${cards}`;
  }).join('');
}

/** Gera o HTML da lista de bolsas para exibir na aba Materiais da tela inicial. */
export function htmlListaMateriais(bolsas) {
  if (!bolsas.length) {
    return `
      <div class="vazio" style="padding:28px 12px">
        <p style="margin:0 0 14px">Nenhuma bolsa de materiais cadastrada.<br>Toque em <b>+</b> para criar ou carregue suas listas prontas:</p>
        <button class="sec" id="matCarregarPadrao" type="button">📥 Carregar listas padrão (Animação e Recreação)</button>
      </div>`;
  }

  const pendCount = bolsas.filter(bolsaTemPendencia).length;
  const redCount  = bolsas.filter(b => bolsaTemCor(b, 'vermelho')).length;
  const yelCount  = bolsas.filter(b => bolsaTemCor(b, 'amarelo')).length;
  const bluCount  = bolsas.filter(b => bolsaTemCor(b, 'azul')).length;

  const chip = (id, conteudo) =>
    `<button type="button" class="chip ${filtroCor === id ? 'on' : ''}" data-mat-filtro="${id}">${conteudo}</button>`;

  return `
    <div class="mat-legenda" aria-label="Legenda de cores">
      <span><span class="dot verde" aria-hidden="true"></span>Tenho</span>
      <span><span class="dot amarelo" aria-hidden="true"></span>Reparo/Obs</span>
      <span><span class="dot vermelho" aria-hidden="true"></span>Não tenho</span>
      <span><span class="dot azul" aria-hidden="true"></span>Emprestado</span>
    </div>
    <input id="matBusca" class="mat-busca" type="search" value="${esc(termoBusca)}" placeholder="Buscar bolsa, material ou pessoa...">
    <div class="chips" style="margin:4px 0 0">
      ${chip('todas', `Todas (${bolsas.length})`)}
      ${chip('pendencias', `Pendências (${pendCount})`)}
      ${chip('vermelho', `<span class="dot vermelho" aria-hidden="true"></span> ${redCount}`)}
      ${chip('amarelo',  `<span class="dot amarelo"  aria-hidden="true"></span> ${yelCount}`)}
      ${chip('azul',     `<span class="dot azul"     aria-hidden="true"></span> ${bluCount}`)}
    </div>
    <div id="matResultados" class="mat-resultados">${htmlResultadosMateriais(bolsas)}</div>`;
}

/** Liga eventos de filtro, busca e carregamento inicial na aba Materiais. */
export function bindEventosMateriais(el, onUpdate) {
  const btnPadrao = el.querySelector('#matCarregarPadrao');
  if (btnPadrao) {
    btnPadrao.onclick = () => {
      upsertBolsasLote(criarBolsasPadrao());
      onUpdate();
    };
    return;
  }

  const inputBusca = el.querySelector('#matBusca');
  const resultados = el.querySelector('#matResultados');
  const bolsas = getBolsas();

  if (inputBusca && resultados) {
    inputBusca.addEventListener('input', () => {
      termoBusca = inputBusca.value;
      resultados.innerHTML = htmlResultadosMateriais(bolsas);
    });
  }

  el.querySelectorAll('[data-mat-filtro]').forEach(btn => {
    btn.onclick = () => {
      filtroCor = btn.dataset.matFiltro;
      el.querySelectorAll('[data-mat-filtro]').forEach(c => c.classList.toggle('on', c === btn));
      if (resultados) resultados.innerHTML = htmlResultadosMateriais(bolsas);
    };
  });
}

// ── Formulário de bolsa e materiais (#/bolsa/nova ou #/bolsa/:id) ────────────

function proximoNumero(tipo) {
  const nums = getBolsas()
    .filter(b => b.tipo === tipo)
    .map(b => Number(b.numero) || 0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function htmlCorBolsaPills(corAtual) {
  return `<div class="cor-pills" id="bCor">
    ${CORES.map(c => `
      <button type="button" class="cor-pill ${c} ${corAtual === c ? 'ativo' : ''}"
        data-bolsa-cor="${c}" aria-pressed="${corAtual === c}">
        <span class="dot ${c}" aria-hidden="true"></span>
        <span>${COR_LABEL[c]}</span>
      </button>`).join('')}
  </div>`;
}

function textoObsLabel(cor) {
  return cor === 'azul' ? 'Peguei emprestado com quem? *' : 'Reparo ou observação';
}

function textoObsPlaceholder(cor, isMaterial = false) {
  if (cor === 'azul') return isMaterial ? 'Nome de quem emprestou (obrigatório)' : 'Nome da pessoa';
  return isMaterial ? 'Reparo ou observação do item' : 'Ex: Zíper com defeito, falta conferir...';
}

export function renderBolsaForm(el, id) {
  const existente = id && id !== 'nova' ? getBolsaById(id) : null;
  if (id && id !== 'nova' && !existente) {
    el.innerHTML = `
      <header class="barra"><a href="#/materiais" class="voltar">‹ Voltar</a><h1>Bolsa</h1></header>
      <div class="form"><p class="vazio">Bolsa não encontrada.</p></div>`;
    return;
  }

  const tipoInicial = existente?.tipo || 'Animação';
  const b = existente ? structuredClone(existente) : {
    id: novoId(),
    tipo: tipoInicial,
    numero: proximoNumero(tipoInicial),
    nome: '',
    cor: 'verde',
    obs: '',
    materiais: [],
  };
  if (!b.materiais) b.materiais = [];
  if (!CORES.includes(b.cor)) b.cor = 'verde';

  let numeroEditado = !!existente;
  const $ = s => el.querySelector(s);

  el.innerHTML = `
  <header class="barra">
    <a href="#/materiais" class="voltar">‹ Voltar</a>
    <h1>${existente ? 'Editar bolsa' : 'Nova bolsa'}</h1>
  </header>
  <div class="form">
    <div class="duas">
      <label style="margin-top:6px">Categoria
        <select id="bTipo">
          ${ORDEM_TIPOS.map(t => `<option value="${t}" ${b.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label style="margin-top:6px">Número da bolsa
        <input id="bNum" type="number" min="1" step="1" inputmode="numeric">
      </label>
    </div>

    <label>Nome / identificação (opcional)
      <input id="bNome" autocomplete="off" placeholder="Ex: Bolsa de animação preta">
    </label>

    <label>Cor / situação da bolsa</label>
    ${htmlCorBolsaPills(b.cor)}

    <div id="bObsWrap" style="display:${b.cor === 'amarelo' || b.cor === 'azul' ? 'block' : 'none'}">
      <label><span id="bObsLabel">${textoObsLabel(b.cor)}</span>
        <input id="bObs" autocomplete="off" placeholder="${textoObsPlaceholder(b.cor, false)}">
      </label>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;margin-bottom:8px">
      <h2 style="margin:0">Lista de materiais (<span id="bMatCont">${b.materiais.length}</span>)</h2>
    </div>
    <div id="bMateriais"></div>
    <button class="sec" id="bAddMat" type="button">+ Adicionar material</button>

    <p class="erro" id="bErro"></p>
    <button class="prim" id="bSalvar" type="button">Salvar bolsa</button>
    ${existente ? '<button class="perigo" id="bExcluir" type="button">Excluir bolsa</button>' : ''}
  </div>`;

  // Inicializa valores simples
  $('#bNum').value = b.numero ?? 1;
  $('#bNome').value = b.nome ?? '';
  $('#bObs').value = b.obs ?? '';

  $('#bTipo').onchange = () => {
    b.tipo = $('#bTipo').value;
    if (!numeroEditado) {
      b.numero = proximoNumero(b.tipo);
      $('#bNum').value = b.numero;
    }
  };
  $('#bNum').oninput = () => {
    numeroEditado = true;
    b.numero = $('#bNum').value;
  };
  $('#bNome').oninput = () => { b.nome = $('#bNome').value; };
  $('#bObs').oninput = () => { b.obs = $('#bObs').value; };

  // Seleção da cor geral da bolsa (sem re-renderizar o formulário)
  $('#bCor').addEventListener('click', e => {
    const btn = e.target.closest('[data-bolsa-cor]');
    if (!btn) return;
    b.cor = btn.dataset.bolsaCor;
    $('#bCor').querySelectorAll('[data-bolsa-cor]').forEach(p => {
      const on = p === btn;
      p.classList.toggle('ativo', on);
      p.setAttribute('aria-pressed', String(on));
    });
    const precisaObs = b.cor === 'amarelo' || b.cor === 'azul';
    $('#bObsWrap').style.display = precisaObs ? 'block' : 'none';
    if (precisaObs) {
      $('#bObsLabel').textContent = textoObsLabel(b.cor);
      $('#bObs').placeholder = textoObsPlaceholder(b.cor, false);
      if (!b.obs.trim()) $('#bObs').focus();
    }
  });

  // Renderiza apenas a lista de materiais
  function renderListaMateriais() {
    $('#bMatCont').textContent = b.materiais.length;
    if (!b.materiais.length) {
      $('#bMateriais').innerHTML = `<p style="color:var(--mut);font-size:.88rem;margin:4px 0 8px">Nenhum material adicionado ainda.</p>`;
      return;
    }
    $('#bMateriais').innerHTML = b.materiais.map((m, i) => {
      const cor = CORES.includes(m.cor) ? m.cor : 'verde';
      const mostraObs = cor === 'amarelo' || cor === 'azul';
      return `
      <div class="mat-row" data-idx="${i}">
        <div class="mat-linha">
          <input class="mat-nome" data-i="${i}" value="${esc(m.nome)}" placeholder="Nome do material">
          <div class="mat-cores">
            ${CORES.map(c => `
              <button type="button" class="mat-cor-btn ${c} ${cor === c ? 'ativo' : ''}"
                data-i="${i}" data-cor="${c}"
                title="${COR_LABEL[c]}" aria-label="${COR_LABEL[c]}" aria-pressed="${cor === c}"></button>`).join('')}
          </div>
          <button class="x" data-del="${i}" type="button" aria-label="Remover material">×</button>
        </div>
        <div class="mat-obs-wrap" style="display:${mostraObs ? 'block' : 'none'}">
          <input class="mat-obs" data-i="${i}" value="${esc(m.obs || '')}" placeholder="${textoObsPlaceholder(cor, true)}">
        </div>
      </div>`;
    }).join('');
  }

  const $mats = $('#bMateriais');

  // Delegação de inputs dos materiais (nome e obs)
  $mats.addEventListener('input', e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    if (e.target.classList.contains('mat-nome')) b.materiais[i].nome = e.target.value;
    if (e.target.classList.contains('mat-obs'))  b.materiais[i].obs  = e.target.value;
  });

  // Delegação de cliques (cores e remover item) — atualiza só a linha alterada ao trocar cor
  $mats.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      b.materiais.splice(Number(delBtn.dataset.del), 1);
      renderListaMateriais();
      return;
    }

    const corBtn = e.target.closest('[data-cor]');
    if (!corBtn) return;
    const i = Number(corBtn.dataset.i);
    const novaCor = corBtn.dataset.cor;
    b.materiais[i].cor = novaCor;

    const row = corBtn.closest('.mat-row');
    row.querySelectorAll('.mat-cor-btn').forEach(btn => {
      const on = btn === corBtn;
      btn.classList.toggle('ativo', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    const obsWrap = row.querySelector('.mat-obs-wrap');
    const obsInput = row.querySelector('.mat-obs');
    const mostraObs = novaCor === 'amarelo' || novaCor === 'azul';
    obsWrap.style.display = mostraObs ? 'block' : 'none';
    if (mostraObs) {
      obsInput.placeholder = textoObsPlaceholder(novaCor, true);
      if (!obsInput.value.trim()) obsInput.focus();
    }
  });

  $('#bAddMat').onclick = () => {
    b.materiais.push({ id: novoId(), nome: '', cor: 'verde', obs: '' });
    renderListaMateriais();
    const inputs = $mats.querySelectorAll('.mat-nome');
    inputs[inputs.length - 1]?.focus();
  };

  $('#bSalvar').onclick = () => {
    const $erro = $('#bErro');
    const num = parseInt(b.numero, 10);
    if (!Number.isInteger(num) || num < 1) {
      $erro.textContent = 'Informe um número válido para a bolsa (mínimo 1).';
      $('#bNum').focus();
      return;
    }
    if (b.cor === 'azul' && !b.obs.trim()) {
      $erro.textContent = 'Informe o nome da pessoa que emprestou a bolsa.';
      $('#bObs').focus();
      return;
    }

    // Valida materiais preenchidos
    for (let i = 0; i < b.materiais.length; i++) {
      const m = b.materiais[i];
      const nome = (m.nome ?? '').trim();
      const obs  = (m.obs ?? '').trim();
      if (!nome && obs) {
        $erro.textContent = 'Preencha o nome do material ou remova a linha.';
        $mats.querySelector(`.mat-nome[data-i="${i}"]`)?.focus();
        return;
      }
      if (nome && m.cor === 'azul' && !obs) {
        $erro.textContent = `Informe o nome da pessoa para "${nome}" (emprestado).`;
        $mats.querySelector(`.mat-obs[data-i="${i}"]`)?.focus();
        return;
      }
    }

    const materiaisLimpos = b.materiais
      .filter(m => (m.nome ?? '').trim())
      .map(m => {
        const cor = CORES.includes(m.cor) ? m.cor : 'verde';
        return {
          id: m.id || novoId(),
          nome: m.nome.trim(),
          cor,
          obs: (cor === 'amarelo' || cor === 'azul') ? (m.obs ?? '').trim() : '',
        };
      });

    upsertBolsa({
      ...b,
      numero: num,
      nome: (b.nome ?? '').trim(),
      obs: (b.cor === 'amarelo' || b.cor === 'azul') ? (b.obs ?? '').trim() : '',
      materiais: materiaisLimpos,
    });
    location.hash = '#/materiais';
  };

  if (existente) {
    $('#bExcluir').onclick = () => {
      if (confirm('Excluir esta bolsa e toda a sua lista de materiais?')) {
        removeBolsa(b.id);
        location.hash = '#/materiais';
      }
    };
  }

  renderListaMateriais();
}
