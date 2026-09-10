require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Executando schema.sql no banco de dados...');
  try {
    await pool.query(sql);
    console.log('Migração concluída com sucesso: tabelas, índices, triggers e views criados/atualizados.');
  } catch (err) {
    console.error('Erro ao executar a migração:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
