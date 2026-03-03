import mysql from "mysql2/promise";
import path from "node:path";
import dotenv from "dotenv";

declare global {
  var __pmPool: mysql.Pool | undefined;
}

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbName = process.env.DB_NAME;
const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

if (!dbHost || !dbUser || !dbName) {
  throw new Error(
    "Thiếu cấu hình DB. Cần DB_HOST, DB_USER, DB_NAME trong my-app/.env.local hoặc my-app/backend/.env",
  );
}

const pool =
  global.__pmPool ??
  mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: process.env.DB_PASSWORD ?? "",
    database: dbName,
    port: dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pmPool = pool;
}

export default pool;
