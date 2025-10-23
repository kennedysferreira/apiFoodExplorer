exports.up = (knex) =>
  knex.schema.createTable("addresses", (table) => {
    table.increments("id");

    // Relacionamento com usuário
    table
      .integer("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .notNullable();

    // Informações do endereço
    table.text("label").notNullable(); // "Casa", "Trabalho", etc
    table.text("street").notNullable(); // Rua
    table.text("number").notNullable(); // Número
    table.text("complement"); // Complemento (apto, bloco, etc)
    table.text("neighborhood").notNullable(); // Bairro
    table.text("city").notNullable(); // Cidade
    table.text("state").notNullable(); // Estado
    table.text("zip_code").notNullable(); // CEP
    table.text("reference"); // Ponto de referência

    // Configurações
    table.boolean("is_default").defaultTo(false); // Endereço padrão

    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

exports.down = (knex) => knex.schema.dropTable("addresses");
