// =========================================================
// Sistema de Vendas e Orçamentos - Ferragens W Guimarães
// Lógica do frontend: navegação, autenticação e integração
// com a API REST (clientes, produtos, orçamentos, dashboard).
// =========================================================

const STATUS_LABEL = {
  PENDENTE: 'Em aberto',
  APROVADO: 'Aprovado',
  CANCELADO: 'Cancelado',
};
const STATUS_BADGE = {
  PENDENTE: 'badge-pendente',
  APROVADO: 'badge-aprovado',
  CANCELADO: 'badge-cancelado',
};

let cacheClientes = [];
let cacheProdutos = [];
let itensOrcamentoAtual = [];
let idOrcamentoEmEdicao = null;

// ---------------------------------------------------------
// Utilitários
// ---------------------------------------------------------
function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2).replace('.', ',');
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d.getTime())) return data;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function mostrarToast(msg, ehErro) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('erro', !!ehErro);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function marcarErro(campoId, comErro) {
  const el = document.getElementById(campoId);
  if (el) el.classList.toggle('has-error', comErro);
}

async function chamarApi(fn, msgErroPadrao) {
  try {
    return await fn();
  } catch (err) {
    mostrarToast(err.message || msgErroPadrao, true);
    throw err;
  }
}

// ---------------------------------------------------------
// Autenticação
// ---------------------------------------------------------
function mostrarApp() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').classList.add('ativo');
  const usuario = getUsuarioLogado();
  document.getElementById('usuario-logado').textContent = usuario ? usuario.email : '';
  carregarDashboard();
}

function mostrarLogin() {
  document.getElementById('app').classList.remove('ativo');
  document.getElementById('tela-login').style.display = 'flex';
}

async function tentarLogin(ev) {
  ev.preventDefault();
  const email = document.getElementById('input-email').value.trim();
  const senha = document.getElementById('input-senha').value.trim();

  marcarErro('campo-email', !email);
  marcarErro('campo-senha', !senha);
  if (!email || !senha) return;

  const btn = document.getElementById('btn-entrar');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const resultado = await api.login(email, senha);
    setSessao(resultado.token, resultado.usuario);
    document.getElementById('input-email').value = '';
    document.getElementById('input-senha').value = '';
    mostrarApp();
  } catch (err) {
    mostrarToast(err.message || 'Não foi possível entrar.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function sair() {
  limparSessao();
  mostrarLogin();
}

// ---------------------------------------------------------
// Navegação entre telas
// ---------------------------------------------------------
function irPara(tela) {
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.tela === tela);
  });
  document.querySelectorAll('.main .content > section').forEach((s) => {
    s.style.display = 'none';
  });
  document.getElementById('pg-' + tela).style.display = 'block';
  document.getElementById('sidebar').classList.remove('aberta');

  if (tela === 'dashboard') carregarDashboard();
  if (tela === 'clientes') carregarClientes();
  if (tela === 'produtos') carregarProdutos();
  if (tela === 'orcamento') prepararTelaOrcamento();
  if (tela === 'historico') carregarHistorico();
}

