// sets up the postgres connection pool
// everything that talks to the db reuses this same pool instead of
// opening new connections everywhere

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 10, // max clients in the pool, 10 is plenty for this project
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  // this fires if an idle client throws an error in the background
  console.error('unexpected error on idle pg client', err);
});

module.exports = pool;
