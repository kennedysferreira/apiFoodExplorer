const knex = require("../database/knex");
const AppError = require("../utils/AppError");
const PixService = require("../services/PixService");
const WhatsAppService = require("../services/WhatsAppService");
const logger = require("../configs/logger");

class OrdersController {
  // Criar novo pedido
  async create(request, response) {
    const user_id = request.user.id;
    const {
      items, // Array de { plate_id, quantity, notes }
      delivery_type,
      delivery_address,
      delivery_phone,
      delivery_notes,
      coupon_code,
      payment_method, // "cash", "pix", "card"
    } = request.body;

    // Validações básicas
    if (!items || items.length === 0) {
      throw new AppError("O pedido deve conter pelo menos um item!");
    }

    if (delivery_type === "delivery" && !delivery_address) {
      throw new AppError("Endereço de entrega é obrigatório para delivery!");
    }

    try {
      // Buscar informações dos pratos
      const plateIds = items.map((item) => item.plate_id);
      const plates = await knex("plates").whereIn("id", plateIds);

      if (plates.length !== plateIds.length) {
        throw new AppError("Um ou mais pratos não foram encontrados!");
      }

      // Calcular subtotal
      let subtotal = 0;
      const orderItems = items.map((item) => {
        const plate = plates.find((p) => p.id === item.plate_id);
        const itemSubtotal = parseFloat(plate.value) * item.quantity;
        subtotal += itemSubtotal;

        return {
          plate_id: item.plate_id,
          plate_name: plate.name,
          unit_price: parseFloat(plate.value),
          quantity: item.quantity,
          subtotal: itemSubtotal,
          notes: item.notes || null,
        };
      });

      // Taxa de entrega
      const delivery_fee =
        delivery_type === "delivery"
          ? parseFloat(process.env.DELIVERY_FEE || 8.0)
          : 0;

      // Validar e aplicar cupom
      let discount = 0;
      let validCoupon = null;

      if (coupon_code) {
        validCoupon = await knex("coupons")
          .where({ code: coupon_code, is_active: true })
          .first();

        if (!validCoupon) {
          throw new AppError("Cupom inválido ou inativo!");
        }

        // Verificar validade
        const now = new Date();
        if (validCoupon.valid_until && new Date(validCoupon.valid_until) < now) {
          throw new AppError("Cupom expirado!");
        }

        // Verificar valor mínimo
        if (subtotal < parseFloat(validCoupon.min_order_value)) {
          throw new AppError(
            `Valor mínimo do pedido para este cupom é R$ ${validCoupon.min_order_value}`
          );
        }

        // Verificar limite de uso
        if (
          validCoupon.usage_limit &&
          validCoupon.usage_count >= validCoupon.usage_limit
        ) {
          throw new AppError("Cupom atingiu o limite de uso!");
        }

        // Verificar uso por usuário
        const userUsageCount = await knex("user_coupons")
          .where({ user_id, coupon_id: validCoupon.id })
          .count("* as count")
          .first();

        if (userUsageCount.count >= validCoupon.usage_per_user) {
          throw new AppError("Você já utilizou este cupom o número máximo de vezes!");
        }

        // Calcular desconto
        if (validCoupon.discount_type === "percentage") {
          discount = (subtotal * parseFloat(validCoupon.discount_value)) / 100;
        } else {
          discount = parseFloat(validCoupon.discount_value);
        }

        // Desconto não pode ser maior que o subtotal
        if (discount > subtotal) {
          discount = subtotal;
        }
      }

      // Calcular pontos de fidelidade
      const pointsPerReal = parseInt(process.env.POINTS_PER_REAL || 1);
      const loyalty_points_earned = Math.floor((subtotal - discount) * pointsPerReal);

      // Total final
      const total = subtotal + delivery_fee - discount;

      // Gerar número do pedido
      const year = new Date().getFullYear();
      const lastOrder = await knex("orders")
        .whereLike("order_number", `%${year}%`)
        .orderBy("id", "desc")
        .first();

      let orderCount = 1;
      if (lastOrder) {
        const lastNumber = parseInt(lastOrder.order_number.split("-").pop());
        orderCount = lastNumber + 1;
      }

      const order_number = `ORD-${year}-${String(orderCount).padStart(4, "0")}`;

      // Calcular tempo estimado
      const prepTimeMin = parseInt(process.env.PREP_TIME_MIN || 60);
      const prepTimeMax = parseInt(process.env.PREP_TIME_MAX || 85);
      const estimated_time =
        Math.floor(Math.random() * (prepTimeMax - prepTimeMin + 1)) + prepTimeMin;

      // Validar método de pagamento
      const validPaymentMethods = ["cash", "pix", "card"];
      const selectedPaymentMethod = payment_method || "cash";

      if (!validPaymentMethods.includes(selectedPaymentMethod)) {
        throw new AppError("Método de pagamento inválido!");
      }

      // Formatar delivery_address se vier como objeto
      let formattedAddress = delivery_address;
      if (delivery_address && typeof delivery_address === 'object') {
        formattedAddress = `${delivery_address.street}, ${delivery_address.number}` +
          (delivery_address.complement ? ` - ${delivery_address.complement}` : '') +
          `\n${delivery_address.neighborhood}, ${delivery_address.city}/${delivery_address.state}`;
      }

      // Preparar dados do pedido
      const orderData = {
        user_id,
        order_number,
        subtotal,
        delivery_fee,
        discount,
        total,
        delivery_type,
        delivery_address: formattedAddress,
        delivery_phone,
        delivery_notes,
        estimated_time,
        loyalty_points_earned,
        coupon_code: coupon_code || null,
        status: "pending",
        payment_method: selectedPaymentMethod,
        payment_status: selectedPaymentMethod === "pix" ? "pending" : "paid",
      };

      // Se for PIX, gerar QR Code e código copia e cola
      let pixData = null;
      if (selectedPaymentMethod === "pix") {
        try {
          pixData = await PixService.generateOrderPix({
            amount: total,
            orderId: order_number,
            description: `Pedido ${order_number} - Sushihana`,
          });

          orderData.pix_qr_code = pixData.qrCodeBase64;
          orderData.pix_copy_paste = pixData.pixCopyPaste;
          orderData.pix_expires_at = PixService.calculatePixExpiration(30);
        } catch (error) {
          throw new AppError(`Erro ao gerar PIX: ${error.message}`);
        }
      }

      // Inserir pedido
      const [order_id] = await knex("orders").insert(orderData);

      logger.info(`Order created successfully - ID: ${order_id}, Number: ${order_number}, User: ${user_id}`);

      // Inserir itens do pedido
      const orderItemsWithOrderId = orderItems.map((item) => ({
        ...item,
        order_id,
      }));
      await knex("order_items").insert(orderItemsWithOrderId);

      logger.info(`Order items inserted - Order ID: ${order_id}, Items count: ${orderItemsWithOrderId.length}`);

      // Atualizar cupom se foi usado
      if (validCoupon) {
        await knex("coupons")
          .where({ id: validCoupon.id })
          .increment("usage_count", 1);

        await knex("user_coupons").insert({
          user_id,
          coupon_id: validCoupon.id,
          order_id,
          usage_count: 1,
        });
      }

      // Atualizar pontos de fidelidade
      const userPoints = await knex("loyalty_points").where({ user_id }).first();

      if (userPoints) {
        await knex("loyalty_points").where({ user_id }).update({
          balance: userPoints.balance + loyalty_points_earned,
          total_earned: userPoints.total_earned + loyalty_points_earned,
          updated_at: knex.fn.now(),
        });
      } else {
        await knex("loyalty_points").insert({
          user_id,
          balance: loyalty_points_earned,
          total_earned: loyalty_points_earned,
        });
      }

      const responseData = {
        order_id,
        order_number,
        total,
        estimated_time,
        loyalty_points_earned,
        payment_method: selectedPaymentMethod,
        payment_status: orderData.payment_status,
        message: "Pedido criado com sucesso!",
      };

      // Se for PIX, incluir dados do PIX
      if (selectedPaymentMethod === "pix" && pixData) {
        responseData.pix = {
          qr_code: pixData.qrCodeBase64,
          copy_paste: pixData.pixCopyPaste,
          expires_at: orderData.pix_expires_at,
          instructions:
            "Escaneie o QR Code ou copie o código PIX para realizar o pagamento. O pedido será confirmado automaticamente após o pagamento.",
        };
      }

      // Se for dinheiro ou cartão, adicionar instruções
      if (selectedPaymentMethod === "cash") {
        responseData.instructions =
          "Pagamento em dinheiro no ato da entrega ou retirada.";
      }

      if (selectedPaymentMethod === "card") {
        responseData.instructions =
          "Pagamento com cartão na máquina no ato da entrega ou retirada.";
      }

      // Enviar notificação WhatsApp para o restaurante
      try {
        // Buscar dados do usuário para incluir na notificação
        const user = await knex("users")
          .select("name", "email")
          .where({ id: user_id })
          .first();

        const notificationData = {
          order_number,
          user_name: user.name,
          delivery_type,
          payment_method: selectedPaymentMethod,
          items: orderItems,
          total,
          delivery_address,
          delivery_notes,
          delivery_phone,
          estimated_time,
        };

        await WhatsAppService.notifyNewOrder(notificationData);
      } catch (error) {
        // Não bloquear o pedido se falhar a notificação
        logger.error(`Erro ao enviar notificação WhatsApp: ${error.message}`);
      }

      return response.status(201).json(responseData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Erro ao criar pedido: " + error.message);
    }
  }

  // Listar pedidos do usuário
  async index(request, response) {
    const user_id = request.user.id;
    const { role } = request.user;

    let orders;

    if (role === "admin") {
      // Admin vê todos os pedidos
      orders = await knex("orders")
        .select("orders.*", "users.name as user_name", "users.email as user_email")
        .leftJoin("users", "orders.user_id", "users.id")
        .orderBy("orders.created_at", "desc");
    } else {
      // Usuário vê apenas seus pedidos
      orders = await knex("orders")
        .where({ user_id })
        .orderBy("created_at", "desc");
    }

    // Buscar itens de cada pedido com dados completos dos pratos
    for (const order of orders) {
      const items = await knex("order_items").where({ order_id: order.id });

      // Enriquecer itens com dados completos dos pratos
      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          const plate = await knex("plates")
            .select("id", "name", "image", "description", "category")
            .where({ id: item.plate_id })
            .first();

          return {
            ...item,
            plate: plate || { name: item.plate_name },
          };
        })
      );

