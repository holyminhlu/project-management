const sql = require("mssql/msnodesqlv8");

function buildConfigFromEnv() {
  if (process.env.DB_CONNECTION_STRING) {
    return { connectionString: process.env.DB_CONNECTION_STRING };
  }

  const driver = process.env.DB_DRIVER || "ODBC Driver 17 for SQL Server";
  const server = process.env.DB_SERVER || "localhost";
  const database = process.env.DB_NAME || "quanly_duan";
  const trusted = (process.env.DB_TRUSTED_CONNECTION || "Yes").toLowerCase();
  const trustedConnection = ["yes", "true", "1"].includes(trusted) ? "Yes" : "No";

  return {
    connectionString: `Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=${trustedConnection};`,
  };
}

const config = buildConfigFromEnv();

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("✅ SQL Server connected");
    return pool;
  })
  .catch((err) => {
    console.error("❌ SQL Server connection failed:", err);
    throw err;
  });

module.exports = { sql, poolPromise };