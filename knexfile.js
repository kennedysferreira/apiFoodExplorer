const path = require("path");
require("dotenv/config");

const sharedConfig = {
  migrations: {
    directory: path.resolve(__dirname, "src", "database", "knex", "migrations"),
  },
};

const getDatabaseConfig = () => {
  const client = process.env.DATABASE_CLIENT || "sqlite3";

  if (client === "pg") {
    return {
      client: "pg",
      connection: process.env.DATABASE_URL || {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "sushihana_db",
      },
      pool: {
        min: 2,
        max: 10,
      },
      ...sharedConfig,
    };
  }

  // SQLite (default for development)
  return {
    client: "sqlite3",
    connection: {
      filename: path.resolve(__dirname, "src", "database", "database.db"),
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run("PRAGMA foreign_keys = ON", cb);
      },
    },
    useNullAsDefault: true,
    ...sharedConfig,
  };
};

module.exports = {
  development: getDatabaseConfig(),
  production: getDatabaseConfig(),
};
