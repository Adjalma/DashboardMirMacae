# Como fazer o deploy na Vercel (sem ser programador)

## 1. Criar conta na Vercel

1. Acesse **[vercel.com](https://vercel.com)** e clique em **Sign Up**
2. Use sua conta Google, GitHub ou e-mail

---

## 2. Conectar o projeto

### Opção A: Se o projeto está no GitHub

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Clique em **Import Git Repository**
3. Escolha o repositório **celulas_dashboard** (ou faça upload da pasta)
4. A Vercel detecta automaticamente as configurações (`vercel.json`)
5. Clique em **Deploy**

### Opção B: Deploy pela pasta (sem GitHub)

1. Instale o Vercel CLI:  
   Baixe em [vercel.com/cli](https://vercel.com/cli) ou use: `npm i -g vercel`
2. Abra o terminal na pasta do projeto:  
   `cd "c:\Users\XBZF\Projetos Triarc\celulas_dashboard"`
3. Execute: `vercel`
4. Siga as perguntas (login, nome do projeto)
5. Quando terminar, será gerado um link como: `https://celulas-dashboard-xxx.vercel.app`

---

## 3. Compartilhar com outras pessoas

Depois do deploy, você recebe um link público, por exemplo:

- `https://seu-dashboard.vercel.app`

Envie esse link por e-mail ou WhatsApp. Qualquer pessoa pode abrir no navegador, sem instalar nada.

---

## 4. Atualizar os dados

Para atualizar o `dashboard_data.json`:

1. Edite o arquivo `client/public/dashboard_data.json`
2. Se usar GitHub: faça commit e push – a Vercel atualiza sozinha
3. Se não usar GitHub: execute `vercel --prod` de novo na pasta do projeto

---

## Resumo rápido

| Etapa | O que fazer |
|-------|-------------|
| Deploy | Arraste a pasta no [vercel.com/new](https://vercel.com/new) ou conecte o GitHub |
| Compartilhar | Envie o link (ex: `https://xxx.vercel.app`) |
| Atualizar dados | Edite `client/public/dashboard_data.json` e refaça o deploy |
