// Google Agenda — cria, atualiza e remove eventos para cada festa.
// Autenticação via Google Identity Services (fluxo token, no navegador, sem backend).
// Escopo: https://www.googleapis.com/auth/calendar.app.created
//   → Permite criar agendas secundárias e gerenciar APENAS os eventos delas.
//
// As telas não conhecem este módulo. Ele reage ao onChange() do store (via app.js).

import { getConfig, setConfig, atualizarFestaSync } from '../store.js';

// --- Constantes ---
const ESCOPO     = 'https://www.googleapis.com/auth/calendar.app.created';
const NOME_AGENDA = 'Festas';
const FUSO       = 'America/Sao_Paulo';
const BASE_URL   = 'https://www.googleapis.com/calendar/v3';

// Chave onde guardamos o access_token em memória (NÃO persiste — expira e é renovado)
let _accessToken = null;
let _tokenExpira = 0; // timestamp ms

// Ouvintes de estado
let _ouvintesEstado = [];
export const estadoAgenda = { status: 'ocioso', mensagem: '' };

function emitirEstado(status, mensagem = '') {
  estadoAgenda.status = status;
  estadoAgenda.mensagem = mensagem;
  _ouvintesEstado.forEach(fn => fn({ ...estadoAgenda }));
}

export function onEstadoAgenda(fn) { _ouvintesEstado.push(fn); }

// --- Autenticação ---

function clientId() {
  return getConfig().googleClientId ?? null;
}

/** Verifica se o access_token ainda é válido (sobra ≥ 60 s). */
function tokenValido() {
  return _accessToken && Date.now() < _tokenExpira - 60_000;
}

/**
 * Pede (ou renova) o access_token via Google Identity Services.
 * Retorna o token ou lança erro se o usuário cancelar.
 */
function obterToken() {
  return new Promise((resolve, reject) => {
    if (tokenValido()) { resolve(_accessToken); return; }

    const id = clientId();
    if (!id) { reject(new Error('Client ID do Google não configurado.')); return; }

    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      reject(new Error('Biblioteca do Google Identity Services não carregada.'));
      return;
    }

    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: ESCOPO,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description ?? resp.error)); return; }
        _accessToken = resp.access_token;
        _tokenExpira = Date.now() + resp.expires_in * 1000;
        resolve(_accessToken);
      },
    });
    cliente.requestAccessToken({ prompt: '' }); // '' = sem prompt se já tiver consentimento
  });
}

