// Ponto de entrada: liga as telas e os módulos de sincronização.
// Módulos novos importam aqui e assinam onChange() — as telas não conhecem o sync.
import { renderHome } from './views/home.js';
import { renderForm } from './views/form.js';
import { renderConfig } from './views/config.js';
import { onChange } from './store.js';
import { sincronizar, agendarSync, onEstadoSync } from './sync/github.js';
import { reagirMudanca, onEstadoAgenda } from './sync/agenda.js';

const raiz = document.getElementById('app');

function rota() {
  const h = location.hash || '#/';
  if (h === '#/nova')               renderForm(raiz, null);
  else if (h === '#/config')        renderConfig(raiz);
  else if (h.startsWith('#/festa/')) renderForm(raiz, h.slice(8));
  else                              renderHome(raiz);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);
rota();

// Ao salvar ou excluir qualquer festa:
// 1. Agenda sync com GitHub (debounce)
// 2. Atualiza Google Agenda (se configurado)
onChange((evento, festa) => {
  agendarSync();
  reagirMudanca(evento, festa).catch(() => {}); // falha não bloqueia nada
});

// Ao abrir o app, sincroniza com GitHub em segundo plano
sincronizar();

// Quando estado do sync ou da agenda muda, re-renderiza a home se ela estiver visível
function atualizarHomeSeVisivel() {
  const h = location.hash || '#/';
  if (h === '#/' || h === '') renderHome(raiz);
}
onEstadoSync(atualizarHomeSeVisivel);
onEstadoAgenda(atualizarHomeSeVisivel);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
