const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { autenticar, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Regra lógica (Etapa A1): SE usuário e senha forem válidos ENTÃO permitir
// acesso à área administrativa. CASO CONTRÁRIO bloquear o acesso e informar
// que as credenciais são inválidas.
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe o e-mail e a senha.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    const usuario = resultado.rows[0];
    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        nivel_acesso: usuario.nivel_acesso,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        nivel_acesso: usuario.nivel_acesso,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao realizar login.' });
  }
});

// PUT /api/auth/senha
// Permite que o administrador logado troque a própria senha.
router.put('/senha', autenticar, async (req, res) => {
  const { senha_atual, senha_nova } = req.body;

  if (!senha_atual || !senha_nova) {
    return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
  }
  if (senha_nova.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE id_usuario = $1',
      [req.usuario.id_usuario]
    );
    const usuario = resultado.rows[0];
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const senhaValida = await bcrypt.compare(senha_atual, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta.' });
    }

    const novoHash = await bcrypt.hash(senha_nova, 10);
    await pool.query('UPDATE usuarios SET senha = $1 WHERE id_usuario = $2', [
      novoHash,
      req.usuario.id_usuario,
    ]);

    return res.status(200).json({ mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao alterar a senha.' });
  }
});

module.exports = router;
