const knex = require("../database/knex");
const AppError = require("../utils/AppError");

class LoyaltyPointsController {
  // Consultar saldo de pontos
  async show(request, response) {
    const user_id = request.user.id;

    let userPoints = await knex("loyalty_points").where({ user_id }).first();

    // Se não existir, criar com saldo zero
    if (!userPoints) {
      await knex("loyalty_points").insert({
        user_id,
        balance: 0,
        total_earned: 0,
        total_used: 0,
      });

      userPoints = await knex("loyalty_points").where({ user_id }).first();
    }

    return response.json(userPoints);
  }

  // Usar pontos (converter em desconto)
  async usePoints(request, response) {
    const user_id = request.user.id;
    const { points } = request.body;

    if (!points || points <= 0) {
      throw new AppError("Quantidade de pontos inválida!");
    }

    const userPoints = await knex("loyalty_points").where({ user_id }).first();

    if (!userPoints || userPoints.balance < points) {
      throw new AppError("Pontos insuficientes!");
    }

    // Atualizar saldo
    await knex("loyalty_points")
      .where({ user_id })
      .update({
        balance: userPoints.balance - points,
        total_used: userPoints.total_used + points,
        updated_at: knex.fn.now(),
      });

    // Calcular valor do desconto (1 ponto = R$ 0,01)
    const discountValue = (points / 100).toFixed(2);

    return response.json({
      message: "Pontos utilizados com sucesso!",
      points_used: points,
      discount_value: discountValue,
      new_balance: userPoints.balance - points,
    });
  }

  // Adicionar pontos manualmente (apenas admin)
  async addPoints(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem adicionar pontos!", 403);
    }

    const { user_id, points, reason } = request.body;

    if (!user_id || !points || points <= 0) {
      throw new AppError("Dados inválidos!");
    }

    let userPoints = await knex("loyalty_points").where({ user_id }).first();

    if (!userPoints) {
      await knex("loyalty_points").insert({
        user_id,
        balance: points,
        total_earned: points,
        total_used: 0,
      });
    } else {
      await knex("loyalty_points")
        .where({ user_id })
        .update({
          balance: userPoints.balance + points,
          total_earned: userPoints.total_earned + points,
          updated_at: knex.fn.now(),
        });
    }

    return response.json({
      message: `${points} pontos adicionados com sucesso!`,
      reason: reason || "Bonificação manual",
    });
  }

  // Listar todos os usuários e seus pontos (apenas admin)
  async index(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError(
        "Apenas administradores podem ver pontos de todos os usuários!",
        403
      );
    }

    const allPoints = await knex("loyalty_points")
      .select(
        "loyalty_points.*",
        "users.name as user_name",
        "users.email as user_email"
      )
      .leftJoin("users", "loyalty_points.user_id", "users.id")
      .orderBy("loyalty_points.balance", "desc");

    return response.json(allPoints);
  }
}

module.exports = LoyaltyPointsController;
