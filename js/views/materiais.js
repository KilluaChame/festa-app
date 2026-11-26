// Gerenciamento hierárquico de materiais:
// Conjunto/Kit (ex.: Animação 1) -> Bolsas -> Caixas/Maletas -> Itens individuais.
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

/** Garante que qualquer nó da árvore (ou formato antigo) tenha estrutura padrão. */
function normalizarNo(no) {
  const cor = CORES.includes(no?.cor) ? no.cor : 'verde';
  const itensBrutos = no?.itens ?? no?.materiais ?? [];
  return {
    ...no,
    id: no?.id || novoId(),
    nome: no?.nome ?? '',
    numero: no?.numero ?? null,
    cor,
    obs: no?.obs ?? '',
    itens: itensBrutos.map(m => ({
      id: m?.id || novoId(),
      nome: m?.nome ?? '',
      cor: CORES.includes(m?.cor) ? m.cor : 'verde',
      obs: m?.obs ?? '',
    })),
    compartimentos: (no?.compartimentos ?? []).map(normalizarNo),
  };
}

/** Cria uma cópia da árvore removendo apenas linhas em branco e limpando obs de verde/vermelho. */
function sanitizarParaSalvar(no, ehRaiz = false) {
  const cor = CORES.includes(no.cor) ? no.cor : 'verde';
  const itens = (no.itens ?? [])
    .filter(m => (m.nome ?? '').trim() || (m.obs ?? '').trim())
    .map(m => {
      const mc = CORES.includes(m.cor) ? m.cor : 'verde';
      return {
        id: m.id || novoId(),
        nome: (m.nome ?? '').trim(),
        cor: mc,
        obs: (mc === 'amarelo' || mc === 'azul') ? (m.obs ?? '').trim() : '',
      };
    });

  const limpo = {
    ...no,
    id: no.id || novoId(),
    nome: (no.nome ?? '').trim(),
    numero: no.numero ? Number(no.numero) : null,
    cor,
    obs: (cor === 'amarelo' || cor === 'azul') ? (no.obs ?? '').trim() : '',
    itens,
    compartimentos: (no.compartimentos ?? []).map(c => sanitizarParaSalvar(c, false)),
  };
  if (ehRaiz) limpo.tipo = no.tipo || 'Outro';
  return limpo;
}

/** Clona recursivamente um nó atribuindo novos IDs para duplicação. */
function clonarNoComNovosIds(no) {
  return {
    ...no,
    id: novoId(),
    itens: (no.itens ?? []).map(m => ({ ...m, id: novoId() })),
    compartimentos: (no.compartimentos ?? []).map(clonarNoComNovosIds),
  };
}

/** Dados iniciais padrão seguindo a organização de Animação 1 e Recreação 1. */
function criarConjuntosPadrao() {
  const item = nome => ({ id: novoId(), nome, cor: 'verde', obs: '' });
  const caixa = (nome, itens, numero = null, compartimentos = []) => ({
    id: novoId(),
    nome,
    numero,
    cor: 'verde',
    obs: '',
    itens: itens.map(item),
    compartimentos,
  });

  return [
    {
      id: novoId(),
      tipo: 'Animação',
      numero: 1,
      nome: 'Animação 1',
      cor: 'verde',
      obs: '',
      itens: ['Caixa de Som', 'Saco de bolinha', '12 Bambolês'].map(item),
      compartimentos: [
        caixa(
          'Bolsa de animação preta',
          [
            '1 Tripé', '1 Corda', '2 Macarrões', '1 Galinha', '1 Futpano',
            '1 Pano de lanchinho', '2 Borrifadores', '2 copos medidores', '1 Bola',
            '1 saco de pregador', '1 Pasta de folha', '1 Estojo com lápis e giz',
            'Bola mania', '1 Bomba', '1 Caixa de estalinho',
          ],
          1,
          [
            caixa('Caixa de Fios', ['1 Extensão', '1 Filtro de linha', '1 Microfone de fio com fio', '1 Adaptador']),
            caixa('Caixa do Microfone', ['Microfone sem fio', 'Transmissor', 'Cabo de energia', 'Cabo de áudio', '2 pilhas usadas', '2 pilhas novas']),
            caixa('Maleta de make', ['Pincéis', 'Torre de tinta', 'Esponjas', 'Toalinha', 'Lenço umedecido', 'Espelho', 'Toalha da mesa']),
          ],
        ),
      ],
    },
    {
      id: novoId(),
      tipo: 'Recreação',
      numero: 1,
      nome: 'Recreação 1',
      cor: 'verde',
      obs: '',
      itens: ['12 Bambolês'].map(item),
      compartimentos: [
        caixa(
          'Bolsa de recreação',
          [
            '1 Bola de futebol', '1 bola leve', '1 Corda', '2 Macarrões',
            '1 Futpano', '1 Galinha', '2 bolinhas de sabão', '10 cones/tartarugas',
            '1 saco de pregador', '2 borrifadores', '2 copos medidores', '2 sacos de corrida',
            '1 pasta de folhas', '1 estojo com lápis e giz', '1 pano de lanchinho',
            '1 bomba', '1 saco de bola mania',
          ],
          1,
        ),
      ],
    },
  ];
}

