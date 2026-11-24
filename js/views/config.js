// Tela de configuração — rota #/config
// Salva token e dados do repositório APENAS no localStorage do aparelho.
// Nunca grava segredos em arquivo ou URL.
import { getConfig, setConfig } from '../store.js';
import { sincronizar, estadoSync } from '../sync/github.js';

export function renderConfig(el) {
  const cfg = getConfig();

  el.innerHTML = `
  <header class="barra">
    <a href="#/" class="voltar">‹ Voltar</a>
    <h1>Configurações</h1>
  </header>
  <div class="form">
    <h2>Sincronização com GitHub</h2>
    <p style="color:var(--mut);font-size:.9rem;margin:0 0 8px">
      O token fica <b>somente neste aparelho</b> (localStorage). Nunca vai para nenhum arquivo ou repositório.
    </p>

    <label>Dono do repositório (seu usuário GitHub)
      <input id="cfgDono" autocomplete="off" placeholder="ex: KilluaChame">
    </label>
    <label>Nome do repositório privado
      <input id="cfgRepo" autocomplete="off" placeholder="festas-dados">
    </label>
    <label>Token de acesso (fine-grained, Contents: leitura e escrita)
      <input id="cfgToken" type="password" autocomplete="off" placeholder="github_pat_...">
    </label>

    <p class="erro" id="cfgErro"></p>
    <button class="prim" id="cfgSalvar" type="button">Salvar configuração</button>
    <button class="sec" id="cfgSincNow" type="button" style="margin-top:10px">Sincronizar agora</button>

    <div id="cfgStatus" style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem;display:none"></div>

    ${cfg.githubDono ? `
    <div style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem">
      <b>Configuração atual:</b><br>
      Repositório: <code>${cfg.githubDono}/${cfg.githubRepo ?? 'festas-dados'}</code><br>
      Token: <span style="color:var(--ok)">✓ salvo neste aparelho</span>
    </div>` : ''}

    <h2 style="margin-top:28px">Como obter o token</h2>
    <ol style="color:var(--mut);font-size:.88rem;padding-left:1.3em;line-height:1.8">
      <li>Acesse <b>github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens</b></li>
      <li>Clique em <b>Generate new token</b></li>
      <li>Em <b>Repository access</b>, selecione "Only select repositories" e escolha <b>festas-dados</b></li>
      <li>Em <b>Permissions → Repository permissions → Contents</b>, selecione <b>Read and write</b></li>
      <li>Gere e copie o token — começa com <code>github_pat_</code></li>
      <li>Cole no campo acima e salve</li>
    </ol>
  </div>`;

  const $dono  = el.querySelector('#cfgDono');
  const $repo  = el.querySelector('#cfgRepo');
  const $token = el.querySelector('#cfgToken');
  const $erro  = el.querySelector('#cfgErro');
  const $status = el.querySelector('#cfgStatus');

  // Pré-preenche campos (token não é exibido por segurança)
  $dono.value  = cfg.githubDono  ?? '';
  $repo.value  = cfg.githubRepo  ?? 'festas-dados';

  el.querySelector('#cfgSalvar').onclick = () => {
    const dono  = $dono.value.trim();
    const repo  = $repo.value.trim() || 'festas-dados';
    const token = $token.value.trim();
    if (!dono)  { $erro.textContent = 'Informe o dono do repositório.'; return; }
    if (!token) { $erro.textContent = 'Informe o token de acesso.'; return; }
    $erro.textContent = '';
    setConfig({ githubDono: dono, githubRepo: repo });
    // Token fica separado — nunca entra no dados.json que vai pro GitHub
    localStorage.setItem('festas.token', token);
    mostrarStatus('info', '✓ Configuração salva. Sincronizando...');
    sincronizar().then(ok => {
      if (ok) mostrarStatus('ok', '✓ Sincronizado com sucesso!');
      else    mostrarStatus('erro', '✗ Falha ao sincronizar. Verifique o token e o nome do repositório.');
    });
  };

  el.querySelector('#cfgSincNow').onclick = () => {
    mostrarStatus('info', 'Sincronizando...');
    sincronizar().then(ok => {
      if (ok) mostrarStatus('ok', '✓ Sincronizado com sucesso!');
      else    mostrarStatus('erro', '✗ Falha. Verifique a conexão e o token.');
    });
  };

  function mostrarStatus(tipo, msg) {
    $status.style.display = 'block';
    const cores = { ok: 'var(--okbg)', erro: 'var(--abbg)', info: 'var(--card)' };
    const textos = { ok: 'var(--ok)', erro: 'var(--ab)', info: 'var(--ink)' };
    $status.style.background = cores[tipo] ?? cores.info;
    $status.style.color = textos[tipo] ?? textos.info;
    $status.textContent = msg;
  }
}
