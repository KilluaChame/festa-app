// Sincronização com GitHub via REST API (endpoint Contents).
// Token e dados do repositório ficam APENAS no localStorage — nunca em arquivo.
// As telas não conhecem este módulo; ele reage ao onChange() do store.

import { getDados, substituirDados, getConfig } from '../store.js';
import { mesclar } from '../core/merge.js';

// Chave do token no localStorage (separada do dados.json que vai pro GitHub)
const CHAVE_TOKEN = 'festas.token';

// Tempo de debounce para agrupar várias mudanças seguidas (ms)
const DEBOUNCE_MS = 1500;

// Estado interno do módulo
let _timer = null;
let _sincronizando = false;
let _ouvintesEstado = [];

export const estadoSync = {
  status: 'ocioso',   // 'ocioso' | 'sincronizando' | 'pendente' | 'erro' | 'ok'
  mensagem: '',
  ultimaSync: null,
};

function emitirEstado(status, mensagem = '') {
  estadoSync.status = status;
  estadoSync.mensagem = mensagem;
  if (status === 'ok') estadoSync.ultimaSync = new Date();
  _ouvintesEstado.forEach(fn => fn({ ...estadoSync }));
}

export function onEstadoSync(fn) {
  _ouvintesEstado.push(fn);
}

function credenciais() {
  const cfg   = getConfig();
  const token = localStorage.getItem(CHAVE_TOKEN);
  const dono  = cfg.githubDono;
  const repo  = cfg.githubRepo ?? 'festas-dados';
  return { token, dono, repo, ok: !!(token && dono) };
}

function url(dono, repo) {
  return `https://api.github.com/repos/${dono}/${repo}/contents/dados.json`;
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** Converte string UTF-8 → base64 (compatível com acentos). */
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/** Converte base64 → string UTF-8 (compatível com acentos). */
function fromBase64(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * Baixa o dados.json do repositório privado.
 * Retorna { dadosRemoto, sha } ou null se arquivo não existe ainda.
 */
async function baixar(token, dono, repo) {
  const r = await fetch(url(dono, repo), { headers: headers(token) });
  if (r.status === 404) return null;        // arquivo ainda não existe
  if (!r.ok) throw new Error(`GitHub GET ${r.status}: ${r.statusText}`);
  const json = await r.json();
  const conteudo = fromBase64(json.content.replace(/\n/g, ''));
  return { dadosRemoto: JSON.parse(conteudo), sha: json.sha };
}

/**
 * Envia o dados.json atualizado.
 * sha = null → cria o arquivo. sha = string → atualiza (exige sha atual).
 */
async function enviar(token, dono, repo, dados, sha) {
  const body = {
    message: `sync: atualiza dados.json [${new Date().toISOString()}]`,
    content: toBase64(JSON.stringify(dados, null, 2)),
  };
  if (sha) body.sha = sha;

  const r = await fetch(url(dono, repo), {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (r.status === 409) return 'conflito';  // sha desatualizado
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${r.statusText}`);
  return 'ok';
}

/**
 * Executa a sincronização completa. Tenta até 3 vezes em caso de conflito de sha.
 * Retorna true se sucesso, false se falha.
 */
export async function sincronizar() {
  if (_sincronizando) return false;

  const { token, dono, repo, ok } = credenciais();
  if (!ok) {
    emitirEstado('pendente', 'Configure o token e o repositório em Configurações.');
    return false;
  }

  _sincronizando = true;
  emitirEstado('sincronizando', 'Sincronizando com GitHub...');

  let tentativas = 0;
  while (tentativas < 3) {
    tentativas++;
    try {
      // 1. Baixa o remoto
      const remoto = await baixar(token, dono, repo);
      const listaRemota = remoto?.dadosRemoto?.festas ?? [];
      const sha = remoto?.sha ?? null;

      // 2. Mescla
      const local = getDados();
      const listaUnida = mesclar(local.festas, listaRemota);

      // 3. Dados unificados
      const dadosUnidos = {
        ...local,
        festas: listaUnida,
        config: {
          ...local.config,
          // Preserva calendarId do remoto se o local não tem
          calendarId: local.config.calendarId ?? remoto?.dadosRemoto?.config?.calendarId ?? null,
        },
      };

      // 4. Atualiza o aparelho
      substituirDados(dadosUnidos);

      // 5. Verifica se precisa enviar (resultado diferente do remoto)
      const remotoStr = JSON.stringify(remoto?.dadosRemoto ?? {});
      const unidoStr  = JSON.stringify(dadosUnidos);
      if (remotoStr !== unidoStr) {
        const resultado = await enviar(token, dono, repo, dadosUnidos, sha);
        if (resultado === 'conflito') {
          // sha mudou entre o GET e o PUT — tenta de novo
          continue;
        }
      }

      emitirEstado('ok', 'Sincronizado.');
      _sincronizando = false;
      return true;

    } catch (err) {
      console.error('[github-sync]', err);
      const msg = msgAmigavel(err);
      if (tentativas >= 3) {
        emitirEstado('erro', msg);
        _sincronizando = false;
        return false;
      }
      // Aguarda um pouco antes de tentar de novo
      await new Promise(r => setTimeout(r, 800 * tentativas));
    }
  }

  emitirEstado('erro', 'Não foi possível sincronizar após 3 tentativas.');
  _sincronizando = false;
  return false;
}

function msgAmigavel(err) {
  const m = String(err?.message ?? '');
  if (m.includes('401'))  return '✗ Token inválido ou expirado. Verifique em Configurações.';
  if (m.includes('403'))  return '✗ Sem permissão. Verifique se o token tem Contents: leitura e escrita.';
  if (m.includes('404'))  return '✗ Repositório não encontrado. Verifique o nome em Configurações.';
  if (m.includes('Failed to fetch') || m.includes('NetworkError'))
    return '✗ Sem conexão. Os dados estão salvos e serão enviados quando a internet voltar.';
  return `✗ Erro: ${m.slice(0, 80)}`;
}

/**
 * Agenda uma sincronização com debounce.
 * Chamado pelo onChange do store ao salvar/excluir.
 */
export function agendarSync() {
  emitirEstado('pendente', 'Aguardando para sincronizar...');
  clearTimeout(_timer);
  _timer = setTimeout(() => sincronizar(), DEBOUNCE_MS);
}

/** Tenta sincronizar ao recuperar conexão de internet. */
window.addEventListener('online', () => {
  if (estadoSync.status === 'erro' || estadoSync.status === 'pendente') {
    sincronizar();
  }
});
