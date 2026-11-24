// Tela de configuração — rota #/config
// Salva token GitHub e Client ID do Google APENAS no localStorage do aparelho.
// Nunca grava segredos em arquivo ou URL.
import { getConfig, setConfig } from '../store.js';
import { sincronizar } from '../sync/github.js';
import { reagirMudanca } from '../sync/agenda.js';

export function renderConfig(el) {
  const cfg = getConfig();

  el.innerHTML = `
  <header class="barra">
    <a href="#/" class="voltar">‹ Voltar</a>
    <h1>Configurações</h1>
  </header>
  <div class="form">

    <!-- ── GITHUB ── -->
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
    <button class="prim" id="cfgSalvar" type="button">Salvar configuração GitHub</button>
    <button class="sec" id="cfgSincNow" type="button" style="margin-top:10px">Sincronizar agora</button>

    <div id="cfgStatus" style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem;display:none"></div>

    ${cfg.githubDono ? `
    <div style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem">
      <b>GitHub atual:</b><br>
      Repositório: <code>${cfg.githubDono}/${cfg.githubRepo ?? 'festas-dados'}</code><br>
      Token: <span style="color:var(--ok)">✓ salvo neste aparelho</span>
    </div>` : ''}

    <!-- ── GOOGLE AGENDA ── -->
    <h2 style="margin-top:28px">Google Agenda</h2>
    <p style="color:var(--mut);font-size:.9rem;margin:0 0 8px">
      O Client ID não é segredo e pode ficar no app. Ele identifica o projeto, não você.
    </p>

    <label>Client ID do Google (OAuth 2.0)
      <input id="cfgClientId" autocomplete="off" placeholder="1234567890-abc...apps.googleusercontent.com">
    </label>

    <p class="erro" id="cfgGoogleErro"></p>
    <button class="prim" id="cfgSalvarGoogle" type="button">Salvar e conectar Google</button>

    <div id="cfgGoogleStatus" style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem;display:none"></div>

    ${cfg.googleClientId ? `
    <div style="margin-top:16px;padding:12px;border-radius:12px;background:var(--card);font-size:.9rem">
      <b>Google atual:</b><br>
      Client ID: <span style="color:var(--ok)">✓ configurado</span><br>
      ${cfg.calendarId ? `Agenda "Festas": <span style="color:var(--ok)">✓ criada</span>` : 'Agenda "Festas": será criada ao salvar a primeira festa'}
    </div>` : ''}

    <!-- ── COMO OBTER O TOKEN GITHUB ── -->
    <h2 style="margin-top:28px">Como obter o token GitHub</h2>
    <ol style="color:var(--mut);font-size:.88rem;padding-left:1.3em;line-height:1.9">
      <li>Acesse <b>github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens</b></li>
      <li>Clique em <b>Generate new token</b></li>
      <li>Em <b>Repository access</b>, selecione "Only select repositories" e escolha <b>festas-dados</b></li>
      <li>Em <b>Permissions → Repository permissions → Contents</b>, selecione <b>Read and write</b></li>
      <li>Gere e copie o token — começa com <code>github_pat_</code></li>
      <li>Cole no campo acima e salve</li>
    </ol>

    <!-- ── COMO CRIAR O CLIENT ID GOOGLE ── -->
    <h2>Como criar o Client ID do Google</h2>
    <ol style="color:var(--mut);font-size:.88rem;padding-left:1.3em;line-height:1.9">
      <li>Acesse <b>console.cloud.google.com</b> e crie um projeto (ex: "festas-app")</li>
      <li>Vá em <b>APIs e serviços → Biblioteca</b>, procure "Google Calendar API" e ative</li>
      <li>Vá em <b>APIs e serviços → Tela de consentimento OAuth</b>:
        <ul style="margin-top:4px">
          <li>Tipo: <b>Externo</b> → Criar</li>
          <li>Nome do app: "Minhas Festas", e-mail de suporte: seu e-mail</li>
          <li>Em <b>Usuários de teste</b>, adicione seu próprio e-mail</li>
          <li>Salve e continue até o fim</li>
        </ul>
      </li>
      <li>Vá em <b>APIs e serviços → Credenciais → Criar credencial → ID do cliente OAuth</b>:
        <ul style="margin-top:4px">
          <li>Tipo: <b>Aplicativo da Web</b></li>
          <li>Em <b>Origens JavaScript autorizadas</b>, adicione: <code>https://SEUUSUARIO.github.io</code> e <code>http://127.0.0.1:8787</code> (para teste local)</li>
          <li>Clique em Criar</li>
        </ul>
      </li>
      <li>Copie o <b>ID do cliente</b> e cole no campo acima</li>
    </ol>
    <p style="color:var(--mut);font-size:.85rem">
      ⚠️ Em modo teste o Google pede novo consentimento de tempos em tempos. É esperado.
    </p>

  </div>`;

  const $dono   = el.querySelector('#cfgDono');
  const $repo   = el.querySelector('#cfgRepo');
  const $token  = el.querySelector('#cfgToken');
  const $erro   = el.querySelector('#cfgErro');
  const $status = el.querySelector('#cfgStatus');
  const $clientId     = el.querySelector('#cfgClientId');
  const $googleErro   = el.querySelector('#cfgGoogleErro');
  const $googleStatus = el.querySelector('#cfgGoogleStatus');

  $dono.value     = cfg.githubDono    ?? '';
  $repo.value     = cfg.githubRepo    ?? 'festas-dados';
  $clientId.value = cfg.googleClientId ?? '';

  // ── Salvar GitHub ──
  el.querySelector('#cfgSalvar').onclick = () => {
    const dono  = $dono.value.trim();
    const repo  = $repo.value.trim() || 'festas-dados';
    const token = $token.value.trim();
    if (!dono)  { $erro.textContent = 'Informe o dono do repositório.'; return; }
    if (!token) { $erro.textContent = 'Informe o token de acesso.'; return; }
    $erro.textContent = '';
    setConfig({ githubDono: dono, githubRepo: repo });
    localStorage.setItem('festas.token', token);
    mostrarStatus($status, 'info', '✓ Configuração salva. Sincronizando...');
    sincronizar().then(ok => {
      if (ok) mostrarStatus($status, 'ok', '✓ Sincronizado com sucesso!');
      else    mostrarStatus($status, 'erro', '✗ Falha ao sincronizar. Verifique o token e o repositório.');
    });
  };

  el.querySelector('#cfgSincNow').onclick = () => {
    mostrarStatus($status, 'info', 'Sincronizando...');
    sincronizar().then(ok => {
      if (ok) mostrarStatus($status, 'ok', '✓ Sincronizado!');
      else    mostrarStatus($status, 'erro', '✗ Falha. Verifique a conexão e o token.');
    });
  };

  // ── Salvar Google ──
  el.querySelector('#cfgSalvarGoogle').onclick = () => {
    const id = $clientId.value.trim();
    if (!id) { $googleErro.textContent = 'Informe o Client ID.'; return; }
    if (!id.includes('.apps.googleusercontent.com')) {
      $googleErro.textContent = 'Client ID inválido. Deve terminar em .apps.googleusercontent.com';
      return;
    }
    $googleErro.textContent = '';
    setConfig({ googleClientId: id });
    mostrarStatus($googleStatus, 'ok', '✓ Client ID salvo. Ele será usado ao salvar a próxima festa.');
  };
}

function mostrarStatus(el, tipo, msg) {
  el.style.display = 'block';
  const cores  = { ok: 'var(--okbg)', erro: 'var(--abbg)', info: 'var(--card)' };
  const textos = { ok: 'var(--ok)',   erro: 'var(--ab)',   info: 'var(--ink)'  };
  el.style.background = cores[tipo]  ?? cores.info;
  el.style.color      = textos[tipo] ?? textos.info;
  el.textContent = msg;
}
