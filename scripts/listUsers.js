const knex = require("../src/database/knex");

async function listUsers() {
  try {
    const users = await knex("users").select("id", "name", "email", "role");

    console.log("\n========================================");
    console.log("USUÁRIOS CADASTRADOS");
    console.log("========================================\n");

    if (users.length === 0) {
      console.log("❌ Nenhum usuário encontrado no banco de dados.\n");
    } else {
      users.forEach((user) => {
        console.log(`ID: ${user.id}`);
        console.log(`Nome: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Papel: ${user.role === "admin" ? "👑 ADMIN" : "👤 CLIENTE"}`);
        console.log("----------------------------------------");
      });
      console.log(`\nTotal: ${users.length} usuário(s)\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Erro ao listar usuários:", error.message);
    process.exit(1);
  }
}

listUsers();
