const express = require('express');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/clientes?busca=texto
router.get('/', async (req, res) => {
  const { busca } = req.query;
  try {
    const resultado = busca
      ? await pool.query(
          'SELECT * FROM clientes WHERE nome ILIKE $1 ORDER BY nome ASC',
          [`%${busca}%`]
        )
      : await pool.query('SELECT * FROM clientes ORDER BY nome ASC');
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar clientes.' });
  }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM clientes WHERE id_cliente = $1',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao consultar cliente.' });
  }
});

// POST /api/clientes
router.post('/', async (req, res) => {
  const { nome, telefone, email, endereco } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  try {
    const query = `
      INSERT INTO clientes (nome, telefone, email, endereco)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    const resultado = await pool.query(query, [
      nome.trim(),
      telefone || null,
      email || null,
      endereco || null,
    ]);
    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao cadastrar cliente.' });
  }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
  const { nome, telefone, email, endereco } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  }

  try {
    const query = `
      UPDATE clientes
      SET nome = $1, telefone = $2, email = $3, endereco = $4
      WHERE id_cliente = $5
      RETURNING *`;
    const resultado = await pool.query(query, [
      nome.trim(),
      telefone || null,
      email || null,
      endereco || null,
      req.params.id,
    ]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM clientes WHERE id_cliente = $1 RETURNING id_cliente',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.status(200).json({ mensagem: 'Cliente excluído com sucesso.' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        erro: 'Não é possível excluir: este cliente possui orçamentos vinculados.',
      });
    }
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao excluir cliente.' });
  }
});

module.exports = router;
