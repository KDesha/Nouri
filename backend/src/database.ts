import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Make sure backend/.env exists and you started the server from the backend folder."
  );
}

export const pool = new Pool({
  connectionString,
  // Serverless instances can scale horizontally. Keep each warm Netlify
  // function's pool intentionally small so they do not exhaust PostgreSQL.
  max: process.env.NETLIFY ? 2 : undefined,
  idleTimeoutMillis: process.env.NETLIFY ? 10_000 : undefined,
  connectionTimeoutMillis: process.env.NETLIFY ? 10_000 : undefined,
  allowExitOnIdle: Boolean(process.env.NETLIFY),
});
