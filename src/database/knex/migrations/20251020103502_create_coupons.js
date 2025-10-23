exports.up = (knex) =>
  knex.schema.createTable("coupons", (table) => {
    table.increments("id");

    // Informações do cupom
    table.text("code").notNullable().unique(); // Código do cupom (ex: PRIMEIRACOMPRA, FIDELIDADE10)
    table.text("description").notNullable(); // Descrição do cupom

    // Tipo de desconto
    table
      .enum("discount_type", ["percentage", "fixed"])
      .notNullable()
      .defaultTo("percentage"); // Porcentagem ou valor fixo

    table.decimal("discount_value", 10, 2).notNullable(); // Valor do desconto

    // Configurações de uso
    table.decimal("min_order_value", 10, 2).defaultTo(0); // Valor mínimo do pedido
    table.integer("usage_limit"); // Limite total de usos (null = ilimitado)
    table.integer("usage_count").defaultTo(0); // Contador de usos
    table.integer("usage_per_user").defaultTo(1); // Quantas vezes o mesmo usuário pode usar

    // Validade
    table.timestamp("valid_from").defaultTo(knex.fn.now()); // Válido a partir de
    table.timestamp("valid_until"); // Válido até (null = sem data de expiração)

    // Status
    table.boolean("is_active").defaultTo(true); // Cupom ativo

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

exports.down = (knex) => knex.schema.dropTable("coupons");
