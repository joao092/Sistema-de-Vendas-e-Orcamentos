# Sistema de Vendas e Orçamentos — Ferragens W Guimarães

Projeto Integrador VI (UNISAL — Engenharia da Computação) desenvolvido para a
Ferragens W Guimarães, permitindo o cadastro de clientes e produtos, a
criação e edição de orçamentos com cálculo automático de valores e a consulta
ao histórico de orçamentos realizados.

Arquitetura conforme definida nas Etapas A1 e A2 do projeto:

- **Front-end:** HTML, CSS e JavaScript puro (sem framework), consumindo a API via `fetch`.
- **Back-end:** Node.js + Express.js, expondo uma API REST (`/api/...`).
- **Banco de dados:** PostgreSQL (tabelas `usuarios`, `clientes`, `produtos`, `orcamentos`, `itens_orcamento`, triggers de cálculo automático e views de apoio).
- **Hospedagem:** Render (Web Service + PostgreSQL gerenciado).

## Estrutura do projeto

```
vendas-orcamentos/
├── db/
│   ├── schema.sql        # tabelas, índices, triggers e views
│   └── seed.sql          # dados de exemplo (clientes e produtos)
├── scripts/
│   ├── migrate.js        # aplica o schema.sql no banco
│   └── seed.js           # popula dados de exemplo + usuário admin
├── src/
│   ├── db.js             # pool de conexão PostgreSQL
│   ├── server.js         # servidor Express
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js       # login (JWT)
│       ├── clientes.js   # CRUD de clientes
│       ├── produtos.js   # CRUD de produtos
│       ├── orcamentos.js # criação, edição e histórico de orçamentos
│       └── dashboard.js  # indicadores do painel inicial
├── public/
│   ├── index.html        # tela de login + aplicação (SPA simples)
│   ├── css/styles.css
│   └── js/
│       ├── api.js        # camada de comunicação com a API
│       └── app.js        # navegação e regras da interface
├── package.json
├── render.yaml            # deploy automático via Blueprint do Render
├── .env.example
└── README.md
```

## Funcionalidades

- Autenticação do administrador (login com e-mail/senha, token JWT).
- Cadastro, consulta, edição e exclusão de **clientes**.
- Cadastro, consulta, edição e exclusão de **produtos** (com categoria, unidade e preço).
- Criação de **novos orçamentos**: seleção de cliente, adição de itens (produto + quantidade), cálculo automático do valor de cada item e do valor total.
- **Edição** de orçamentos já criados (cliente, itens, observação e status).
- **Histórico de orçamentos** com filtros por status (em aberto/aprovado/cancelado) e por cliente.
- **Dashboard** com indicadores: orçamentos no mês, valor total orçado, clientes cadastrados, produtos cadastrados e últimos orçamentos.
- Validação de dados obrigatórios tanto no front-end quanto no back-end (bloqueio de orçamentos com informações incompletas, conforme a regra lógica definida na Etapa A1).
- Interface responsiva (desktop, tablet e smartphone).

## Rodando localmente

Pré-requisitos: Node.js 18+ e um PostgreSQL acessível (local ou remoto).

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# edite o .env com a DATABASE_URL do seu PostgreSQL local

# 3. criar as tabelas
npm run db:migrate

# 4. popular dados de exemplo e o usuário administrador
npm run db:seed

# 5. iniciar o servidor
npm start
```

A aplicação ficará disponível em `http://localhost:10000` (ou na porta
definida em `PORT`). Use as credenciais impressas no console pelo `db:seed`
(por padrão `admin@ferragensw.com.br` / `admin123`) para entrar.

## Publicando no Render

### Opção 1 — Deploy automático via Blueprint (`render.yaml`)

1. Suba este projeto para um repositório no GitHub.
2. No painel do Render, clique em **New > Blueprint** e selecione o repositório.
3. O Render lerá o `render.yaml` e criará automaticamente:
   - um banco **PostgreSQL** (`vendas-orcamentos-db`);
   - um **Web Service** Node.js já configurado com `DATABASE_URL`, `JWT_SECRET` (gerado automaticamente) e as demais variáveis.
4. Defina a variável `ADMIN_PASSWORD` quando solicitado (ela está marcada como `sync: false` por segurança).
5. Ao concluir o deploy, o próprio `startCommand` executa `db:migrate` e `db:seed` antes de iniciar o servidor, garantindo que as tabelas e o usuário administrador já existam.

### Opção 2 — Deploy manual

1. Crie um banco **PostgreSQL** no Render e copie a `Internal Database URL`.
2. Crie um **Web Service** apontando para este repositório:
   - Build Command: `npm install`
   - Start Command: `npm run db:migrate && npm run db:seed && npm start`
3. Em **Environment**, adicione as variáveis:
   - `DATABASE_URL` → a URL do banco criado no passo 1
   - `JWT_SECRET` → um valor aleatório e forte
   - `PGSSL` → `true`
   - `ADMIN_EMAIL` e `ADMIN_PASSWORD` → credenciais do usuário administrador inicial
4. Faça o deploy. A aplicação (front-end + API) será servida a partir do mesmo serviço, na porta definida pela variável `PORT` do Render.

## Modelo de dados (resumo)

- **usuarios** `(id_usuario, nome, email, senha, nivel_acesso, data_cadastro)`
- **clientes** `(id_cliente, nome, telefone, email, endereco, data_cadastro)`
- **produtos** `(id_produto, nome, categoria, unidade, preco_unitario, ativo, data_cadastro)`
- **orcamentos** `(id_orcamento, id_cliente, id_usuario, data_orcamento, status, observacao, valor_total, data_criacao)`
- **itens_orcamento** `(id_item, id_orcamento, id_produto, quantidade, valor_unitario, valor_total_item)`

Triggers calculam automaticamente `valor_total_item` e mantêm `orcamentos.valor_total`
sempre sincronizado com a soma dos itens (inclusive quando um item é editado
ou removido).

## Próximos passos sugeridos

- Relatórios adicionais (produtos mais orçados, clientes com maior número de orçamentos) já contam com as views `vw_orcamentos_pendentes` e `vw_produtos_mais_orcados` prontas em `db/schema.sql`.
- Emissão de PDF do orçamento para envio ao cliente.
- Perfis de acesso adicionais (ex: vendedor x administrador) reutilizando o campo `nivel_acesso`.
