const { Pool } = require('pg');

// No Render, a variável DATABASE_URL é fornecida automaticamente quando
// o banco PostgreSQL é criado e vinculado ao Web Service.
// Em ambiente local, defina DATABASE_URL no arquivo .env
// (veja .env.example).
const connectionString = process.env.DATABASE_URL;

const useSSL = process.env.PGSSL !== 'false';

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões do PostgreSQL:', err);
});

module.exports = pool;
