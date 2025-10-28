const knex = require("../database/knex");
const AppError = require("../utils/AppError");
const logger = require("../configs/logger");
const PixService = require("../services/PixService");

class PaymentController {
  /**
   * Confirmar pagamento manualmente (Admin apenas)
   * POST /payments/confirm/:id
   */
  async confirmPayment(request, response) {
    const { id } = request.params;
    const { notes } = request.body;
    const admin_id = request.user.id;
    const { role } = request.user;

    // Apenas admin pode confirmar pagamentos
    if (role !== "admin") {
      throw new AppError("Apenas administradores podem confirmar pagamentos!", 403);
    }

    try {
      // Buscar pedido
      const order = await knex("orders").where({ id }).first();

      if (!order) {
        throw new AppError("Pedido não encontrado!", 404);
      }

      // Verificar se já foi confirmado
      if (order.payment_status === "confirmed") {
        throw new AppError("Pagamento já foi confirmado anteriormente!", 400);
      }

      // Verificar se PIX expirou (apenas alerta, não bloqueia)
      if (order.payment_method === "pix" && order.pix_expires_at) {
        const isExpired = PixService.isPixExpired(order.pix_expires_at);
        if (isExpired) {
          logger.warn(`PIX expirado para pedido ${order.order_number}, mas confirmação manual permitida`);
        }
      }

      // Atualizar pedido
      await knex("orders")
        .where({ id })
        .update({
          payment_status: "confirmed",
          confirmed_by: admin_id,
          confirmed_at: knex.fn.now(),
          paid_at: knex.fn.now(),
          payment_notes: notes || null,
          payment_manually_confirmed: true,
          status: order.status === "pending" ? "confirmed" : order.status,
          updated_at: knex.fn.now(),
        });

      logger.info(
        `Pagamento confirmado manualmente para pedido ${order.order_number} por admin ${admin_id}`
      );

      return response.json({
        message: "Pagamento confirmado com sucesso!",
        order_number: order.order_number,
        confirmed_at: new Date(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`Erro ao confirmar pagamento: ${error.message}`);
      throw new AppError("Erro ao confirmar pagamento: " + error.message);
    }
  }

  /**
   * Listar pedidos pendentes de confirmação (Admin apenas)
   * GET /payments/pending
   */
  async listPending(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem acessar esta rota!", 403);
    }

    try {
      // Buscar pedidos com pagamento pendente
      const orders = await knex("orders")
        .select(
          "orders.*",
          "users.name as user_name",
          "users.email as user_email"
        )
        .leftJoin("users", "orders.user_id", "users.id")
        .whereIn("orders.payment_status", ["pending", "paid"])
        .orderBy("orders.created_at", "desc");

      // Buscar itens de cada pedido
      for (const order of orders) {
        const items = await knex("order_items").where({ order_id: order.id });
        order.items = items;

        // Verificar se PIX expirou
        if (order.payment_method === "pix" && order.pix_expires_at) {
          order.pix_expired = PixService.isPixExpired(order.pix_expires_at);
        }
      }

      return response.json(orders);
    } catch (error) {
      logger.error(`Erro ao listar pagamentos pendentes: ${error.message}`);
      throw new AppError("Erro ao listar pagamentos pendentes: " + error.message);
    }
  }

  /**
   * Buscar histórico de confirmações (Admin apenas)
   * GET /payments/history
   */
  async confirmationHistory(request, response) {
    const { role } = request.user;
    const { start_date, end_date, payment_method } = request.query;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem acessar esta rota!", 403);
    }

    try {
      let query = knex("orders")
        .select(
          "orders.id",
          "orders.order_number",
          "orders.total",
          "orders.payment_method",
          "orders.payment_status",
          "orders.confirmed_at",
          "orders.payment_notes",
          "orders.payment_manually_confirmed",
          "users.name as user_name",
          "confirmer.name as confirmed_by_name"
        )
        .leftJoin("users", "orders.user_id", "users.id")
        .leftJoin("users as confirmer", "orders.confirmed_by", "confirmer.id")
        .where("orders.payment_status", "confirmed");

      // Filtros
      if (start_date) {
        query = query.where("orders.confirmed_at", ">=", start_date);
      }

      if (end_date) {
        query = query.where("orders.confirmed_at", "<=", end_date);
      }

      if (payment_method) {
        query = query.where("orders.payment_method", payment_method);
      }

      const confirmations = await query.orderBy("orders.confirmed_at", "desc");

      return response.json(confirmations);
    } catch (error) {
      logger.error(`Erro ao buscar histórico de confirmações: ${error.message}`);
      throw new AppError("Erro ao buscar histórico: " + error.message);
    }
  }

