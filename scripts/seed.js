require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Inserindo dados de exemplo (clientes e produtos)...');
    const seedPath = path.join(__dirname, '..', 'db', 'seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    await client.query(sql);

    const emailAdmin = process.env.ADMIN_EMAIL || 'admin@ferragensw.com.br';
    const senhaAdmin = process.env.ADMIN_PASSWORD || 'admin123';

    const existente = await client.query(
      'SELECT id_usuario FROM usuarios WHERE email = $1',
      [emailAdmin]
    );

    if (existente.rows.length === 0) {
      const hash = await bcrypt.hash(senhaAdmin, 10);
      await client.query(
        `INSERT INTO usuarios (nome, email, senha, nivel_acesso)
         VALUES ($1, $2, $3, $4)`,
        ['Administrador', emailAdmin, hash, 'administrador']
      );
      console.log(`Usuário administrador criado: ${emailAdmin} / senha: ${senhaAdmin}`);
      console.log('IMPORTANTE: altere essa senha em produção.');
    } else {
      console.log(`Usuário administrador (${emailAdmin}) já existe. Nenhuma alteração feita.`);
    }

    console.log('Seed concluído com sucesso.');
  } catch (err) {
    console.error('Erro ao executar o seed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
