// Única camada que sabe ONDE os dados ficam (hoje: no aparelho).
// Depois, a sincronização com GitHub entra em js/sync/ sem mexer aqui.
const CHAVE = 'festas.v1';

export function carregar() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
  catch { return []; }
}
export function salvar(lista) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}
