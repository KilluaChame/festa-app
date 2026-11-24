// Ponto de entrada: só liga as telas. Para criar módulos novos
// (ex.: js/sync/github.js), importe aqui e assine com onChange().
import { renderHome } from './views/home.js';
import { renderForm } from './views/form.js';

const raiz = document.getElementById('app');

function rota() {
  const h = location.hash || '#/';
  if (h === '#/nova') renderForm(raiz, null);
  else if (h.startsWith('#/festa/')) renderForm(raiz, h.slice(8));
  else renderHome(raiz);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);
rota();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
