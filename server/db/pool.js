import mysql from "mysql2/promise";
import { DB } from "../config.js";

// MICROAPP_PERFORMANCE.md §6 — on Vercel serverless, each warm instance keeps its own pool, so a
// large per-instance limit multiplies across however many instances are running concurrently and
// can exhaust the database's own connection cap. Kept small (this app's own headcount is small —
// HR PoC scale, per employeeHydration.js's own note) rather than the previous 10.
export const pool = mysql.createPool({
  host: DB.host,
  port: DB.port,
  database: DB.database,
  user: DB.user,
  password: DB.password,
  waitForConnections: true,
  connectionLimit: 5,
});