// ── Análise recursiva da árvore (estatísticas, busca e alertas) ──────────────

/** Percorre o nó e todos os descendentes somando itens, caixas, cores e alertas. */
function analisarArvore(no, pathIdsBase = [], query = '') {
  const counts = { verde: 0, amarelo: 0, vermelho: 0, azul: 0 };
  const destaques = [];
  let totalItens = 0;
  let totalCaixas = 0;
  let temVermelho = no.cor === 'vermelho';
  let temAmarelo  = no.cor === 'amarelo';
  let temAzul     = no.cor === 'azul';
  const q = query.trim().toLowerCase();

  function visitar(atual, pathIds, pathNomes, ehRaizVisitada) {
    if (!ehRaizVisitada) {
      totalCaixas++;
      const c = CORES.includes(atual.cor) ? atual.cor : 'verde';
      if (c === 'vermelho') temVermelho = true;
      if (c === 'amarelo')  temAmarelo  = true;
      if (c === 'azul')     temAzul     = true;

      const textoNo = `${atual.nome} ${atual.numero ?? ''} ${atual.obs}`.toLowerCase();
      if (c !== 'verde' || (q && textoNo.includes(q))) {
        destaques.push({
          href: `#/material/${pathIds.join('/')}`,
          caminho: pathNomes.slice(0, -1),
          nome: atual.nome || 'Sem nome',
          cor: c,
          obs: c === 'azul' && !atual.obs ? 'falta nome da pessoa' : atual.obs,
          ehCaixa: true,
        });
      }
    }

    for (const m of atual.itens ?? []) {
      if (!(m.nome ?? '').trim()) continue;
      totalItens++;
      const mc = CORES.includes(m.cor) ? m.cor : 'verde';
      counts[mc]++;
      if (mc === 'vermelho') temVermelho = true;
      if (mc === 'amarelo')  temAmarelo  = true;
      if (mc === 'azul')     temAzul     = true;

      const textoItem = `${m.nome} ${m.obs}`.toLowerCase();
      if (mc !== 'verde' || (q && textoItem.includes(q))) {
        destaques.push({
          href: `#/material/${pathIds.join('/')}`,
          caminho: pathNomes,
          nome: m.nome,
          cor: mc,
          obs: mc === 'azul' && !m.obs ? 'falta nome da pessoa' : m.obs,
          ehCaixa: false,
        });
      }
    }

    for (const sub of atual.compartimentos ?? []) {
      const rotulo = sub.numero ? `#${sub.numero} ${sub.nome}`.trim() : sub.nome;
      visitar(sub, [...pathIds, sub.id], [...pathNomes, rotulo], false);
    }
  }

  visitar(no, pathIdsBase, [], true);

  const piorCor = temVermelho ? 'vermelho' : temAmarelo ? 'amarelo' : temAzul ? 'azul' : 'verde';
  return { totalItens, totalCaixas, counts, destaques, piorCor, temVermelho, temAmarelo, temAzul };
}

function noMatchBusca(no, q) {
  if (!q) return true;
  const texto = `${no.tipo ?? ''} ${no.numero ?? ''} ${no.nome} ${no.obs}`.toLowerCase();
  if (texto.includes(q)) return true;
  if ((no.itens ?? []).some(m => `${m.nome} ${m.obs}`.toLowerCase().includes(q))) return true;
  return (no.compartimentos ?? []).some(sub => noMatchBusca(sub, q));
}

function textoStatusContainer(no) {
  const cor = CORES.includes(no.cor) ? no.cor : 'verde';
  if (cor === 'azul') return no.obs ? `Emprestado · ${no.obs}` : 'Emprestado · sem nome';
  return COR_LABEL[cor];
}

function htmlResumoCores(counts) {
  return CORES.filter(c => counts[c] > 0)
    .map(c => `<span class="mat-stat"><span class="dot ${c}" aria-hidden="true"></span>${counts[c]}</span>`)
    .join('');
}

