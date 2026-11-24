// Ponto de entrada: liga as telas e os módulos de sincronização.
// Módulos novos importam aqui e assinam onChange() — as telas não conhecem o sync.
import { renderHome } from './views/home.js';
import { renderForm } from './views/form.js';
import { renderConfig } from './views/config.js';
import { onChange } from './store.js';
import { sincronizar, agendarSync, onEstadoSync } from './sync/github.js';

const raiz = document.getElementById('app');

function rota() {
  const h = location.hash || '#/';
  if (h === '#/nova')           renderForm(raiz, null);
  else if (h === '#/config')    renderConfig(raiz);
  else if (h.startsWith('#/festa/')) renderForm(raiz, h.slice(8));
  else                          renderHome(raiz);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);
rota();

// Ao salvar ou excluir qualquer festa, agenda sincronização com debounce
onChange(() => agendarSync());

// Ao abrir o app, sincroniza em segundo plano (sem bloquear a tela)
sincronizar();

// Quando o estado do sync muda, re-renderiza a home se ela estiver visível
onEstadoSync(() => {
  const h = location.hash || '#/';
  if (h === '#/' || h === '') renderHome(raiz);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
