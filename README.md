# Minhas Festas 🎉

Aplicativo web pessoal (PWA) para organizar **agenda e financeiro de serviços de festa** (animação, recreação e eventos). Funciona no celular e no computador, **offline**, sem servidor próprio e sem custo.

---

## ✨ Funcionalidades

- **Cadastro e edição de festas:** cliente, aniversariante, data, horário de início/término, endereço, itens do pacote, valor já recebido e observações.
- **Controle financeiro automático:** calcula em tempo real o total, o valor a receber e a situação (*Pago*, *Parcial* ou *Em aberto*).
- **Pacotes pré-prontos:** aba dedicada (**Pacotes**) para criar pacotes reutilizáveis e aplicá-los com 1 toque ao cadastrar uma festa (podendo ainda editar ou adicionar itens extras).
- **Gerenciamento de materiais:** aba dedicada (**Materiais**) para organizar conjuntos completos por categoria e **número** (ex.: *Animação 1*, *Recreação 1*), com suporte a **itens soltos**, **bolsas** e **caixas/maletas internas** (ex.: *Bolsa de animação preta → Caixa de Fios, Caixa do Microfone, Maleta de make*), duplicação de conjuntos e alertas detalhados por caminho nos cards. Cada bolsa, caixa e item tem seu status por **cor**:
  - 🟢 **Verde:** tenho.
  - 🟡 **Amarelo:** precisa de reparo ou observação.
  - 🔴 **Vermelho:** não tenho o material.
  - 🔵 **Azul:** peguei emprestado com alguém *(com nome da pessoa)*.
  Inclui busca ao vivo, filtros por cor/pendência e carregamento opcional de listas iniciais.
- **Resumo mensal com cores:** contador **Feito no mês** na tela inicial e tela **Faturamento por mês** (`#/mensal`):
  - 🟢 **Verde:** todas as festas do mês já foram recebidas.
  - 🟡 **Amarelo:** parte recebida, ainda falta receber de alguma festa do mês.
  - 🔴 **Vermelho:** nada recebido no mês ainda.
- **Sincronização entre aparelhos (opcional):** salva suas festas, pacotes e bolsas de materiais em um repositório **privado** separado no GitHub, com mesclagem automática por última edição.
- **Integração com Google Agenda (opcional):** cria uma agenda própria chamada **"Festas"** (sem misturar com sua agenda pessoal), cria/atualiza/remove eventos automaticamente ao salvar ou excluir festas — com pacote, valores (total, recebido e a receber) e lembrete de **1 dia antes**.
- **Tema claro e escuro automático** conforme o sistema.

---

## 🔒 Segurança e Privacidade

O projeto foi desenhado para funcionar com o código público (ex.: GitHub Pages) sem expor nenhum dado pessoal:

- **Código e dados separados:** este repositório guarda apenas HTML, CSS e JavaScript. Seus dados ficam no `localStorage` do aparelho e, se você ativar a sincronização, em um **segundo repositório privado** seu.
- **Tokens nunca vão para o repositório:** o token de acesso do GitHub fica salvo **apenas no `localStorage`** de cada aparelho configurado.

---

## 🚀 Como usar a sua própria cópia

### 1. Publicar o app (gratuito com GitHub Pages)
1. Faça um **Fork** deste repositório (ou envie estes arquivos para um repositório seu no GitHub).
2. No seu repositório, vá em **Settings → Pages**.
3. Em **Branch**, selecione `main` (pasta `/ (root)`) e clique em **Save**.
4. Em poucos instantes o app estará acessível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
5. No celular, você pode abrir esse link e escolher **"Adicionar à tela inicial"** / **"Instalar aplicativo"** para usar como app nativo.

---

### 2. Configurar a sincronização entre aparelhos (opcional, gratuito)
Se quiser usar no celular e no PC mantendo tudo sincronizado:

1. Crie um **novo repositório privado** no GitHub chamado `festas-dados` (pode deixar vazio).
2. Crie um **Fine-grained personal access token**:
   - Acesse **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Em **Repository access**, selecione **Only select repositories** e escolha apenas `festas-dados`.
   - Em **Repository permissions → Contents**, marque **Read and write**.
   - Gere e copie o token (começa com `github_pat_`).
