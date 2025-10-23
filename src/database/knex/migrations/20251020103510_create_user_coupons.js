exports.up = (knex) =>
  knex.schema.createTable("user_coupons", (table) => {
    table.increments("id");

    // Relacionamentos
    table
      .integer("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .notNullable();

    table
      .integer("coupon_id")
      .references("id")
      .inTable("coupons")
      .onDelete("CASCADE")
      .notNullable();

    table
      .integer("order_id")
      .references("id")
      .inTable("orders")
      .onDelete("SET NULL"); // Se o pedido for deletado, mantém o registro de uso

    // Informações de uso
    table.integer("usage_count").defaultTo(0).notNullable(); // Quantas vezes esse usuário usou este cupom

    // Timestamp
    table.timestamp("used_at").defaultTo(knex.fn.now()); // Quando foi usado
  });

exports.down = (knex) => knex.schema.dropTable("user_coupons");
