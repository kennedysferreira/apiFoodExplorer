exports.up = (knex) =>
  knex.schema.createTable("order_items", (table) => {
    table.increments("id");

    // Relacionamento com pedido
    table
      .integer("order_id")
      .references("id")
      .inTable("orders")
      .onDelete("CASCADE")
      .notNullable();

    // Relacionamento com prato
    table
      .integer("plate_id")
      .references("id")
      .inTable("plates")
      .onDelete("CASCADE")
      .notNullable();

    // Informações do item
    table.text("plate_name").notNullable(); // Nome do prato no momento do pedido
    table.decimal("unit_price", 10, 2).notNullable(); // Preço unitário
    table.integer("quantity").notNullable().defaultTo(1); // Quantidade
    table.decimal("subtotal", 10, 2).notNullable(); // Subtotal (unit_price * quantity)

    // Observações
    table.text("notes"); // Observações do item (ex: "sem wasabi", "dobrar shoyu")

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

exports.down = (knex) => knex.schema.dropTable("order_items");
