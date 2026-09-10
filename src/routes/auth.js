const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

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

module.exports = router;
