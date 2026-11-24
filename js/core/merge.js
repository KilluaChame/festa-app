// Regra de conflito: por festa, vence a editada por último (maior atualizadoEm).
// Empate: mantém a do aparelho (local).
// Função pura — não acessa DOM, localStorage, rede nem qualquer efeito colateral.

/**
 * Mescla duas listas de festas.
 *
 * @param {Array} listaLocal  - festas do aparelho atual
 * @param {Array} listaRemota - festas do repositório GitHub
 * @returns {Array} lista unida, uma entrada por id, sem duplicatas
 */
export function mesclar(listaLocal, listaRemota) {
  // Indexa ambas as listas por id para busca O(1)
  const porId = new Map();

  // Insere todas as remotas primeiro
  for (const festa of listaRemota) {
    porId.set(festa.id, festa);
  }

  // Para cada local, decide qual versão vence
  for (const local of listaLocal) {
    const remota = porId.get(local.id);

    if (!remota) {
      // Festa existe só localmente → inclui
      porId.set(local.id, local);
      continue;
    }

    // Ambas existem → vence a com maior atualizadoEm
    const tsLocal = local.atualizadoEm ? new Date(local.atualizadoEm).getTime() : 0;
    const tsRemota = remota.atualizadoEm ? new Date(remota.atualizadoEm).getTime() : 0;

    if (tsLocal >= tsRemota) {
      // Local mais recente ou empate (empate: mantém local)
      porId.set(local.id, local);
    }
    // Se remota for mais recente, já está no Map — não faz nada
  }

  return Array.from(porId.values());
}