  /**
   * Rejeitar pagamento (Admin apenas)
   * PATCH /payments/reject/:id
   */
  async rejectPayment(request, response) {
    const { id } = request.params;
    const { reason } = request.body;
    const admin_id = request.user.id;
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem rejeitar pagamentos!", 403);
    }

    if (!reason) {
      throw new AppError("Motivo da rejeição é obrigatório!", 400);
    }

    try {
      const order = await knex("orders").where({ id }).first();

      if (!order) {
        throw new AppError("Pedido não encontrado!", 404);
      }

      // Atualizar pedido
      await knex("orders")
        .where({ id })
        .update({
          status: "cancelled",
          payment_status: "pending",
          payment_notes: `Pagamento rejeitado: ${reason}`,
          confirmed_by: admin_id,
          confirmed_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });

      logger.info(
        `Pagamento rejeitado para pedido ${order.order_number} por admin ${admin_id}. Motivo: ${reason}`
      );

      return response.json({
        message: "Pagamento rejeitado e pedido cancelado",
        order_number: order.order_number,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(`Erro ao rejeitar pagamento: ${error.message}`);
      throw new AppError("Erro ao rejeitar pagamento: " + error.message);
    }
  }

  // ========================================
  // MÉTODOS LEGADOS (manter compatibilidade)
  // ========================================

  /**
   * @deprecated Usar novo sistema de orders
   */
  async create(request, response) {
    const user_id = request.user.id;
    const { plate, price } = request.body;

    const insertPayment = await knex("payments")
      .insert({
        user_id: user_id,
        status: "pendente",
        plates: plate,
        price: price,
      })
      .returning("id");

    setTimeout(async () => {
      const [verifyStatus] = await knex("payments").where({
        id: insertPayment[0].id,
      });

      if (verifyStatus.status === "pendente") {
        await knex("payments").where({ id: insertPayment[0].id }).update({
          status: "cancelado",
        });
      }
    }, 1000 * 60 * 15); // 15 minutos

    return response.json(insertPayment);
  }

  /**
   * @deprecated Usar novo sistema de orders
   */
  async show(request, response) {
    const id = request.params.id;
    const user_id = request.user;

    const searchPayment = await knex("payments").where({ id }).first();

    if (!searchPayment) {
      return response.status(404).json({ message: "Pedido não encontrado." });
    }

    if (user_id.id === searchPayment.user_id) {
      return response.json(searchPayment);
    } else {
      return response.status(403).json({ message: "Acesso negado a este pedido." });
    }
  }

  /**
   * @deprecated Usar novo sistema de orders
   */
  async index(request, response) {
    const user_id = request.user.id;
    const { role } = request.user;

    if (role === "admin") {
      const searchAllPayments = await knex("payments");
      return response.json(searchAllPayments);
    }

    const searchAllUserPayments = await knex("payments").where({
      user_id: user_id,
    });
    return response.json(searchAllUserPayments);
  }

  /**
   * @deprecated Usar novo sistema de orders
   */
  async execute(request, response) {
    const { id } = request.params;

    const [verifyStatus] = await knex("payments").where({ id });

    if (verifyStatus.status === "cancelado") {
      await knex("payments").where({ id }).update({
        status: "cancelado",
      });
      return response.json(
        "Tempo para pagamento expirou o pedido foi cancelado."
      );
    }

    if (verifyStatus.status === "pendente") {
      await knex("payments").where({ id }).update({
        status: "processando",
      });
    }

    setTimeout(async () => {
      await knex("payments").where({ id }).update({
        status: "em andamento",
      });
    }, 1000 * 10); //10 segundos

    setTimeout(async () => {
      await knex("payments").where({ id }).update({
        status: "cozinha",
      });
    }, 1000 * 20); //20 segundos

    setTimeout(async () => {
      await knex("payments").where({ id }).update({
        status: "finalizado",
      });
    }, 1000 * 30); //30 segundos

    return response.json(verifyStatus.status);
  }

  /**
   * @deprecated Usar novo sistema de orders
   */
  async update(request, response) {
    const { id } = request.params;
    const { newStatus } = request.body;

    if (!newStatus) {
      return;
    }

    await knex("payments").where({ id }).update({
      status: newStatus,
    });

    return response.status(200);
  }
}

module.exports = PaymentController;