// ---------------------------------------------------------
// Configurações (troca de senha)
// ---------------------------------------------------------
async function salvarNovaSenha(ev) {
  ev.preventDefault();
  const senhaAtual = document.getElementById('senha-atual').value.trim();
  const senhaNova = document.getElementById('senha-nova').value.trim();

  marcarErro('senha-atual-campo', !senhaAtual);
  marcarErro('senha-nova-campo', senhaNova.length < 6);
  if (!senhaAtual || senhaNova.length < 6) return;

  const btn = document.getElementById('btn-salvar-senha');
  btn.disabled = true;
  try {
    await chamarApi(() => api.alterarSenha(senhaAtual, senhaNova), 'Erro ao alterar a senha.');
    mostrarToast('Senha alterada com sucesso.');
    document.getElementById('form-senha').reset();
  } catch (err) {
    // erro já mostrado pelo chamarApi
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------
// Dashboard
// ---------------------------------------------------------
async function carregarDashboard() {
  try {
    const dados = await api.dashboard();
    document.getElementById('kpi-orcamentos-mes').textContent = dados.orcamentos_no_mes;
    document.getElementById('kpi-valor-total').textContent = `R$ ${formatarMoeda(dados.valor_total_orcado)}`;
    document.getElementById('kpi-clientes').textContent = dados.clientes_cadastrados;
    document.getElementById('kpi-produtos').textContent = dados.produtos_cadastrados;

    const tbody = document.getElementById('dashboard-ultimos-orcamentos');
    if (dados.ultimos_orcamentos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum orçamento registrado ainda.</td></tr>';
      return;
    }
    tbody.innerHTML = dados.ultimos_orcamentos.map((o) => `
      <tr>
        <td>${String(o.id_orcamento).padStart(4, '0')}</td>
        <td>${o.cliente_nome}</td>
        <td>${formatarData(o.data_orcamento)}</td>
        <td class="num">R$ ${formatarMoeda(o.valor_total)}</td>
        <td><span class="badge ${STATUS_BADGE[o.status]}">${STATUS_LABEL[o.status]}</span></td>
      </tr>`).join('');
  } catch (err) {
    mostrarToast('Não foi possível carregar o dashboard.', true);
  }
}

// ---------------------------------------------------------
// Clientes
// ---------------------------------------------------------
async function carregarClientes() {
  const tbody = document.getElementById('lista-clientes');
  try {
    cacheClientes = await api.listarClientes();
    if (cacheClientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum cliente cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = cacheClientes.map((c) => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.telefone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td class="row-actions">
          <a onclick="editarCliente(${c.id_cliente})">Editar</a>
          <a class="del" onclick="excluirCliente(${c.id_cliente})">Excluir</a>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Erro ao carregar clientes.</td></tr>';
  }
}

function editarCliente(id) {
  const cliente = cacheClientes.find((c) => c.id_cliente === id);
  if (!cliente) return;
  document.getElementById('cli-id').value = cliente.id_cliente;
  document.getElementById('cli-nome').value = cliente.nome;
  document.getElementById('cli-telefone').value = cliente.telefone || '';
  document.getElementById('cli-email').value = cliente.email || '';
  document.getElementById('cli-endereco').value = cliente.endereco || '';
  document.getElementById('titulo-form-cliente').textContent = 'Editar cliente';
  document.getElementById('btn-salvar-cliente').textContent = 'Salvar Alterações';
  document.getElementById('btn-cancelar-cliente').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicaoCliente() {
  document.getElementById('form-cliente').reset();
  document.getElementById('cli-id').value = '';
  document.getElementById('titulo-form-cliente').textContent = 'Cadastrar cliente';
  document.getElementById('btn-salvar-cliente').textContent = 'Cadastrar Cliente';
  document.getElementById('btn-cancelar-cliente').style.display = 'none';
  marcarErro('cli-nome-campo', false);
}

async function salvarCliente(ev) {
  ev.preventDefault();
  const id = document.getElementById('cli-id').value;
  const nome = document.getElementById('cli-nome').value.trim();
  const dados = {
    nome,
    telefone: document.getElementById('cli-telefone').value.trim(),
    email: document.getElementById('cli-email').value.trim(),
    endereco: document.getElementById('cli-endereco').value.trim(),
  };

  marcarErro('cli-nome-campo', !nome);
  if (!nome) return;

  try {
    if (id) {
      await chamarApi(() => api.atualizarCliente(id, dados), 'Erro ao atualizar cliente.');
      mostrarToast('Cliente atualizado com sucesso.');
    } else {
      await chamarApi(() => api.criarCliente(dados), 'Erro ao cadastrar cliente.');
      mostrarToast('Cliente cadastrado com sucesso.');
    }
    cancelarEdicaoCliente();
    carregarClientes();
  } catch (err) {
    /* toast já exibido em chamarApi */
  }
}

async function excluirCliente(id) {
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  try {
    await chamarApi(() => api.excluirCliente(id), 'Erro ao excluir cliente.');
    mostrarToast('Cliente excluído com sucesso.');
    carregarClientes();
  } catch (err) {
    /* toast já exibido */
  }
}

// ---------------------------------------------------------
// Produtos
// ---------------------------------------------------------
async function carregarProdutos() {
  const tbody = document.getElementById('lista-produtos');
  try {
    cacheProdutos = await api.listarProdutos();
    if (cacheProdutos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum produto cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = cacheProdutos.map((p) => `
      <tr>
        <td>${p.nome}</td>
        <td>${p.categoria || '—'}</td>
        <td>${p.unidade}</td>
        <td class="num">R$ ${formatarMoeda(p.preco_unitario)}</td>
        <td class="row-actions">
          <a onclick="editarProduto(${p.id_produto})">Editar</a>
          <a class="del" onclick="excluirProduto(${p.id_produto})">Excluir</a>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Erro ao carregar produtos.</td></tr>';
  }
}

function editarProduto(id) {
  const produto = cacheProdutos.find((p) => p.id_produto === id);
  if (!produto) return;
  document.getElementById('prod-id').value = produto.id_produto;
  document.getElementById('prod-nome').value = produto.nome;
  document.getElementById('prod-categoria').value = produto.categoria || 'Ferragens';
  document.getElementById('prod-unidade').value = produto.unidade || 'UN';
  document.getElementById('prod-preco').value = produto.preco_unitario;
  document.getElementById('titulo-form-produto').textContent = 'Editar produto';
  document.getElementById('btn-salvar-produto').textContent = 'Salvar Alterações';
  document.getElementById('btn-cancelar-produto').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicaoProduto() {
  document.getElementById('form-produto').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('titulo-form-produto').textContent = 'Cadastrar produto';
  document.getElementById('btn-salvar-produto').textContent = 'Cadastrar Produto';
  document.getElementById('btn-cancelar-produto').style.display = 'none';
  marcarErro('prod-nome-campo', false);
  marcarErro('prod-preco-campo', false);
}

async function salvarProduto(ev) {
  ev.preventDefault();
  const id = document.getElementById('prod-id').value;
  const nome = document.getElementById('prod-nome').value.trim();
  const preco = document.getElementById('prod-preco').value;

  marcarErro('prod-nome-campo', !nome);
  marcarErro('prod-preco-campo', !preco || Number(preco) <= 0);
  if (!nome || !preco || Number(preco) <= 0) return;

  const dados = {
    nome,
    categoria: document.getElementById('prod-categoria').value,
    unidade: document.getElementById('prod-unidade').value,
    preco_unitario: Number(preco),
  };

  try {
    if (id) {
      await chamarApi(() => api.atualizarProduto(id, dados), 'Erro ao atualizar produto.');
      mostrarToast('Produto atualizado com sucesso.');
    } else {
      await chamarApi(() => api.criarProduto(dados), 'Erro ao cadastrar produto.');
      mostrarToast('Produto cadastrado com sucesso.');
    }
    cancelarEdicaoProduto();
    carregarProdutos();
  } catch (err) {
    /* toast já exibido */
  }
}

async function excluirProduto(id) {
  if (!confirm('Deseja realmente excluir este produto?')) return;
  try {
    await chamarApi(() => api.excluirProduto(id), 'Erro ao excluir produto.');
    mostrarToast('Produto excluído com sucesso.');
    carregarProdutos();
  } catch (err) {
    /* toast já exibido */
  }
}

// ---------------------------------------------------------
// Novo Orçamento / Edição de Orçamento
// ---------------------------------------------------------
async function prepararTelaOrcamento(orcamentoParaEditar) {
  idOrcamentoEmEdicao = orcamentoParaEditar ? orcamentoParaEditar.id_orcamento : null;
  itensOrcamentoAtual = [];

  document.getElementById('titulo-orcamento').textContent = idOrcamentoEmEdicao
    ? `Editar Orçamento Nº ${String(idOrcamentoEmEdicao).padStart(4, '0')}`
    : 'Novo Orçamento';
  document.getElementById('btn-salvar-orcamento').textContent = idOrcamentoEmEdicao
    ? 'Salvar Alterações'
    : 'Salvar Orçamento';

  try {
    if (cacheClientes.length === 0) cacheClientes = await api.listarClientes();
    if (cacheProdutos.length === 0) cacheProdutos = await api.listarProdutos();
  } catch (err) {
    mostrarToast('Erro ao carregar clientes/produtos.', true);
  }

  const selCliente = document.getElementById('orc-cliente');
  selCliente.innerHTML = '<option value="">Selecione o cliente</option>' +
    cacheClientes.map((c) => `<option value="${c.id_cliente}">${c.nome}</option>`).join('');

  const selProduto = document.getElementById('orc-produto');
  selProduto.innerHTML = '<option value="">Selecione o produto</option>' +
    cacheProdutos.map((p) => `<option value="${p.id_produto}" data-preco="${p.preco_unitario}">${p.nome} — R$ ${formatarMoeda(p.preco_unitario)}</option>`).join('');

  document.getElementById('orc-observacao').value = '';
  marcarErro('orc-cliente-campo', false);

  if (orcamentoParaEditar) {
    selCliente.value = orcamentoParaEditar.id_cliente;
    document.getElementById('orc-observacao').value = orcamentoParaEditar.observacao || '';
    itensOrcamentoAtual = orcamentoParaEditar.itens.map((it) => ({
      id_produto: it.id_produto,
      nomeProduto: it.produto_nome,
      qtd: Number(it.quantidade),
      preco: Number(it.valor_unitario),
      subtotal: Number(it.valor_total_item),
    }));
  } else {
    selCliente.value = '';
  }

  renderizarItensOrcamento();
}

function adicionarItemOrcamento() {
  const sel = document.getElementById('orc-produto');
  const qtdEl = document.getElementById('orc-qtd');
  const qtd = Number(qtdEl.value);

  if (!sel.value || !qtd || qtd <= 0) {
    mostrarToast('Selecione um produto e informe a quantidade.', true);
    return;
  }

  const preco = Number(sel.selectedOptions[0].dataset.preco);
  const nomeProduto = sel.selectedOptions[0].text.split(' — ')[0];
  const subtotal = preco * qtd;

  itensOrcamentoAtual.push({ id_produto: Number(sel.value), nomeProduto, qtd, preco, subtotal });
  renderizarItensOrcamento();
  sel.value = '';
  qtdEl.value = '';
}

function removerItemOrcamento(idx) {
  itensOrcamentoAtual.splice(idx, 1);
  renderizarItensOrcamento();
}

function renderizarItensOrcamento() {
  const tbody = document.getElementById('itens-orcamento');
  if (itensOrcamentoAtual.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item adicionado.</td></tr>';
  } else {
    tbody.innerHTML = itensOrcamentoAtual.map((it, i) => `
      <tr>
        <td>${it.nomeProduto}</td>
        <td>${it.qtd}</td>
        <td class="num">R$ ${formatarMoeda(it.preco)}</td>
        <td class="num">R$ ${formatarMoeda(it.subtotal)}</td>
        <td class="row-actions"><a class="del" onclick="removerItemOrcamento(${i})">Remover</a></td>
      </tr>`).join('');
  }
  const total = itensOrcamentoAtual.reduce((s, it) => s + it.subtotal, 0);
  document.getElementById('orc-total').textContent = formatarMoeda(total);
}

async function salvarOrcamento() {
  const idCliente = document.getElementById('orc-cliente').value;
  const clienteOk = idCliente !== '';
  marcarErro('orc-cliente-campo', !clienteOk);
  if (!clienteOk) { mostrarToast('Selecione o cliente antes de salvar.', true); return; }
  if (itensOrcamentoAtual.length === 0) { mostrarToast('Adicione pelo menos um item ao orçamento.', true); return; }

  const payload = {
    id_cliente: Number(idCliente),
    observacao: document.getElementById('orc-observacao').value.trim(),
    itens: itensOrcamentoAtual.map((it) => ({ id_produto: it.id_produto, quantidade: it.qtd })),
  };

  try {
    if (idOrcamentoEmEdicao) {
      await chamarApi(() => api.atualizarOrcamento(idOrcamentoEmEdicao, payload), 'Erro ao atualizar orçamento.');
      mostrarToast('Orçamento atualizado com sucesso!');
    } else {
      await chamarApi(() => api.criarOrcamento(payload), 'Erro ao salvar orçamento.');
      mostrarToast('Orçamento salvo com sucesso!');
    }
    irPara('historico');
  } catch (err) {
    /* toast já exibido */
  }
}

function cancelarOrcamento() {
  irPara(idOrcamentoEmEdicao ? 'historico' : 'dashboard');
}

// ---------------------------------------------------------
// Histórico de Orçamentos
// ---------------------------------------------------------
async function carregarHistorico() {
  const tbody = document.getElementById('lista-historico');
  const status = document.getElementById('filtro-status').value;
  const cliente = document.getElementById('filtro-cliente').value.trim();

  try {
    const orcamentos = await api.listarOrcamentos({ status, cliente });
    if (orcamentos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum orçamento encontrado.</td></tr>';
      return;
    }
    tbody.innerHTML = orcamentos.map((o) => `
      <tr>
        <td>${String(o.id_orcamento).padStart(4, '0')}</td>
        <td>${o.cliente_nome}</td>
        <td>${formatarData(o.data_orcamento)}</td>
        <td class="num">R$ ${formatarMoeda(o.valor_total)}</td>
        <td><span class="badge ${STATUS_BADGE[o.status]}">${STATUS_LABEL[o.status]}</span></td>
        <td class="row-actions">
          <a onclick="verOrcamento(${o.id_orcamento})">Ver</a>
          <a onclick="abrirEdicaoOrcamento(${o.id_orcamento})">Editar</a>
          <a class="del" onclick="excluirOrcamento(${o.id_orcamento})">Excluir</a>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar histórico.</td></tr>';
  }
}

async function excluirOrcamento(id) {
  if (!confirm('Deseja realmente excluir este orçamento? Essa ação não pode ser desfeita.')) return;
  try {
    await chamarApi(() => api.excluirOrcamento(id), 'Erro ao excluir orçamento.');
    mostrarToast('Orçamento excluído com sucesso.');
    carregarHistorico();
  } catch (err) {
    // erro já mostrado pelo chamarApi
  }
}

async function verOrcamento(id) {
  try {
    const o = await chamarApi(() => api.obterOrcamento(id), 'Erro ao consultar orçamento.');
    const itensTexto = o.itens
      .map((it) => `• ${it.produto_nome} — ${it.quantidade} x R$ ${formatarMoeda(it.valor_unitario)} = R$ ${formatarMoeda(it.valor_total_item)}`)
      .join('\n');
    alert(
      `Orçamento Nº ${String(o.id_orcamento).padStart(4, '0')}\n` +
      `Cliente: ${o.cliente_nome}\n` +
      `Data: ${formatarData(o.data_orcamento)}\n` +
      `Status: ${STATUS_LABEL[o.status]}\n\n` +
      `Itens:\n${itensTexto}\n\n` +
      `Total: R$ ${formatarMoeda(o.valor_total)}`
    );
  } catch (err) {
    /* toast já exibido */
  }
}

async function abrirEdicaoOrcamento(id) {
  try {
    const o = await chamarApi(() => api.obterOrcamento(id), 'Erro ao carregar orçamento para edição.');
    irParaSemRecarregarOrcamento();
    await prepararTelaOrcamento(o);
  } catch (err) {
    /* toast já exibido */
  }
}

function irParaSemRecarregarOrcamento() {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tela === 'orcamento'));
  document.querySelectorAll('.main .content > section').forEach((s) => { s.style.display = 'none'; });
  document.getElementById('pg-orcamento').style.display = 'block';
  document.getElementById('sidebar').classList.remove('aberta');
}

// ---------------------------------------------------------
// Inicialização e listeners
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-login').addEventListener('submit', tentarLogin);
  document.getElementById('btn-sair').addEventListener('click', sair);

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => irPara(item.dataset.tela));
  });

  document.getElementById('btn-hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('aberta');
  });

  document.getElementById('form-cliente').addEventListener('submit', salvarCliente);
  document.getElementById('btn-cancelar-cliente').addEventListener('click', cancelarEdicaoCliente);

  document.getElementById('form-produto').addEventListener('submit', salvarProduto);
  document.getElementById('btn-cancelar-produto').addEventListener('click', cancelarEdicaoProduto);

  document.getElementById('form-senha').addEventListener('submit', salvarNovaSenha);

  document.getElementById('btn-add-item').addEventListener('click', adicionarItemOrcamento);
  document.getElementById('btn-salvar-orcamento').addEventListener('click', salvarOrcamento);
  document.getElementById('btn-cancelar-orcamento').addEventListener('click', cancelarOrcamento);

  document.getElementById('filtro-status').addEventListener('change', carregarHistorico);
  document.getElementById('filtro-cliente').addEventListener('input', () => {
    clearTimeout(window._filtroClienteTimeout);
    window._filtroClienteTimeout = setTimeout(carregarHistorico, 350);
  });

  const token = getToken();
  if (token) {
    mostrarApp();
  } else {
    mostrarLogin();
  }
});
