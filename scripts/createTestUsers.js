const knex = require("../src/database/knex");
const { hash } = require("bcryptjs");

async function createTestUsers() {
  try {
    console.log("\n========================================");
    console.log("CRIANDO USUÁRIOS DE TESTE");
    console.log("========================================\n");

    // Verificar se já existem
    const existingAdmin = await knex("users").where({ email: "admin@admin.com" }).first();
    const existingClient = await knex("users").where({ email: "cliente@cliente.com" }).first();

    // Criar ADMIN
    if (existingAdmin) {
      console.log("✅ Admin já existe: admin@admin.com");
      // Atualizar role para admin se não for
      if (existingAdmin.role !== "admin") {
        await knex("users").where({ id: existingAdmin.id }).update({ role: "admin" });
        console.log("   → Role atualizada para ADMIN");
      }
    } else {
      const hashedPassword = await hash("123456", 8);
      await knex("users").insert({
        name: "Administrador",
        email: "admin@admin.com",
        password: hashedPassword,
        role: "admin",
      });
      console.log("✅ Admin criado: admin@admin.com");
    }

    // Criar CLIENTE
    if (existingClient) {
      console.log("✅ Cliente já existe: cliente@cliente.com");
    } else {
      const hashedPassword = await hash("123456", 8);
      await knex("users").insert({
        name: "Cliente Teste",
        email: "cliente@cliente.com",
        password: hashedPassword,
        role: "user",
      });
      console.log("✅ Cliente criado: cliente@cliente.com");
    }

    console.log("\n========================================");
    console.log("CREDENCIAIS DE TESTE");
    console.log("========================================\n");
    console.log("👑 ADMINISTRADOR:");
    console.log("   Email: admin@admin.com");
    console.log("   Senha: 123456\n");
    console.log("👤 CLIENTE:");
    console.log("   Email: cliente@cliente.com");
    console.log("   Senha: 123456\n");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar usuários:", error.message);
    process.exit(1);
  }
}

createTestUsers();