function htmlCardContainer(no, pathIds, query = '', ehSub = false) {
  const stats = analisarArvore(no, pathIds, query);
  const corManual = CORES.includes(no.cor) ? no.cor : 'verde';
  const bordaCor = corManual !== 'verde' ? corManual : stats.piorCor;
  const href = `#/material/${pathIds.join('/')}`;
  const nome = no.nome || `${no.tipo || 'Conjunto'} ${no.numero ?? ''}`.trim();

  const resumoQtd = [
    stats.totalCaixas ? `${stats.totalCaixas} ${stats.totalCaixas === 1 ? 'bolsa/caixa' : 'bolsas/caixas'}` : '',
    `${stats.totalItens} ${stats.totalItens === 1 ? 'item' : 'itens'}`,
  ].filter(Boolean).join(' · ');

  const alertasHtml = stats.destaques.length ? `
    <div class="mat-alertas">
      ${stats.destaques.map(a => {
        const prefixo = a.caminho.length ? `${a.caminho.map(esc).join(' › ')} › ` : '';
        const detalhe = a.obs
          ? (a.cor === 'azul' && a.obs !== 'falta nome da pessoa' ? `com ${a.obs}` : a.obs)
          : (a.cor !== 'verde' ? COR_LABEL[a.cor] : '');
        return `<a class="mat-alerta" href="${a.href}">
          <span class="dot ${a.cor}" aria-hidden="true"></span>
          <span>${prefixo}<b>${esc(a.nome)}</b></span>${detalhe ? `<span class="mat-alerta-obs">— ${esc(detalhe)}</span>` : ''}
        </a>`;
      }).join('')}
    </div>` : '';

  const pendBadge = corManual === 'verde' && stats.piorCor !== 'verde'
    ? `<span class="selo ${stats.piorCor}">Pendências</span>`
    : '';

  return `<div class="card ${bordaCor} mat-card">
    <a class="mat-card-topo" href="${href}">
      <div class="linha1">
        <span class="mat-titulo">
          ${no.numero ? `<span class="mat-num">#${esc(no.numero)}</span>` : ''}
          <b>${esc(nome)}</b>
        </span>
        <span class="mat-selos">${pendBadge}<span class="selo ${corManual}">${esc(textoStatusContainer(no))}</span></span>
      </div>
      ${corManual === 'amarelo' && no.obs ? `<div class="info" style="margin-top:4px">Obs: ${esc(no.obs)}</div>` : ''}
      <div class="mat-meta">
        <span class="info">${resumoQtd}${ehSub ? ' · abrir ›' : ''}</span>
        <span class="mat-stats">${htmlResumoCores(stats.counts)}</span>
      </div>
    </a>
    ${alertasHtml}
  </div>`;
}

// ── Aba Materiais (Tela inicial) ─────────────────────────────────────────────

let filtroCor = 'todas';
let termoBusca = '';

function htmlResultadosMateriais(conjuntos) {
  const q = termoBusca.trim().toLowerCase();

  const filtrados = conjuntos.filter(c => {
    const st = analisarArvore(c, [c.id]);
    if (filtroCor === 'pendencias' && st.piorCor === 'verde') return false;
    if (filtroCor === 'vermelho' && !st.temVermelho) return false;
    if (filtroCor === 'amarelo'  && !st.temAmarelo)  return false;
    if (filtroCor === 'azul'     && !st.temAzul)     return false;
    return noMatchBusca(c, q);
  });

  if (!filtrados.length) {
    return `<p class="vazio" style="padding:24px 12px">Nenhum conjunto encontrado para este filtro.</p>`;
  }

  const tipos = [...new Set(filtrados.map(c => c.tipo || 'Outro'))].sort((a, b) => {
    const ia = ORDEM_TIPOS.indexOf(a), ib = ORDEM_TIPOS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  return tipos.map(tipo => {
    const deste = filtrados
      .filter(c => (c.tipo || 'Outro') === tipo)
      .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

    return `<h2 class="mat-grupo">${esc(tipo)} (${deste.length})</h2>` +
      deste.map(c => htmlCardContainer(c, [c.id], q, false)).join('');
  }).join('');
}

/** Verifica se os conjuntos ativos estão no formato plano antigo (sem sub-bolsas). */
const NOMES_LEGADO = new Set([
  'Itens avulsos (Animação)', 'Bolsa de animação preta',
  'Caixa de Fios', 'Caixa do Microfone', 'Maleta de make', 'Bolsa de Recreação',
]);

function temModeloLegadoPlano(conjuntos) {
  if (!conjuntos.length || conjuntos.some(c => (c.compartimentos ?? []).length > 0)) return false;
  return conjuntos.filter(c => NOMES_LEGADO.has(c.nome)).length >= 2;
}

/** Converte as bolsas planas da versão anterior para Animação 1 e Recreação 1 preservando cores/obs. */
function converterLegadoParaHierarquia(conjuntos) {
  const porNome = new Map(conjuntos.map(c => [c.nome, c]));
  const usarItens = (nomeLegado, padrao) => {
    const antigo = porNome.get(nomeLegado);
    if (!antigo?.itens?.length) return padrao;
    return antigo.itens.map(m => ({ ...m, id: m.id || novoId() }));
  };
  const copiarStatus = (alvo, nomeLegado) => {
    const antigo = porNome.get(nomeLegado);
    if (!antigo) return alvo;
    return { ...alvo, cor: antigo.cor, obs: antigo.obs };
  };

  const novos = criarConjuntosPadrao();
  const [anim, rec] = novos;

  // Animação 1: avulsos + Bolsa de animação preta (com Caixa de Fios, Mic e Make dentro)
  anim.itens = usarItens('Itens avulsos (Animação)', anim.itens);
  let bolsaAnim = anim.compartimentos[0];
  bolsaAnim = copiarStatus(bolsaAnim, 'Bolsa de animação preta');
  bolsaAnim.itens = usarItens('Bolsa de animação preta', bolsaAnim.itens);
  bolsaAnim.compartimentos = [
    copiarStatus({ ...bolsaAnim.compartimentos[0], itens: usarItens('Caixa de Fios', bolsaAnim.compartimentos[0].itens) }, 'Caixa de Fios'),
    copiarStatus({ ...bolsaAnim.compartimentos[1], itens: usarItens('Caixa do Microfone', bolsaAnim.compartimentos[1].itens) }, 'Caixa do Microfone'),
    copiarStatus({ ...bolsaAnim.compartimentos[2], itens: usarItens('Maleta de make', bolsaAnim.compartimentos[2].itens) }, 'Maleta de make'),
  ];
  anim.compartimentos[0] = bolsaAnim;

  // Recreação 1: se havia 12 Bambolês na Bolsa de Recreação legada, separa para o nível raiz
  const recAntiga = porNome.get('Bolsa de Recreação');
  if (recAntiga) {
    const bamb = recAntiga.itens.find(m => /bambol[eê]/i.test(m.nome));
    if (bamb) rec.itens = [{ ...bamb, id: bamb.id || novoId() }];
    let bolsaRec = copiarStatus(rec.compartimentos[0], 'Bolsa de Recreação');
    bolsaRec.itens = recAntiga.itens
      .filter(m => m !== bamb)
      .map(m => ({ ...m, id: m.id || novoId() }));
    rec.compartimentos[0] = bolsaRec;
  }

  const idsRemover = conjuntos.filter(c => NOMES_LEGADO.has(c.nome)).map(c => c.id);
  upsertBolsasLote(novos, idsRemover);
}

/** Gera o HTML da lista de bolsas para exibir dentro da Home. */
export function htmlListaMateriais(conjuntosBrutos) {
  const conjuntos = conjuntosBrutos.map(normalizarNo);

  if (!conjuntos.length) {
    return `
      <div class="vazio" style="padding:28px 12px">
        <p style="margin:0 0 14px">Nenhum conjunto de materiais cadastrado.<br>Toque em <b>+</b> para criar ou carregue sua organização padrão:</p>
        <button class="sec" id="matCarregarPadrao" type="button">📥 Carregar listas padrão (Animação e Recreação)</button>
      </div>`;
  }

  const avisoLegado = temModeloLegadoPlano(conjuntos) ? `
    <div class="card amarelo mat-card" style="padding:12px 14px">
      <div style="font-size:.9rem"><b>Nova organização disponível:</b> agrupar suas bolsas em <b>Animação 1</b> (com Bolsa preta → Caixas) e <b>Recreação 1</b>, mantendo cores e observações.</div>
      <button class="sec" id="matConverterLegado" type="button" style="margin-top:10px;padding:10px">✨ Reorganizar listas atuais</button>
    </div>` : '';

  const statsPorConjunto = conjuntos.map(c => analisarArvore(c, [c.id]));
  const pendCount = statsPorConjunto.filter(s => s.piorCor !== 'verde').length;
  const redCount  = statsPorConjunto.filter(s => s.temVermelho).length;
  const yelCount  = statsPorConjunto.filter(s => s.temAmarelo).length;
  const bluCount  = statsPorConjunto.filter(s => s.temAzul).length;

  const chip = (id, conteudo) =>
    `<button type="button" class="chip ${filtroCor === id ? 'on' : ''}" data-mat-filtro="${id}">${conteudo}</button>`;

  return `
    ${avisoLegado}
    <div class="mat-legenda" aria-label="Legenda de cores">
      <span><span class="dot verde" aria-hidden="true"></span>Tenho</span>
      <span><span class="dot amarelo" aria-hidden="true"></span>Reparo/Obs</span>
      <span><span class="dot vermelho" aria-hidden="true"></span>Não tenho</span>
      <span><span class="dot azul" aria-hidden="true"></span>Emprestado</span>
    </div>
    <input id="matBusca" class="mat-busca" type="search" value="${esc(termoBusca)}" placeholder="Buscar conjunto, bolsa, caixa, item ou pessoa...">
    <div class="chips" style="margin:4px 0 0">
      ${chip('todas', `Todos (${conjuntos.length})`)}
      ${chip('pendencias', `Pendências (${pendCount})`)}
      ${chip('vermelho', `<span class="dot vermelho" aria-hidden="true"></span> ${redCount}`)}
      ${chip('amarelo',  `<span class="dot amarelo"  aria-hidden="true"></span> ${yelCount}`)}
      ${chip('azul',     `<span class="dot azul"     aria-hidden="true"></span> ${bluCount}`)}
    </div>
    <div id="matResultados" class="mat-resultados">${htmlResultadosMateriais(conjuntos)}</div>`;
}

/** Liga eventos de busca, filtro e carregamento padrão na aba Materiais. */
export function bindEventosMateriais(el, onUpdate) {
  const btnPadrao = el.querySelector('#matCarregarPadrao');
  if (btnPadrao) {
    btnPadrao.onclick = () => {
      upsertBolsasLote(criarConjuntosPadrao());
      onUpdate();
    };
    return;
  }

  const conjuntos = getBolsas().map(normalizarNo);

  const btnLegado = el.querySelector('#matConverterLegado');
  if (btnLegado) {
    btnLegado.onclick = () => {
      converterLegadoParaHierarquia(conjuntos);
      onUpdate();
    };
  }

  const inputBusca = el.querySelector('#matBusca');
  const resultados = el.querySelector('#matResultados');

  if (inputBusca && resultados) {
    inputBusca.addEventListener('input', () => {
      termoBusca = inputBusca.value;
      resultados.innerHTML = htmlResultadosMateriais(conjuntos);
    });
  }

  el.querySelectorAll('[data-mat-filtro]').forEach(btn => {
    btn.onclick = () => {
      filtroCor = btn.dataset.matFiltro;
      el.querySelectorAll('[data-mat-filtro]').forEach(c => c.classList.toggle('on', c === btn));
      if (resultados) resultados.innerHTML = htmlResultadosMateriais(conjuntos);
    };
  });
}

// ── Criação de novo conjunto raiz (#/material/novo) ──────────────────────────

function proximoNumero(tipo, lista) {
  const nums = lista.filter(b => b.tipo === tipo).map(b => Number(b.numero) || 0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function incrementarNomeComNumero(nome, novoNum) {
  if (!nome) return '';
  if (/\d+$/.test(nome.trim())) return nome.trim().replace(/\d+$/, String(novoNum));
  return `${nome.trim()} ${novoNum}`;
}

export function renderNovoConjunto(el) {
  const existentes = getBolsas();
  let tipo = 'Animação';
  let numero = proximoNumero(tipo, existentes);
  let numEditado = false;
  let nomeEditado = false;
  let cor = 'verde';
  const $ = s => el.querySelector(s);

  el.innerHTML = `
  <header class="barra">
    <a href="#/materiais" class="voltar">‹ Voltar</a>
    <h1>Novo conjunto</h1>
  </header>
  <div class="form">
    <div class="duas">
      <label style="margin-top:6px">Categoria
        <select id="nTipo">
          ${ORDEM_TIPOS.map(t => `<option value="${t}" ${t === tipo ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label style="margin-top:6px">Número
        <input id="nNum" type="number" min="1" step="1" inputmode="numeric" value="${numero}">
      </label>
    </div>
    <label>Nome
      <input id="nNome" autocomplete="off" value="${tipo} ${numero}" placeholder="Ex: Animação 2">
    </label>
    <label>Cor inicial</label>
    <div class="cor-pills" id="nCor">
      ${CORES.map(c => `
        <button type="button" class="cor-pill ${c} ${c === cor ? 'ativo' : ''}" data-c="${c}">
          <span class="dot ${c}" aria-hidden="true"></span><span>${COR_LABEL[c]}</span>
        </button>`).join('')}
    </div>
    <div id="nObsWrap" style="display:none">
      <label><span id="nObsLabel">Observação</span>
        <input id="nObs" autocomplete="off">
      </label>
    </div>
    <p class="erro" id="nErro"></p>
    <button class="prim" id="nCriar" type="button">Criar e abrir conjunto</button>
  </div>`;

  function atualizarSugestao() {
    if (!numEditado) {
      numero = proximoNumero(tipo, existentes);
      $('#nNum').value = numero;
    }
    if (!nomeEditado) {
      $('#nNome').value = tipo === 'Outro' ? `Conjunto ${numero}` : `${tipo} ${numero}`;
    }
  }

  $('#nTipo').onchange = () => { tipo = $('#nTipo').value; atualizarSugestao(); };
  $('#nNum').oninput = () => { numEditado = true; numero = parseInt($('#nNum').value, 10) || 1; };
  $('#nNome').oninput = () => { nomeEditado = true; };

  $('#nCor').onclick = e => {
    const btn = e.target.closest('[data-c]');
    if (!btn) return;
    cor = btn.dataset.c;
    $('#nCor').querySelectorAll('[data-c]').forEach(p => p.classList.toggle('ativo', p === btn));
    const mostra = cor === 'amarelo' || cor === 'azul';
    $('#nObsWrap').style.display = mostra ? 'block' : 'none';
    if (mostra) {
      $('#nObsLabel').textContent = cor === 'azul' ? 'Peguei emprestado com quem? *' : 'Reparo ou observação';
      $('#nObs').placeholder = cor === 'azul' ? 'Nome da pessoa' : 'Ex: Precisa de reparo...';
      $('#nObs').focus();
    }
  };

  $('#nCriar').onclick = () => {
    const num = parseInt($('#nNum').value, 10);
    const nome = $('#nNome').value.trim();
    const obs = $('#nObs').value.trim();
    if (!Number.isInteger(num) || num < 1) { $('#nErro').textContent = 'Informe um número válido (mínimo 1).'; return; }
    if (!nome) { $('#nErro').textContent = 'Informe um nome para o conjunto.'; return; }
    if (cor === 'azul' && !obs) { $('#nErro').textContent = 'Informe o nome da pessoa que emprestou.'; $('#nObs').focus(); return; }

    const novo = {
      id: novoId(),
      tipo,
      numero: num,
      nome,
      cor,
      obs: (cor === 'amarelo' || cor === 'azul') ? obs : '',
      itens: [],
      compartimentos: [],
    };
    upsertBolsa(novo);
    location.hash = `#/material/${novo.id}`;
  };
}

// ── Tela de navegação/edição de qualquer nível (#/material/:id/...) ──────────

function encontrarCaminho(raiz, pathIds) {
  const cadeia = [raiz];
  let atual = raiz;
  for (const subId of pathIds.slice(1)) {
    const prox = (atual.compartimentos ?? []).find(c => c.id === subId);
    if (!prox) return null;
    cadeia.push(prox);
    atual = prox;
  }
  return cadeia;
}

function textoObsLabel(cor) {
  return cor === 'azul' ? 'Peguei emprestado com quem? *' : 'Reparo ou observação';
}

function textoObsPlaceholder(cor, ehItem = false) {
  if (cor === 'azul') return ehItem ? 'Nome de quem emprestou (obrigatório)' : 'Nome da pessoa';
  return ehItem ? 'Reparo ou observação do item' : 'Ex: Zíper com defeito, falta conferir...';
}

export function renderContainer(el, pathIds) {
  const bruto = pathIds?.length ? getBolsaById(pathIds[0]) : null;
  if (!bruto || bruto.excluida) {
    el.innerHTML = `<header class="barra"><a href="#/materiais" class="voltar">‹ Voltar</a><h1>Materiais</h1></header>
      <div class="form"><p class="vazio">Conjunto não encontrado.</p></div>`;
    return;
  }

  const raiz = normalizarNo(structuredClone(bruto));
  const cadeia = encontrarCaminho(raiz, pathIds);
  if (!cadeia) {
    el.innerHTML = `<header class="barra"><a href="#/material/${esc(raiz.id)}" class="voltar">‹ Voltar</a><h1>Materiais</h1></header>
      <div class="form"><p class="vazio">Bolsa ou caixa não encontrada.</p></div>`;
    return;
  }

  const ehRaiz = cadeia.length === 1;
  const noAtual = cadeia[cadeia.length - 1];
  const pai = ehRaiz ? null : cadeia[cadeia.length - 2];
  const hrefPai = ehRaiz ? '#/materiais' : `#/material/${pathIds.slice(0, -1).join('/')}`;
  const $ = s => el.querySelector(s);

  const crumbHtml = [
    `<a href="#/materiais">Materiais</a>`,
    ...cadeia.map((n, idx) => {
      const rotulo = esc(n.nome || 'Sem nome');
      if (idx === cadeia.length - 1) return `<b id="cCrumbAtual">${rotulo}</b>`;
      return `<a href="#/material/${pathIds.slice(0, idx + 1).join('/')}">${rotulo}</a>`;
    }),
  ].join(' <span aria-hidden="true">›</span> ');

  function persistir() {
    upsertBolsa(sanitizarParaSalvar(raiz, true));
    const selo = $('#cSalvo');
    if (selo) {
      selo.textContent = '✓ Salvo';
      selo.classList.add('visivel');
    }
  }

  el.innerHTML = `
  <header class="barra">
    <a href="${hrefPai}" class="voltar">‹ Voltar</a>
    <h1 id="cTituloBarra" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(noAtual.nome || 'Sem nome')}</h1>
    <span id="cSalvo" class="mat-salvo"></span>
  </header>
  <div class="form">
    <nav class="mat-crumb" aria-label="Caminho">${crumbHtml}</nav>

    <div class="mat-box-cfg">
      <div class="mat-cfg-linha">
        <label style="margin-top:0">Nome
          <input id="cNome" autocomplete="off" placeholder="Nome desta bolsa ou caixa">
        </label>
        <label style="margin-top:0">Número
          <input id="cNum" type="number" min="1" step="1" inputmode="numeric" placeholder="Opc.">
        </label>
      </div>
      ${ehRaiz ? `
      <label style="margin-top:10px">Categoria
        <select id="cTipo">
          ${ORDEM_TIPOS.map(t => `<option value="${t}" ${raiz.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>` : ''}

      <label style="margin-top:10px">Cor deste local</label>
      <div class="cor-pills" id="cCor">
        ${CORES.map(c => `
          <button type="button" class="cor-pill ${c} ${noAtual.cor === c ? 'ativo' : ''}"
            data-c="${c}" aria-pressed="${noAtual.cor === c}">
            <span class="dot ${c}" aria-hidden="true"></span><span>${COR_LABEL[c]}</span>
          </button>`).join('')}
      </div>

      <div id="cObsWrap" style="display:${noAtual.cor === 'amarelo' || noAtual.cor === 'azul' ? 'block' : 'none'}">
        <label style="margin-top:10px"><span id="cObsLabel">${textoObsLabel(noAtual.cor)}</span>
          <input id="cObs" autocomplete="off" placeholder="${textoObsPlaceholder(noAtual.cor, false)}">
          <small id="cObsAviso" class="mat-aviso" style="display:${noAtual.cor === 'azul' && !noAtual.obs.trim() ? 'block' : 'none'}">
            Informe o nome da pessoa (obrigatório para cor azul)
          </small>
        </label>
      </div>
    </div>

    <div class="mat-secao-topo">
      <h2>Bolsas e caixas aqui (<span id="cSubCont">${noAtual.compartimentos.length}</span>)</h2>
    </div>
    <div id="cSubs" class="mat-resultados"></div>
    <div id="cSubNovoWrap" class="mat-sub-form" style="display:none">
      <div class="mat-cfg-linha">
        <input id="cSubNovoNome" autocomplete="off" placeholder="Ex: Caixa de Fios, Bolsa 2...">
        <input id="cSubNovoNum" type="number" min="1" step="1" inputmode="numeric" placeholder="Nº">
      </div>
      <div class="duas" style="margin-top:8px">
        <button type="button" class="prim" id="cSubCriar" style="margin-top:0;padding:10px">Criar e abrir</button>
        <button type="button" class="sec" id="cSubCancelar" style="margin-top:0;padding:10px">Cancelar</button>
      </div>
    </div>
    <button class="sec" id="cBtnNovaSub" type="button">+ Adicionar bolsa ou caixa aqui</button>

    <div class="mat-secao-topo">
      <h2>Itens aqui (<span id="cItensCont">${noAtual.itens.length}</span>)</h2>
    </div>
    <div id="cItens"></div>
    <button class="sec" id="cAddItem" type="button">+ Adicionar item</button>

    <div style="margin-top:26px">
      <button class="sec" id="cDuplicar" type="button">${ehRaiz ? '📋 Duplicar conjunto inteiro' : '📋 Duplicar esta bolsa/caixa'}</button>
      <button class="perigo" id="cExcluir" type="button">${ehRaiz ? 'Excluir conjunto' : `Excluir "${esc(noAtual.nome || 'este local')}"`}</button>
    </div>
  </div>`;

  $('#cNome').value = noAtual.nome ?? '';
  $('#cNum').value = noAtual.numero ?? '';
  $('#cObs').value = noAtual.obs ?? '';
  if (noAtual.cor === 'azul' && !noAtual.obs.trim()) $('#cObs').classList.add('mat-obs-falta');

  // Campos de cabeçalho do container (auto-save)
  $('#cNome').oninput = () => {
    noAtual.nome = $('#cNome').value;
    const titulo = noAtual.nome.trim() || 'Sem nome';
    $('#cTituloBarra').textContent = titulo;
    $('#cCrumbAtual').textContent = titulo;
    persistir();
  };
  $('#cNum').oninput = () => {
    const v = parseInt($('#cNum').value, 10);
    noAtual.numero = Number.isInteger(v) && v >= 1 ? v : null;
    persistir();
  };
  if (ehRaiz) {
    $('#cTipo').onchange = () => { raiz.tipo = $('#cTipo').value; persistir(); };
  }
  $('#cObs').oninput = () => {
    noAtual.obs = $('#cObs').value;
    const faltaAzul = noAtual.cor === 'azul' && !noAtual.obs.trim();
    $('#cObs').classList.toggle('mat-obs-falta', faltaAzul);
    $('#cObsAviso').style.display = faltaAzul ? 'block' : 'none';
    persistir();
  };

  $('#cCor').onclick = e => {
    const btn = e.target.closest('[data-c]');
    if (!btn) return;
    noAtual.cor = btn.dataset.c;
    $('#cCor').querySelectorAll('[data-c]').forEach(p => {
      const on = p === btn;
      p.classList.toggle('ativo', on);
      p.setAttribute('aria-pressed', String(on));
    });
    const mostra = noAtual.cor === 'amarelo' || noAtual.cor === 'azul';
    $('#cObsWrap').style.display = mostra ? 'block' : 'none';
    if (mostra) {
      $('#cObsLabel').textContent = textoObsLabel(noAtual.cor);
      $('#cObs').placeholder = textoObsPlaceholder(noAtual.cor, false);
      const faltaAzul = noAtual.cor === 'azul' && !noAtual.obs.trim();
      $('#cObs').classList.toggle('mat-obs-falta', faltaAzul);
      $('#cObsAviso').style.display = faltaAzul ? 'block' : 'none';
      if (!noAtual.obs.trim()) $('#cObs').focus();
    } else {
      $('#cObsAviso').style.display = 'none';
      $('#cObs').classList.remove('mat-obs-falta');
    }
    persistir();
  };

  // Sub-bolsas / caixas
  function renderSubs() {
    $('#cSubCont').textContent = noAtual.compartimentos.length;
    if (!noAtual.compartimentos.length) {
      $('#cSubs').innerHTML = `<p style="color:var(--mut);font-size:.86rem;margin:0">Nenhuma sub-bolsa ou caixa aqui.</p>`;
      return;
    }
    $('#cSubs').innerHTML = noAtual.compartimentos
      .map(sub => htmlCardContainer(sub, [...pathIds, sub.id], '', true))
      .join('');
  }

  $('#cBtnNovaSub').onclick = () => {
    $('#cSubNovoWrap').style.display = 'block';
    $('#cBtnNovaSub').style.display = 'none';
    $('#cSubNovoNome').value = '';
    $('#cSubNovoNum').value = '';
    $('#cSubNovoNome').focus();
  };
  $('#cSubCancelar').onclick = () => {
    $('#cSubNovoWrap').style.display = 'none';
    $('#cBtnNovaSub').style.display = 'block';
  };
  $('#cSubCriar').onclick = () => {
    const nome = $('#cSubNovoNome').value.trim();
    if (!nome) { $('#cSubNovoNome').focus(); return; }
    const num = parseInt($('#cSubNovoNum').value, 10);
    const novaSub = {
      id: novoId(),
      nome,
      numero: Number.isInteger(num) && num >= 1 ? num : null,
      cor: 'verde',
      obs: '',
      itens: [],
      compartimentos: [],
    };
    noAtual.compartimentos.push(novaSub);
    persistir();
    location.hash = `#/material/${[...pathIds, novaSub.id].join('/')}`;
  };

  // Lista de itens diretos deste nível
  function renderItens() {
    const validos = noAtual.itens.filter(m => (m.nome ?? '').trim()).length;
    $('#cItensCont').textContent = validos;
    if (!noAtual.itens.length) {
      $('#cItens').innerHTML = `<p style="color:var(--mut);font-size:.86rem;margin:0 0 6px">Nenhum item direto aqui.</p>`;
      return;
    }
    $('#cItens').innerHTML = noAtual.itens.map((m, i) => {
      const cor = CORES.includes(m.cor) ? m.cor : 'verde';
      const mostraObs = cor === 'amarelo' || cor === 'azul';
      const faltaAzul = cor === 'azul' && !(m.obs ?? '').trim();
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
          <button class="x" data-del="${i}" type="button" aria-label="Remover item">×</button>
        </div>
        <div class="mat-obs-wrap" style="display:${mostraObs ? 'block' : 'none'}">
          <input class="mat-obs ${faltaAzul ? 'mat-obs-falta' : ''}" data-i="${i}" value="${esc(m.obs || '')}" placeholder="${textoObsPlaceholder(cor, true)}">
          <small class="mat-aviso" style="display:${faltaAzul ? 'block' : 'none'}">Informe o nome da pessoa</small>
        </div>
      </div>`;
    }).join('');
  }

  const $itens = $('#cItens');

  $itens.addEventListener('input', e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    const item = noAtual.itens[i];
    if (e.target.classList.contains('mat-nome')) {
      item.nome = e.target.value;
      $('#cItensCont').textContent = noAtual.itens.filter(m => (m.nome ?? '').trim()).length;
    }
    if (e.target.classList.contains('mat-obs')) {
      item.obs = e.target.value;
      const falta = item.cor === 'azul' && !item.obs.trim();
      e.target.classList.toggle('mat-obs-falta', falta);
      e.target.closest('.mat-obs-wrap').querySelector('.mat-aviso').style.display = falta ? 'block' : 'none';
    }
    persistir();
  });

  $itens.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      noAtual.itens.splice(Number(delBtn.dataset.del), 1);
      renderItens();
      persistir();
      return;
    }

    const corBtn = e.target.closest('[data-cor]');
    if (!corBtn) return;
    const i = Number(corBtn.dataset.i);
    const novaCor = corBtn.dataset.cor;
    noAtual.itens[i].cor = novaCor;

    const row = corBtn.closest('.mat-row');
    row.querySelectorAll('.mat-cor-btn').forEach(btn => {
      const on = btn === corBtn;
      btn.classList.toggle('ativo', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    const obsWrap = row.querySelector('.mat-obs-wrap');
    const obsInput = row.querySelector('.mat-obs');
    const obsAviso = row.querySelector('.mat-aviso');
    const mostraObs = novaCor === 'amarelo' || novaCor === 'azul';
    obsWrap.style.display = mostraObs ? 'block' : 'none';
    if (mostraObs) {
      obsInput.placeholder = textoObsPlaceholder(novaCor, true);
      const faltaAzul = novaCor === 'azul' && !obsInput.value.trim();
      obsInput.classList.toggle('mat-obs-falta', faltaAzul);
      obsAviso.style.display = faltaAzul ? 'block' : 'none';
      if (!obsInput.value.trim()) obsInput.focus();
    } else {
      obsInput.classList.remove('mat-obs-falta');
      obsAviso.style.display = 'none';
    }
    persistir();
  });

  $('#cAddItem').onclick = () => {
    noAtual.itens.push({ id: novoId(), nome: '', cor: 'verde', obs: '' });
    renderItens();
    const inputs = $itens.querySelectorAll('.mat-nome');
    inputs[inputs.length - 1]?.focus();
  };

  // Duplicar (conjunto inteiro na raiz, ou sub-bolsa dentro do mesmo pai)
  $('#cDuplicar').onclick = () => {
    const clone = clonarNoComNovosIds(sanitizarParaSalvar(noAtual, ehRaiz));
    if (ehRaiz) {
      const novoNum = proximoNumero(raiz.tipo, getBolsas());
      clone.numero = novoNum;
      clone.nome = incrementarNomeComNumero(clone.nome, novoNum);
      upsertBolsa(clone);
      location.hash = `#/material/${clone.id}`;
    } else {
      const nums = pai.compartimentos.map(c => Number(c.numero) || 0);
      const prox = (nums.length ? Math.max(...nums) : 0) + 1;
      if (clone.numero) clone.numero = prox;
      clone.nome = clone.nome ? `${clone.nome} (cópia)` : 'Cópia';
      pai.compartimentos.push(clone);
      persistir();
      location.hash = `#/material/${[...pathIds.slice(0, -1), clone.id].join('/')}`;
    }
  };

  // Excluir
  $('#cExcluir').onclick = () => {
    const msg = ehRaiz
      ? `Excluir "${raiz.nome || 'este conjunto'}" e tudo que está dentro?`
      : `Excluir "${noAtual.nome || 'este local'}" e seus itens internos?`;
    if (!confirm(msg)) return;

    if (ehRaiz) {
      removeBolsa(raiz.id);
      location.hash = '#/materiais';
    } else {
      pai.compartimentos = pai.compartimentos.filter(c => c.id !== noAtual.id);
      upsertBolsa(sanitizarParaSalvar(raiz, true));
      location.hash = hrefPai;
    }
  };

  renderSubs();
  renderItens();
}
