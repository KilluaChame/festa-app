// Regras de dinheiro. Funções puras: não mexem em tela nem em dados salvos.
export const total = p => (p.itens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
export const recebido = p => Number(p.recebido) || 0;
export const aReceber = p => Math.max(0, total(p) - recebido(p));

export function status(p) {
  const t = total(p), r = recebido(p);
  if (t > 0 && r >= t) return 'pago';
  if (r > 0) return 'parcial';
  return 'aberto';
}
export const STATUS_TEXTO = { pago: 'Pago', parcial: 'Parcial', aberto: 'Em aberto' };

/**
 * Situação consolidada de um conjunto de festas (ex.: um mês):
 * - 'pago' (verde): todas as festas quitadas (total > 0 e aReceber <= 0)
 * - 'parcial' (amarelo): recebeu parte, mas ainda falta receber em alguma festa
 * - 'aberto' (vermelho): nada recebido ainda (recebido <= 0 e total > 0)
 * - '' (neutro): sem festas / total 0
 */
export function statusGrupo(totalVal, recebidoVal, faltaVal) {
  if (totalVal <= 0) return '';
  if (faltaVal <= 0) return 'pago';
  if (recebidoVal > 0) return 'parcial';
  return 'aberto';
}

/**
 * Agrupa festas por mês (YYYY-MM), ordenadas do mês mais recente para o mais antigo.
 * Retorna [{ mes, quantidade, total, recebido, aReceber }].
 */
export function resumoMensal(festas) {
  const mapa = new Map();
  for (const p of festas) {
    if (p.excluida || !p.data) continue;
    const mes = p.data.slice(0, 7);
    if (!mapa.has(mes)) {
      mapa.set(mes, { mes, quantidade: 0, total: 0, recebido: 0, aReceber: 0 });
    }
    const item = mapa.get(mes);
    item.quantidade += 1;
    item.total += total(p);
    item.recebido += recebido(p);
    item.aReceber += aReceber(p);
  }
  return Array.from(mapa.values()).sort((a, b) => b.mes.localeCompare(a.mes));
}
