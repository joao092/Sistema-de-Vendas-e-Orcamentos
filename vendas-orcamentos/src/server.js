require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const orcamentosRoutes = require('./routes/orcamentos');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());

// ---------- Rotas da API ----------
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/orcamentos', orcamentosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Rota simples de verificação de saúde (útil no Render)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ---------- Frontend estático ----------
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Qualquer rota não-API cai no index.html (aplicação single-page)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ---------- Tratamento de erros ----------
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor de Vendas e Orçamentos rodando na porta ${PORT}`);
});
