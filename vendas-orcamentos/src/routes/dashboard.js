const express = require('express');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/dashboard
// KPIs exibidos no painel inicial: orçamentos no mês, valor total orçado,
// clientes cadastrados, produtos cadastrados e os últimos orçamentos.
router.get('/', async (req, res) => {
  try {
    const orcamentosMes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM orcamentos
       WHERE date_trunc('month', data_orcamento) = date_trunc('month', CURRENT_DATE)`
    );

    const valorTotalMes = await pool.query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total
       FROM orcamentos
       WHERE date_trunc('month', data_orcamento) = date_trunc('month', CURRENT_DATE)`
    );

    const totalClientes = await pool.query('SELECT COUNT(*) AS total FROM clientes');
    const totalProdutos = await pool.query('SELECT COUNT(*) AS total FROM produtos');

    const ultimosOrcamentos = await pool.query(
      `SELECT o.id_orcamento, o.data_orcamento, o.status, o.valor_total,
              c.nome AS cliente_nome
       FROM orcamentos o
       JOIN clientes c ON c.id_cliente = o.id_cliente
       ORDER BY o.id_orcamento DESC
       LIMIT 5`
    );

    return res.status(200).json({
      orcamentos_no_mes: Number(orcamentosMes.rows[0].total),
      valor_total_orcado: Number(valorTotalMes.rows[0].total),
      clientes_cadastrados: Number(totalClientes.rows[0].total),
      produtos_cadastrados: Number(totalProdutos.rows[0].total),
      ultimos_orcamentos: ultimosOrcamentos.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao carregar dados do dashboard.' });
  }
});

module.exports = router;
