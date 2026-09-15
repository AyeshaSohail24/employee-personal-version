import mysql from "mysql2/promise";
import { DB } from "../config.js";

export const pool = mysql.createPool({
  host: DB.host,
  port: DB.port,
  database: DB.database,
  user: DB.user,
  password: DB.password,
  waitForConnections: true,
  connectionLimit: 10,
});
