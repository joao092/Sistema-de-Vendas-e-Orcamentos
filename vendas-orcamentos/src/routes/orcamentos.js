const express = require('express');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

function validarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return 'Adicione pelo menos um item ao orçamento.';
  }
  for (const item of itens) {
    if (!item.id_produto) return 'Todos os itens precisam ter um produto selecionado.';
    const qtd = Number(item.quantidade);
    if (!qtd || isNaN(qtd) || qtd <= 0) {
      return 'Informe uma quantidade válida (maior que zero) para todos os itens.';
    }
  }
  return null;
}

// GET /api/orcamentos?status=PENDENTE&cliente=texto
// Histórico de orçamentos, com filtros opcionais por status e nome do cliente.
router.get('/', async (req, res) => {
  const { status, cliente } = req.query;
  const condicoes = [];
  const valores = [];

  if (status && status !== 'Todos') {
    valores.push(status);
    condicoes.push(`o.status = $${valores.length}`);
  }
  if (cliente) {
    valores.push(`%${cliente}%`);
    condicoes.push(`c.nome ILIKE $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  try {
    const query = `
      SELECT o.id_orcamento, o.data_orcamento, o.status, o.valor_total,
             o.observacao, c.id_cliente, c.nome AS cliente_nome
      FROM orcamentos o
      JOIN clientes c ON c.id_cliente = o.id_cliente
      ${where}
      ORDER BY o.id_orcamento DESC`;
    const resultado = await pool.query(query, valores);
    return res.status(200).json(resultado.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao listar orçamentos.' });
  }
});

// GET /api/orcamentos/:id  (detalhe + itens)
router.get('/:id', async (req, res) => {
  try {
    const orcamentoRes = await pool.query(
      `SELECT o.*, c.nome AS cliente_nome
       FROM orcamentos o
       JOIN clientes c ON c.id_cliente = o.id_cliente
       WHERE o.id_orcamento = $1`,
      [req.params.id]
    );
    if (orcamentoRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }

    const itensRes = await pool.query(
      `SELECT i.*, p.nome AS produto_nome
       FROM itens_orcamento i
       JOIN produtos p ON p.id_produto = i.id_produto
       WHERE i.id_orcamento = $1
       ORDER BY i.id_item ASC`,
      [req.params.id]
    );

    return res.status(200).json({
      ...orcamentoRes.rows[0],
      itens: itensRes.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao consultar orçamento.' });
  }
});

// POST /api/orcamentos
// Regra lógica (Etapa A1): SE algum campo obrigatório estiver inválido ou
// vazio ENTÃO bloquear o registro do orçamento e solicitar a correção.
router.post('/', async (req, res) => {
  const { id_cliente, itens, observacao } = req.body;
  const id_usuario = req.usuario.id_usuario;

  if (!id_cliente) {
    return res.status(400).json({ erro: 'Selecione um cliente para o orçamento.' });
  }
  const erroItens = validarItens(itens);
  if (erroItens) {
    return res.status(400).json({ erro: erroItens });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orcamentoRes = await client.query(
      `INSERT INTO orcamentos (id_cliente, id_usuario, observacao)
       VALUES ($1, $2, $3) RETURNING id_orcamento`,
      [id_cliente, id_usuario, observacao || null]
    );
    const idOrcamento = orcamentoRes.rows[0].id_orcamento;

    for (const item of itens) {
      const produtoRes = await client.query(
        'SELECT preco_unitario FROM produtos WHERE id_produto = $1',
        [item.id_produto]
      );
      if (produtoRes.rows.length === 0) {
        throw new Error(`Produto ${item.id_produto} não encontrado.`);
      }
      const valorUnitario = produtoRes.rows[0].preco_unitario;

      await client.query(
        `INSERT INTO itens_orcamento (id_orcamento, id_produto, quantidade, valor_unitario)
         VALUES ($1, $2, $3, $4)`,
        [idOrcamento, item.id_produto, item.quantidade, valorUnitario]
      );
    }

    await client.query('COMMIT');

    const orcamentoFinal = await pool.query(
      'SELECT * FROM orcamentos WHERE id_orcamento = $1',
      [idOrcamento]
    );

    return res.status(201).json(orcamentoFinal.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar orçamento.' });
  } finally {
    client.release();
  }
});

// PUT /api/orcamentos/:id
// Permite editar cliente, observação, status e substituir os itens do
// orçamento (Fluxo de Edição do Orçamento - Etapa A1).
router.put('/:id', async (req, res) => {
  const { id_cliente, itens, observacao, status } = req.body;
  const idOrcamento = req.params.id;

  if (itens) {
    const erroItens = validarItens(itens);
    if (erroItens) {
      return res.status(400).json({ erro: erroItens });
    }
  }
  if (status && !['PENDENTE', 'APROVADO', 'CANCELADO'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existente = await client.query(
      'SELECT * FROM orcamentos WHERE id_orcamento = $1 FOR UPDATE',
      [idOrcamento]
    );
    if (existente.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }

    await client.query(
      `UPDATE orcamentos
       SET id_cliente = COALESCE($1, id_cliente),
           observacao = COALESCE($2, observacao),
           status = COALESCE($3, status)
       WHERE id_orcamento = $4`,
      [id_cliente || null, observacao, status, idOrcamento]
    );

    if (Array.isArray(itens)) {
      await client.query('DELETE FROM itens_orcamento WHERE id_orcamento = $1', [idOrcamento]);

      for (const item of itens) {
        const produtoRes = await client.query(
          'SELECT preco_unitario FROM produtos WHERE id_produto = $1',
          [item.id_produto]
        );
        if (produtoRes.rows.length === 0) {
          throw new Error(`Produto ${item.id_produto} não encontrado.`);
        }
        const valorUnitario = produtoRes.rows[0].preco_unitario;

        await client.query(
          `INSERT INTO itens_orcamento (id_orcamento, id_produto, quantidade, valor_unitario)
           VALUES ($1, $2, $3, $4)`,
          [idOrcamento, item.id_produto, item.quantidade, valorUnitario]
        );
      }
    }

    await client.query('COMMIT');

    const orcamentoFinal = await pool.query(
      'SELECT * FROM orcamentos WHERE id_orcamento = $1',
      [idOrcamento]
    );
    return res.status(200).json(orcamentoFinal.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao atualizar orçamento.' });
  } finally {
    client.release();
  }
});

// DELETE /api/orcamentos/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM orcamentos WHERE id_orcamento = $1 RETURNING id_orcamento',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    }
    return res.status(200).json({ mensagem: 'Orçamento excluído com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao excluir orçamento.' });
  }
});

module.exports = router;
