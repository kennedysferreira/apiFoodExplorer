exports.up = (knex) =>
  knex.schema.table("orders", (table) => {
    // Auditoria de confirmação de pagamento
    table.integer("confirmed_by").unsigned(); // ID do admin que confirmou
    table.foreign("confirmed_by").references("id").inTable("users").onDelete("SET NULL");

    table.timestamp("confirmed_at"); // Quando foi confirmado
    table.text("payment_notes"); // Observações sobre o pagamento
    table.boolean("payment_manually_confirmed").defaultTo(false); // Se foi confirmação manual
  });

exports.down = (knex) =>
  knex.schema.table("orders", (table) => {
    table.dropForeign("confirmed_by");
    table.dropColumn("confirmed_by");
    table.dropColumn("confirmed_at");
    table.dropColumn("payment_notes");
    table.dropColumn("payment_manually_confirmed");
  });