function headers() {
  return {
    'Authorization': `Bearer ${_accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function api(method, path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`Calendar API ${r.status}: ${err?.error?.message ?? r.statusText}`);
  }
  return r.json();
}

// --- Agenda "Festas" ---

let _garantindoAgenda = null;

/**
 * Procura uma agenda existente chamada "Festas" na conta do usuário.
 * Evita criar agendas duplicadas caso config.calendarId ainda não esteja salvo.
 */
async function buscarAgendaExistente() {
  try {
    const lista = await api('GET', '/users/me/calendarList?minAccessRole=owner');
    const encontrada = (lista?.items ?? []).find(c => c.summary === NOME_AGENDA);
    return encontrada?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Garante que a agenda "Festas" existe.
 * 1. Se já existe em config.calendarId, retorna.
 * 2. Senão, procura na lista de agendas do Google antes de criar uma nova.
 * 3. Usa trava (_garantindoAgenda) para chamadas simultâneas não duplicarem.
 */
async function garantirAgenda() {
  const cfg = getConfig();
  if (cfg.calendarId) return cfg.calendarId;

  if (_garantindoAgenda) return _garantindoAgenda;

  _garantindoAgenda = (async () => {
    try {
      let id = await buscarAgendaExistente();
      if (!id) {
        const agenda = await api('POST', '/calendars', {
          summary: NOME_AGENDA,
          timeZone: FUSO,
        });
        id = agenda.id;
      }
      setConfig({ calendarId: id });
      return id;
    } finally {
      _garantindoAgenda = null;
    }
  })();

  return _garantindoAgenda;
}

// --- Horário ---

/** Extrai início e fim de strings como "14:00 às 17:00" ou "14h às 17h". */
function extrairHorario(dataISO, horarioStr) {
  if (!horarioStr) return null;
  const m = horarioStr.match(/(\d{1,2})[:h](\d{0,2})\s*(?:às|as|-|a)\s*(\d{1,2})[:h](\d{0,2})/i);
  if (!m) return null;
  const hI = m[1].padStart(2, '0'), mI = (m[2] || '00').padStart(2, '0');
  const hF = m[3].padStart(2, '0'), mF = (m[4] || '00').padStart(2, '0');
  return {
    start: { dateTime: `${dataISO}T${hI}:${mI}:00`, timeZone: FUSO },
    end:   { dateTime: `${dataISO}T${hF}:${mF}:00`, timeZone: FUSO },
  };
}

/** Monta o objeto de evento para a API do Google Calendar. */
function montarEvento(festa, calendarId) {
  const horario = extrairHorario(festa.data, festa.horario);
  const nomes = (festa.itens ?? []).map(i => i.nome).filter(Boolean).join(', ');
  const descricao = [
    `Cliente: ${festa.cliente || '-'}`,
    nomes ? `Pacote: ${nomes}` : null,
    festa.obs ? `Obs: ${festa.obs}` : null,
  ].filter(Boolean).join('\n');

  return {
    summary: `Festa: ${festa.aniversariante || 'Sem nome'}`,
    location: festa.endereco || undefined,
    description: descricao,
    ...(horario ?? {
      // Sem horário reconhecível → evento de dia inteiro
      start: { date: festa.data },
      end:   { date: festa.data },
    }),
    extendedProperties: {
      private: { festaId: festa.id },   // idempotência: nunca duplica
    },
  };
}

// --- Operações principais ---

/** Cria ou atualiza o evento de uma festa. Retorna o googleEventId. */
export async function sincronizarFesta(festa) {
  if (!festa.data) return null;

  await obterToken();
  const calendarId = await garantirAgenda();
  const evento = montarEvento(festa, calendarId);

  if (festa.googleEventId) {
    // Atualiza evento existente
    try {
      await api('PUT', `/calendars/${encodeURIComponent(calendarId)}/events/${festa.googleEventId}`, evento);
      return festa.googleEventId;
    } catch (err) {
      // Evento foi apagado manualmente no Google → cria de novo
      if (!String(err.message).includes('404')) throw err;
    }
  }

  // Cria novo evento (se a agenda salva foi apagada no Google, recria/reencontra e tenta de novo)
  try {
    const criado = await api('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, evento);
    return criado.id;
  } catch (err) {
    if (!String(err.message).includes('404')) throw err;
    setConfig({ calendarId: null });
    const novoCalendarId = await garantirAgenda();
    const criado = await api('POST', `/calendars/${encodeURIComponent(novoCalendarId)}/events`, evento);
    return criado.id;
  }
}

/** Remove o evento de uma festa excluída. */
export async function removerEvento(festa) {
  if (!festa.googleEventId) return;
  const cfg = getConfig();
  if (!cfg.calendarId) return;
  await obterToken();
  await api('DELETE', `/calendars/${encodeURIComponent(cfg.calendarId)}/events/${festa.googleEventId}`)
    .catch(() => {}); // se já não existe, ignora
}

// --- Reação ao onChange do store ---

/**
 * Chamado pelo app.js via onChange().
 * Trata um evento de salvar ou excluir, atualizando a agenda e o googleEventId da festa.
 * Retorna true se alterou dados locais (para o app.js reagendar o sync com GitHub).
 */
export async function reagirMudanca(evento, festa) {
  if (!clientId()) return false; // Google não configurado — ignora silenciosamente
  emitirEstado('sincronizando', 'Atualizando Google Agenda...');
  try {
    if (evento === 'excluiu' || festa.excluida) {
      await removerEvento(festa);
      atualizarFestaSync(festa.id, { googleEventId: null });
    } else {
      const eventId = await sincronizarFesta(festa);
      atualizarFestaSync(festa.id, { googleEventId: eventId });
    }

    emitirEstado('ok', '✓ Google Agenda atualizado.');
    return true;
  } catch (err) {
    console.error('[agenda-sync]', err);
    emitirEstado('erro', msgAmigavel(err));
    return false;
  }
}

function msgAmigavel(err) {
  const m = String(err?.message ?? '');
  if (m.includes('Client ID'))      return '✗ Client ID do Google não configurado. Verifique em Configurações.';
  if (m.includes('401'))            return '✗ Sessão do Google expirada. Salve a festa de novo para reconectar.';
  if (m.includes('403'))            return '✗ Sem permissão no Google. Verifique o escopo da credencial.';
  if (m.includes('Identity Services')) return '✗ Recarregue a página para inicializar o Google.';
  if (m.includes('Failed to fetch')) return '✗ Sem conexão. A agenda será atualizada quando a internet voltar.';
  return `✗ Erro Google Agenda: ${m.slice(0, 80)}`;
}
