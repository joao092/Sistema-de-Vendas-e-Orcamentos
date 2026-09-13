const express = require('express');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/produtos?busca=texto
router.get('/', async (req, res) => {
  const { busca } = req.query;
  try {
    const resultado = busca
      ? await pool.query(
          'SELECT * FROM produtos WHERE nome ILIKE $1 ORDER BY nome ASC',
          [`%${busca}%`]
        )
      : await pool.query('SELECT * FROM produtos ORDER BY nome ASC');
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar produtos.' });
  }
});

// GET /api/produtos/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM produtos WHERE id_produto = $1',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao consultar produto.' });
  }
});

// POST /api/produtos
router.post('/', async (req, res) => {
  const { nome, categoria, unidade, preco_unitario } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }
  const preco = Number(preco_unitario);
  if (!preco_unitario || isNaN(preco) || preco <= 0) {
    return res.status(400).json({ erro: 'Informe um preço unitário válido.' });
  }

  try {
    const query = `
      INSERT INTO produtos (nome, categoria, unidade, preco_unitario)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    const resultado = await pool.query(query, [
      nome.trim(),
      categoria || null,
      unidade || 'UN',
      preco,
    ]);
    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// PUT /api/produtos/:id
router.put('/:id', async (req, res) => {
  const { nome, categoria, unidade, preco_unitario, ativo } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
  }
  const preco = Number(preco_unitario);
  if (!preco_unitario || isNaN(preco) || preco <= 0) {
    return res.status(400).json({ erro: 'Informe um preço unitário válido.' });
  }

  try {
    const query = `
      UPDATE produtos
      SET nome = $1, categoria = $2, unidade = $3, preco_unitario = $4,
          ativo = COALESCE($5, ativo)
      WHERE id_produto = $6
      RETURNING *`;
    const resultado = await pool.query(query, [
      nome.trim(),
      categoria || null,
      unidade || 'UN',
      preco,
      ativo,
      req.params.id,
    ]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    return res.status(200).json(resultado.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
});

// DELETE /api/produtos/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM produtos WHERE id_produto = $1 RETURNING id_produto',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    return res.status(200).json({ mensagem: 'Produto excluído com sucesso.' });
  } catch (err) {
    // Postgres usa códigos diferentes conforme a ação da FK:
    // 23503 = foreign_key_violation (genérico)
    // 23001 = restrict_violation (usado quando a FK é ON DELETE RESTRICT, como aqui)
    if (err.code === '23503' || err.code === '23001') {
      return res.status(409).json({
        erro: 'Não é possível excluir: este produto está vinculado a orçamentos. Considere marcá-lo como inativo.',
      });
    }
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao excluir produto.' });
  }
});

module.exports = router;
