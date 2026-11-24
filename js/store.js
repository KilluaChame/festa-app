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

// ── Pacotes ──
export const getPacotes = () => (dados.pacotes ?? []).filter(p => !p.excluida);
export const getPacoteById = id => (dados.pacotes ?? []).find(p => p.id === id);

export function upsertPacote(pacote) {
  if (!dados.pacotes) dados.pacotes = [];
  const pacoteCompleto = {
    excluida: false,
    ...pacote,
    atualizadoEm: new Date().toISOString(),
  };
  const i = dados.pacotes.findIndex(p => p.id === pacoteCompleto.id);
  if (i >= 0) dados.pacotes[i] = pacoteCompleto;
  else dados.pacotes.push(pacoteCompleto);
  confirmar('pacote', pacoteCompleto);
}

export function removePacote(id) {
  if (!dados.pacotes) return;
  const i = dados.pacotes.findIndex(p => p.id === id);
  if (i < 0) return;
  dados.pacotes[i] = {
    ...dados.pacotes[i],
    excluida: true,
    atualizadoEm: new Date().toISOString(),
  };
  confirmar('pacote', dados.pacotes[i]);
}

function confirmar(evento, festa) {
  salvar(dados);
  ouvintes.forEach(fn => fn(evento, festa, dados));
}

/**
 * Insere ou atualiza uma festa.
 * Sempre preenche atualizadoEm com o instante atual.
 */
export function upsert(festa) {
  // Preserva googleEventId existente — nunca apaga o vínculo com o evento do Google
  const existente = dados.festas.find(p => p.id === festa.id);
  const festaCompleta = {
    excluida: false,
    googleEventId: existente?.googleEventId ?? null, // preserva vínculo existente
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
  // Preserva calendarId e googleClientId em memória se o dado novo não tiver —
  // evita race condition entre agenda.js (que acabou de criar a agenda) e o
  // sync do GitHub (que trouxe uma versão remota mais antiga sem o id).
  const calendarId = dados.config?.calendarId ?? novosDados.config?.calendarId ?? null;
  const googleClientId = dados.config?.googleClientId ?? novosDados.config?.googleClientId ?? null;
  dados = novosDados;
  if (calendarId)     dados.config.calendarId     = calendarId;
  if (googleClientId) dados.config.googleClientId = googleClientId;
  salvar(dados);
}

/**
 * Atualiza apenas campos de sincronização (ex.: googleEventId) em uma festa
 * sem disparar onChange e sem sobrescrever config ou outras festas.
 */
export function atualizarFestaSync(id, campos) {
  const i = dados.festas.findIndex(p => p.id === id);
  if (i < 0) return;
  dados.festas[i] = { ...dados.festas[i], ...campos };
  salvar(dados);
}
