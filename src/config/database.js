const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Define 'frota' como o schema padrao para todas as conexões
pool.on('connect', (client) => {
  client.query('SET search_path TO frota, public;');
  console.log('Conectado com sucesso ao PostgreSQL no schema frota!');
});

module.exports = pool;