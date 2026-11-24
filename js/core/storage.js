// Única camada que sabe ONDE os dados ficam (no aparelho).
// A sincronização com GitHub entra em js/sync/ sem mexer aqui.

const CHAVE_V1 = 'festas.v1';
const CHAVE_V2 = 'festas.v2';

/** Converte dados no formato antigo (lista simples) para o novo formato. */
function migrarV1(listaAntiga, agora) {
  return listaAntiga.map(p => ({
    ...p,
    atualizadoEm: agora,
    excluida: false,
    googleEventId: p.googleEventId ?? null,
  }));
}

/**
 * Carrega os dados do aparelho.
 * Retorna o objeto completo: { versao, config, festas }
 */
export function carregar() {
  try {
    const v2 = localStorage.getItem(CHAVE_V2);
    if (v2) {
      const d = JSON.parse(v2);
      // Garante que pacotes existe (dados criados antes desta versão)
      if (!d.pacotes) d.pacotes = [];
      return d;
    }

    // Migração: formato antigo era uma lista simples em 'festas.v1'
    const v1 = localStorage.getItem(CHAVE_V1);
    if (v1) {
      const listaAntiga = JSON.parse(v1) || [];
      const agora = new Date().toISOString();
      const dados = {
        versao: 1,
        config: { calendarId: null },
        festas: migrarV1(listaAntiga, agora),
        pacotes: [],
      };
      salvar(dados);
      // Remove chave antiga para não migrar de novo
      localStorage.removeItem(CHAVE_V1);
      return dados;
    }
  } catch {
    // Dados corrompidos: começa do zero
  }

  return { versao: 1, config: { calendarId: null }, festas: [], pacotes: [] };
}

/**
 * Grava o objeto completo { versao, config, festas } no localStorage.
 */
export function salvar(dados) {
  localStorage.setItem(CHAVE_V2, JSON.stringify(dados));
}
