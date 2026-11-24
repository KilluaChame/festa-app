// Dados em memória + aviso de mudanças.
// Qualquer módulo futuro (GitHub, Google Agenda) usa onChange() para reagir
// ao salvar/excluir uma festa, sem alterar as telas.
import { carregar, salvar } from './core/storage.js';

let festas = carregar();
const ouvintes = [];

export const getAll = () => festas;
export const getById = id => festas.find(p => p.id === id);
export const onChange = fn => ouvintes.push(fn);

function confirmar(evento, festa) {
  salvar(festas);
  ouvintes.forEach(fn => fn(evento, festa, festas));
}
export function upsert(festa) {
  const i = festas.findIndex(p => p.id === festa.id);
  if (i >= 0) festas[i] = festa; else festas.push(festa);
  confirmar('salvou', festa);
}
export function remove(id) {
  const festa = getById(id);
  festas = festas.filter(p => p.id !== id);
  confirmar('excluiu', festa);
}
