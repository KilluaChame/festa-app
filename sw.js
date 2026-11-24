// Mude VERSAO ao publicar atualizações para limpar o cache antigo.
const VERSAO = 'festas-v5';
const ARQUIVOS = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/store.js',
  'js/core/calc.js', 'js/core/util.js', 'js/core/storage.js',
  'js/core/merge.js', 'js/views/home.js', 'js/views/form.js',
  'js/views/config.js', 'js/sync/github.js', 'js/sync/agenda.js', 'icon.svg', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Rede primeiro (pega atualização); cache se estiver sem internet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone();
    caches.open(VERSAO).then(c => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request)));
});
