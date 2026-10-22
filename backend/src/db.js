const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // requerido por Neon
});

// Sin este listener, un error en una conexión idle del pool (p. ej. un
// ECONNRESET del pooler de Neon) se emite como evento 'error' sin manejador
// y Node mata el proceso entero. Acá lo capturamos y solo lo logueamos.
pool.on("error", (err) => {
  console.error(
    `Error inesperado en una conexión idle del pool de PostgreSQL: ${err.message}`
  );
});

module.exports = pool;