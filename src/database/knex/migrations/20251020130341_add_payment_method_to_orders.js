exports.up = (knex) =>
  knex.schema.table("orders", (table) => {
    // Método de pagamento
    table
      .enum("payment_method", ["cash", "pix", "card"])
      .notNullable()
      .defaultTo("cash");

    // Status do pagamento
    table
      .enum("payment_status", ["pending", "paid", "confirmed"])
      .notNullable()
      .defaultTo("pending");

    // Dados do PIX (quando aplicável)
    table.text("pix_qr_code"); // QR Code em base64 ou URL
    table.text("pix_copy_paste"); // Código copia e cola do PIX
    table.timestamp("pix_expires_at"); // Expiração do PIX (geralmente 30min)

    // Confirmação de pagamento
    table.timestamp("paid_at"); // Quando o pagamento foi confirmado
  });

exports.down = (knex) =>
  knex.schema.table("orders", (table) => {
    table.dropColumn("payment_method");
    table.dropColumn("payment_status");
    table.dropColumn("pix_qr_code");
    table.dropColumn("pix_copy_paste");
    table.dropColumn("pix_expires_at");
    table.dropColumn("paid_at");
  });
