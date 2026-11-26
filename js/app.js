// Ponto de entrada: liga as telas e os módulos de sincronização.
// Módulos novos importam aqui e assinam onChange() — as telas não conhecem o sync.
import { renderHome, setAba } from './views/home.js';
import { renderForm } from './views/form.js';
import { renderConfig } from './views/config.js';
import { renderPacoteForm } from './views/pacotes.js';
import { renderMensal } from './views/mensal.js';
import { renderNovoConjunto, renderContainer } from './views/materiais.js';
import { onChange } from './store.js';
import { sincronizar, agendarSync, onEstadoSync } from './sync/github.js';
import { reagirMudanca, onEstadoAgenda } from './sync/agenda.js';

const raiz = document.getElementById('app');

function rota() {
  const h = location.hash || '#/';
  if (h === '#/nova')                   renderForm(raiz, null);
  else if (h === '#/config')            renderConfig(raiz);
  else if (h === '#/mensal')            renderMensal(raiz);
  else if (h === '#/pacotes')           { setAba('pacotes'); renderHome(raiz); }
  else if (h === '#/pacote/novo')       renderPacoteForm(raiz, null);
  else if (h.startsWith('#/pacote/'))   renderPacoteForm(raiz, h.slice(9));
  else if (h === '#/materiais')         { setAba('materiais'); renderHome(raiz); }
  else if (h === '#/material/novo')     renderNovoConjunto(raiz);
  else if (h.startsWith('#/material/')) renderContainer(raiz, h.slice(11).split('/').filter(Boolean));
  else if (h.startsWith('#/festa/'))    renderForm(raiz, h.slice(8));
  else                                  renderHome(raiz);
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);
rota();

// Ao salvar ou excluir:
// 1. Agenda sync com GitHub (festas e pacotes)
// 2. Atualiza Google Agenda apenas para festas
onChange((evento, item) => {
  agendarSync();
  if (evento === 'salvou' || evento === 'excluiu') {
    reagirMudanca(evento, item)
      .then(alterou => { if (alterou) agendarSync(); })
      .catch(() => {}); // falha não bloqueia nada
  }
});

// Ao abrir o app, sincroniza com GitHub em segundo plano
sincronizar();

// Quando estado do sync ou da agenda muda, re-renderiza a home se ela estiver visível
function atualizarHomeSeVisivel() {
  const h = location.hash || '#/';
  if (h === '#/' || h === '' || h === '#/pacotes' || h === '#/materiais') renderHome(raiz);
}
onEstadoSync(atualizarHomeSeVisivel);
onEstadoAgenda(atualizarHomeSeVisivel);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
