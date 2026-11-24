// Dados em memória + aviso de mudanças.
// Qualquer módulo futuro (GitHub, Google Agenda) usa onChange() para reagir
// ao salvar/excluir uma festa, sem alterar as telas.
import { carregar, salvar } from './core/storage.js';

let dados = carregar(); // { versao, config, festas }

const ouvintes = [];

// Retorna apenas festas não excluídas, para as telas.
export const getAll = () => dados.festas.filter(p => !p.excluida);

export const getById = id => dados.festas.find(p => p.id === id);

export const getConfig = () => dados.config;

export const setConfig = updates => {
  dados.config = { ...dados.config, ...updates };
  salvar(dados);
};

export const onChange = fn => ouvintes.push(fn);

function confirmar(evento, festa) {
  salvar(dados);
  ouvintes.forEach(fn => fn(evento, festa, dados));
}

/**
 * Insere ou atualiza uma festa.
 * Sempre preenche atualizadoEm com o instante atual.
 */
export function upsert(festa) {
  const festaCompleta = {
    excluida: false,
    googleEventId: null,
    ...festa,
    atualizadoEm: new Date().toISOString(),
  };
  const i = dados.festas.findIndex(p => p.id === festaCompleta.id);
  if (i >= 0) dados.festas[i] = festaCompleta;
  else dados.festas.push(festaCompleta);
  confirmar('salvou', festaCompleta);
}

/**
 * Marca a festa como excluída (soft delete).
 * Isso garante que a exclusão vença na sincronização entre aparelhos.
 */
export function remove(id) {
  const i = dados.festas.findIndex(p => p.id === id);
  if (i < 0) return;
  dados.festas[i] = {
    ...dados.festas[i],
    excluida: true,
    atualizadoEm: new Date().toISOString(),
  };
  confirmar('excluiu', dados.festas[i]);
}

/**
 * Substitui toda a lista de festas (usado pela sincronização com GitHub).
 * Não dispara onChange para evitar loop.
 */
export function substituirFestas(novaLista) {
  dados.festas = novaLista;
  salvar(dados);
}

/** Exporta o objeto completo para serialização (GitHub sync). */
export const getDados = () => dados;

/** Substitui os dados completos vindos do GitHub após mescla. */
export function substituirDados(novosDados) {
  dados = novosDados;
  salvar(dados);
}
