// Camada de comunicação com o back-end (API REST em /api).
// Centraliza o envio do token JWT e o tratamento de erros HTTP.

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('vo_token');
}

function setSessao(token, usuario) {
  localStorage.setItem('vo_token', token);
  localStorage.setItem('vo_usuario', JSON.stringify(usuario));
}

function limparSessao() {
  localStorage.removeItem('vo_token');
  localStorage.removeItem('vo_usuario');
}

function getUsuarioLogado() {
  const raw = localStorage.getItem('vo_usuario');
  return raw ? JSON.parse(raw) : null;
}

async function apiRequest(metodo, caminho, corpo) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resposta = await fetch(`${API_BASE}${caminho}`, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {
    dados = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401) {
      limparSessao();
    }
    const mensagem = (dados && dados.erro) || 'Ocorreu um erro ao comunicar com o servidor.';
    const erro = new Error(mensagem);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

const api = {
  login: (email, senha) => apiRequest('POST', '/auth/login', { email, senha }),

  listarClientes: (busca) => apiRequest('GET', `/clientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  criarCliente: (dados) => apiRequest('POST', '/clientes', dados),
  atualizarCliente: (id, dados) => apiRequest('PUT', `/clientes/${id}`, dados),
  excluirCliente: (id) => apiRequest('DELETE', `/clientes/${id}`),

  listarProdutos: (busca) => apiRequest('GET', `/produtos${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  criarProduto: (dados) => apiRequest('POST', '/produtos', dados),
  atualizarProduto: (id, dados) => apiRequest('PUT', `/produtos/${id}`, dados),
  excluirProduto: (id) => apiRequest('DELETE', `/produtos/${id}`),

  listarOrcamentos: (filtros) => {
    const params = new URLSearchParams();
    if (filtros?.status) params.set('status', filtros.status);
    if (filtros?.cliente) params.set('cliente', filtros.cliente);
    const query = params.toString();
    return apiRequest('GET', `/orcamentos${query ? `?${query}` : ''}`);
  },
  obterOrcamento: (id) => apiRequest('GET', `/orcamentos/${id}`),
  criarOrcamento: (dados) => apiRequest('POST', '/orcamentos', dados),
  atualizarOrcamento: (id, dados) => apiRequest('PUT', `/orcamentos/${id}`, dados),
  excluirOrcamento: (id) => apiRequest('DELETE', `/orcamentos/${id}`),

  dashboard: () => apiRequest('GET', '/dashboard'),
};
