// Funções de ajuda (formatação, datas).
export const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  const dia = new Date(+a, +m - 1, +d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia}, ${d}/${m}/${a}`;
}
export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
