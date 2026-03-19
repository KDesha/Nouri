import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Make sure backend/.env exists and you started the server from the backend folder."
  );
}

export const pool = new Pool({
  connectionString,
});