      order.items = enrichedItems;
    }

    return response.json(orders);
  }

  // Buscar pedido específico
  async show(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;
    const { role } = request.user;

    logger.info(`Fetching order - ID: ${id}, User: ${user_id}, Role: ${role}`);

    const order = await knex("orders").where({ id }).first();

    if (!order) {
      logger.warn(`Order not found - ID: ${id}`);
      throw new AppError("Pedido não encontrado!");
    }

    logger.info(`Order found - ID: ${id}, Number: ${order.order_number}`);

    // Verificar permissão
    if (role !== "admin" && order.user_id !== user_id) {
      throw new AppError("Você não tem permissão para ver este pedido!", 403);
    }

    // Buscar itens do pedido com informações completas dos pratos
    const items = await knex("order_items").where({ order_id: id });

    // Enriquecer itens com dados completos dos pratos
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const plate = await knex("plates")
          .select("id", "name", "image", "description", "category")
          .where({ id: item.plate_id })
          .first();

        return {
          ...item,
          plate: plate || { name: item.plate_name },
        };
      })
    );

    order.items = enrichedItems;

    // Buscar informações do usuário
    const user = await knex("users")
      .select("id", "name", "email")
      .where({ id: order.user_id })
      .first();
    order.user = user;

    return response.json(order);
  }

  // Atualizar status do pedido (apenas admin)
  async update(request, response) {
    const { id } = request.params;
    const { status } = request.body;
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError("Apenas administradores podem atualizar pedidos!", 403);
    }

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      throw new AppError("Status inválido!");
    }

    const order = await knex("orders").where({ id }).first();

    if (!order) {
      throw new AppError("Pedido não encontrado!");
    }

    await knex("orders").where({ id }).update({
      status,
      updated_at: knex.fn.now(),
    });

    // Enviar notificação ao cliente sobre mudança de status
    try {
      if (order.delivery_phone) {
        const updatedOrder = { ...order, status };
        await WhatsAppService.notifyOrderStatus(updatedOrder, order.delivery_phone);
      }
    } catch (error) {
      logger.error(`Erro ao enviar notificação de status: ${error.message}`);
    }

    return response.json({ message: "Status do pedido atualizado com sucesso!" });
  }

  // Cancelar pedido
  async delete(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;
    const { role } = request.user;

    const order = await knex("orders").where({ id }).first();

    if (!order) {
      throw new AppError("Pedido não encontrado!");
    }

    // Verificar permissão
    if (role !== "admin" && order.user_id !== user_id) {
      throw new AppError("Você não tem permissão para cancelar este pedido!", 403);
    }

    // Só pode cancelar se estiver pendente ou confirmado
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new AppError(
        "Pedido não pode ser cancelado neste status! Entre em contato com o restaurante."
      );
    }

    await knex("orders").where({ id }).update({
      status: "cancelled",
      updated_at: knex.fn.now(),
    });

    return response.json({ message: "Pedido cancelado com sucesso!" });
  }

  // Confirmar pagamento (admin ou webhook)
  async confirmPayment(request, response) {
    const { id } = request.params;
    const { role } = request.user;

    // Apenas admin pode confirmar pagamento manualmente
    if (role !== "admin") {
      throw new AppError("Apenas administradores podem confirmar pagamentos!", 403);
    }

    const order = await knex("orders").where({ id }).first();

    if (!order) {
      throw new AppError("Pedido não encontrado!");
    }

    if (order.payment_status === "confirmed") {
      throw new AppError("Pagamento já foi confirmado!");
    }

    await knex("orders").where({ id }).update({
      payment_status: "confirmed",
      paid_at: knex.fn.now(),
      status: order.status === "pending" ? "confirmed" : order.status,
      updated_at: knex.fn.now(),
    });

    // Enviar notificação ao cliente sobre confirmação de pagamento
    try {
      if (order.delivery_phone) {
        await WhatsAppService.notifyPaymentConfirmed(order, order.delivery_phone);
      }
    } catch (error) {
      logger.error(`Erro ao enviar notificação de pagamento: ${error.message}`);
    }

    return response.json({
      message: "Pagamento confirmado com sucesso!",
      order_number: order.order_number,
    });
  }

  // Buscar pedidos por status de pagamento (admin)
  async byPaymentStatus(request, response) {
    const { status } = request.params;
    const { role } = request.user;

    if (role !== "admin") {
      throw new AppError(
        "Apenas administradores podem ver pedidos por status de pagamento!",
        403
      );
    }

    const validStatuses = ["pending", "paid", "confirmed"];
    if (!validStatuses.includes(status)) {
      throw new AppError("Status de pagamento inválido!");
    }

    const orders = await knex("orders")
      .where({ payment_status: status })
      .orderBy("created_at", "desc");

    // Buscar itens de cada pedido
    for (const order of orders) {
      const items = await knex("order_items").where({ order_id: order.id });
      order.items = items;

      const user = await knex("users")
        .select("id", "name", "email")
        .where({ id: order.user_id })
        .first();
      order.user = user;
    }

    return response.json(orders);
  }
}

module.exports = OrdersController;
