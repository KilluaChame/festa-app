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
