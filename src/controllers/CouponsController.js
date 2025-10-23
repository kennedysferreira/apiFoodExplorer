const knex = require("../database/knex");
const AppError = require("../utils/AppError");

class CouponsController {
  // Criar novo cupom (apenas admin)
  async create(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem criar cupons!", 403);
    }

    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_value,
      usage_limit,
      usage_per_user,
      valid_from,
      valid_until,
    } = request.body;

    // Validações
    if (!code || !description || !discount_value) {
      throw new AppError("Preencha todos os campos obrigatórios!");
    }

    if (!["percentage", "fixed"].includes(discount_type)) {
      throw new AppError("Tipo de desconto inválido!");
    }

    // Verificar se código já existe
    const existingCoupon = await knex("coupons").where({ code }).first();

    if (existingCoupon) {
      throw new AppError("Já existe um cupom com este código!");
    }

    try {
      const [coupon_id] = await knex("coupons").insert({
        code: code.toUpperCase(),
        description,
        discount_type,
        discount_value,
        min_order_value: min_order_value || 0,
        usage_limit: usage_limit || null,
        usage_per_user: usage_per_user || 1,
        valid_from: valid_from || knex.fn.now(),
        valid_until: valid_until || null,
      });

      return response.status(201).json({
        id: coupon_id,
        message: "Cupom criado com sucesso!",
      });
    } catch (error) {
      throw new AppError("Erro ao criar cupom: " + error.message);
    }
  }

  // Listar todos os cupons
  async index(request, response) {
    const { role } = request.user;
    const { active_only } = request.query;

    let query = knex("coupons");

    // Se não for admin, mostrar apenas cupons ativos e válidos
    if (role !== "admin") {
      const now = new Date().toISOString();
      query = query
        .where({ is_active: true })
        .where(function () {
          this.whereNull("valid_until").orWhere("valid_until", ">=", now);
        });
    } else if (active_only === "true") {
      query = query.where({ is_active: true });
    }

    const coupons = await query.orderBy("created_at", "desc");

    return response.json(coupons);
  }

  // Buscar cupom específico
  async show(request, response) {
    const { id } = request.params;

    const coupon = await knex("coupons").where({ id }).first();

    if (!coupon) {
      throw new AppError("Cupom não encontrado!");
    }

    return response.json(coupon);
  }

  // Validar cupom (antes de aplicar no pedido)
  async validate(request, response) {
    const user_id = request.user.id;
    const { code, order_value } = request.body;

    if (!code) {
      throw new AppError("Código do cupom é obrigatório!");
    }

    const coupon = await knex("coupons")
      .where({ code: code.toUpperCase(), is_active: true })
      .first();

    if (!coupon) {
      throw new AppError("Cupom inválido ou inativo!");
    }

    // Verificar validade
    const now = new Date();
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      throw new AppError("Cupom expirado!");
    }

    if (new Date(coupon.valid_from) > now) {
      throw new AppError("Cupom ainda não está válido!");
    }

    // Verificar valor mínimo
    if (order_value && parseFloat(order_value) < parseFloat(coupon.min_order_value)) {
      return response.status(400).json({
        valid: false,
        message: `Valor mínimo do pedido para este cupom é R$ ${parseFloat(
          coupon.min_order_value
        ).toFixed(2)}`,
      });
    }

    // Verificar limite de uso total
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return response.status(400).json({
        valid: false,
        message: "Cupom atingiu o limite de uso!",
      });
    }

    // Verificar uso por usuário
    const userUsageCount = await knex("user_coupons")
      .where({ user_id, coupon_id: coupon.id })
      .count("* as count")
      .first();

    if (userUsageCount.count >= coupon.usage_per_user) {
      return response.status(400).json({
        valid: false,
        message: "Você já utilizou este cupom o número máximo de vezes!",
      });
    }

    // Calcular desconto
    let discount = 0;
    if (order_value) {
      if (coupon.discount_type === "percentage") {
        discount = (parseFloat(order_value) * parseFloat(coupon.discount_value)) / 100;
      } else {
        discount = parseFloat(coupon.discount_value);
      }

      // Desconto não pode ser maior que o valor do pedido
      if (discount > parseFloat(order_value)) {
        discount = parseFloat(order_value);
      }
    }

    return response.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
      discount: discount.toFixed(2),
      message: "Cupom válido!",
    });
  }

  // Atualizar cupom (apenas admin)
  async update(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem atualizar cupons!", 403);
    }

    const { id } = request.params;
    const {
      description,
      discount_value,
      min_order_value,
      usage_limit,
      usage_per_user,
      valid_until,
      is_active,
    } = request.body;

    const coupon = await knex("coupons").where({ id }).first();

    if (!coupon) {
      throw new AppError("Cupom não encontrado!");
    }

    await knex("coupons")
      .where({ id })
      .update({
        description: description ?? coupon.description,
        discount_value: discount_value ?? coupon.discount_value,
        min_order_value: min_order_value ?? coupon.min_order_value,
        usage_limit: usage_limit ?? coupon.usage_limit,
        usage_per_user: usage_per_user ?? coupon.usage_per_user,
        valid_until: valid_until ?? coupon.valid_until,
        is_active: is_active ?? coupon.is_active,
        updated_at: knex.fn.now(),
      });

    return response.json({ message: "Cupom atualizado com sucesso!" });
  }

  // Desativar cupom (apenas admin)
  async delete(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem deletar cupons!", 403);
    }

    const { id } = request.params;

    const coupon = await knex("coupons").where({ id }).first();

    if (!coupon) {
      throw new AppError("Cupom não encontrado!");
    }

    // Desativar ao invés de deletar (manter histórico)
    await knex("coupons").where({ id }).update({
      is_active: false,
      updated_at: knex.fn.now(),
    });

    return response.json({ message: "Cupom desativado com sucesso!" });
  }

  // Estatísticas de uso de cupom (apenas admin)
  async statistics(request, response) {
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem ver estatísticas!", 403);
    }

    const { id } = request.params;

    const coupon = await knex("coupons").where({ id }).first();

    if (!coupon) {
      throw new AppError("Cupom não encontrado!");
    }

    // Buscar usuários que usaram
    const users = await knex("user_coupons")
      .select("users.name", "users.email", "user_coupons.used_at", "user_coupons.usage_count")
      .leftJoin("users", "user_coupons.user_id", "users.id")
      .where({ "user_coupons.coupon_id": id })
      .orderBy("user_coupons.used_at", "desc");

    return response.json({
      coupon: {
        code: coupon.code,
        description: coupon.description,
        total_uses: coupon.usage_count,
        limit: coupon.usage_limit || "Ilimitado",
      },
      users,
    });
  }
}

module.exports = CouponsController;