3. Abra o app → toque em **⚙ Config** → preencha seu usuário, `festas-dados` e o token → clique em **Salvar configuração GitHub**.
   > Repita esse passo em cada aparelho (PC/celular) onde for usar o app.

---

### 3. Configurar o Google Agenda (opcional, gratuito)
A Google Calendar API é gratuita para uso pessoal e não exige cartão de crédito.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um projeto (ex.: `festas-app`).
2. Vá em **APIs e serviços → Biblioteca**, pesquise **Google Calendar API** e clique em **Ativar**.
3. No menu **Google Auth Platform** (ou *Tela de consentimento OAuth*):
   - Em **Público-alvo**, escolha tipo **Externo** e mantenha o status em **Testando** (não precisa publicar).
   - Em **Usuários de teste**, clique em **+ Add users** e adicione o seu e-mail do Google.
4. Em **Clientes → Criar cliente** (ou *Credenciais → ID do cliente OAuth*):
   - **Tipo de aplicativo:** `Aplicativo da Web`
   - **Origens JavaScript autorizadas:** adicione `https://SEU-USUARIO.github.io` *(e `http://127.0.0.1:8787` se for testar localmente)*.
   - Clique em **Criar** e copie o **ID do cliente** (`...apps.googleusercontent.com`).
5. No app → **⚙ Config** → cole o **Client ID** na seção **Google Agenda** → toque em **Salvar e conectar Google**.

> **Nota:** em modo *Testando*, o Google pede confirmação periódica da sessão; basta reconectar pela tela de configurações quando necessário.

---

## 💻 Rodar localmente e testes

O app usa ES Modules e Service Worker, então precisa ser servido via HTTP (não funciona abrindo o `index.html` diretamente como `file://`):

```bash
# Subir servidor local simples com Python
python -m http.server 8787 --bind 127.0.0.1
```

Depois acesse `http://127.0.0.1:8787` no navegador.

Para rodar os testes unitários da lógica de mesclagem (requer Node.js):

```bash
node js/core/merge.test.js
```

---

## 📁 Estrutura do projeto

```
├── index.html             # Shell HTML e carregamento do Google Identity Services
├── manifest.json          # Metadados do PWA
├── sw.js                  # Service Worker (cache offline)
├── icon.svg               # Ícone do app
├── css/
│   └── style.css          # Estilos (tema claro/escuro automático)
└── js/
    ├── app.js             # Roteamento e conexão com sincronizações via onChange
    ├── store.js           # Estado em memória e persistência local
    ├── core/
    │   ├── calc.js        # Regras financeiras e resumo mensal (funções puras)
    │   ├── merge.js       # Resolução de conflitos entre aparelhos (função pura)
    │   ├── merge.test.js  # Testes unitários do merge
    │   ├── storage.js     # Leitura/gravação no localStorage e migração v1→v2
    │   └── util.js        # Formatação de moeda, datas, escape HTML e IDs
    ├── sync/
    │   ├── github.js      # Sincronização via GitHub REST API (Contents)
    │   └── agenda.js      # Integração com Google Calendar API v3
    └── views/
        ├── home.js        # Tela inicial (resumo, abas Próximas/Passadas/Pacotes/Materiais)
        ├── form.js        # Cadastro/edição de festas e seletor de pacotes
        ├── pacotes.js     # Gerenciamento de pacotes pré-prontos
        ├── materiais.js   # Gerenciamento hierárquico de conjuntos, bolsas, caixas e itens
        ├── mensal.js      # Faturamento detalhado por mês
        └── config.js      # Configurações do GitHub e Google Agenda
```

---

## 🛠️ Tecnologias

- HTML5, CSS3 e JavaScript puro (ES Modules) — **sem build, sem framework, sem dependências npm**.
- **GitHub REST API** para sincronização em repositório privado.
- **Google Identity Services + Google Calendar API v3** para agenda automática.
