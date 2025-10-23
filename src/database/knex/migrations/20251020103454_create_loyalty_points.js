exports.up = (knex) =>
  knex.schema.createTable("loyalty_points", (table) => {
    table.increments("id");

    // Relacionamento com usuário
    table
      .integer("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .notNullable();

    // Saldo de pontos
    table.integer("balance").defaultTo(0).notNullable(); // Saldo atual de pontos

    // Histórico
    table.integer("total_earned").defaultTo(0).notNullable(); // Total de pontos ganhos (histórico)
    table.integer("total_used").defaultTo(0).notNullable(); // Total de pontos usados (histórico)

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

exports.down = (knex) => knex.schema.dropTable("loyalty_points");
