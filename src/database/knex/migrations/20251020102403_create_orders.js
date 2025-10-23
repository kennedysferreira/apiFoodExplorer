exports.up = (knex) =>
  knex.schema.createTable("orders", (table) => {
    table.increments("id");

    // Relacionamento com usuário
    table
      .integer("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .notNullable();

    // Informações do pedido
    table.text("order_number").notNullable().unique(); // Número do pedido (ex: #ORD-2024-0001)
    table.decimal("subtotal", 10, 2).notNullable(); // Subtotal dos itens
    table.decimal("delivery_fee", 10, 2).defaultTo(0); // Taxa de entrega
    table.decimal("discount", 10, 2).defaultTo(0); // Desconto aplicado
    table.decimal("total", 10, 2).notNullable(); // Total final

    // Status do pedido
    table
      .enum("status", [
        "pending", // Aguardando pagamento
        "confirmed", // Pagamento confirmado
        "preparing", // Em preparação
        "ready", // Pronto para retirada/entrega
        "out_for_delivery", // Saiu para entrega
        "delivered", // Entregue
        "cancelled", // Cancelado
      ])
      .notNullable()
      .defaultTo("pending");

    // Tipo de entrega
    table.enum("delivery_type", ["delivery", "pickup"]).notNullable().defaultTo("delivery");

    // Informações de entrega
    table.text("delivery_address"); // Endereço completo
    table.text("delivery_phone"); // Telefone para contato
    table.text("delivery_notes"); // Observações da entrega

    // Tempo estimado
    table.integer("estimated_time"); // Tempo estimado em minutos

    // Pontos de fidelidade
    table.integer("loyalty_points_earned").defaultTo(0); // Pontos ganhos neste pedido
    table.integer("loyalty_points_used").defaultTo(0); // Pontos usados neste pedido

    // Cupom aplicado
    table.text("coupon_code"); // Código do cupom usado

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

exports.down = (knex) => knex.schema.dropTable("orders");
