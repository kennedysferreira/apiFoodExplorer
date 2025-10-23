const twilio = require("twilio");
const logger = require("../configs/logger");

class WhatsAppService {
  constructor() {
    this.enabled = process.env.WHATSAPP_ENABLED === "true";
    this.client = null;

    if (this.enabled) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (accountSid && authToken) {
        this.client = twilio(accountSid, authToken);
        logger.info("WhatsApp Service inicializado com sucesso");
      } else {
        logger.warn("Credenciais Twilio não configuradas - WhatsApp desabilitado");
        this.enabled = false;
      }
    } else {
      logger.info("WhatsApp Service desabilitado por configuração");
    }
  }

  /**
   * Enviar mensagem WhatsApp
   * @param {string} to - Número de destino (formato: +5511999999999)
   * @param {string} message - Mensagem a ser enviada
   * @returns {Promise<Object|null>}
   */
  async sendMessage(to, message) {
    if (!this.enabled || !this.client) {
      logger.info("WhatsApp desabilitado - mensagem não enviada");
      return null;
    }

    try {
      const from = process.env.TWILIO_WHATSAPP_FROM;

      if (!from) {
        throw new Error("TWILIO_WHATSAPP_FROM não configurado");
      }

      // Garantir formato correto do número
      const formattedTo = to.startsWith("whatsapp:")
        ? to
        : `whatsapp:${to.replace(/\s+/g, "")}`;

      const result = await this.client.messages.create({
        from,
        to: formattedTo,
        body: message,
      });

      logger.info(`WhatsApp enviado para ${to} - SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Erro ao enviar WhatsApp para ${to}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notificar restaurante sobre novo pedido
   * @param {Object} order - Dados do pedido
   * @returns {Promise<Object|null>}
   */
  async notifyNewOrder(order) {
    const restaurantNumber = process.env.RESTAURANT_WHATSAPP;

    if (!restaurantNumber) {
      logger.warn("RESTAURANT_WHATSAPP não configurado");
      return null;
    }

    const message = this.formatNewOrderMessage(order);
    return this.sendMessage(restaurantNumber, message);
  }

  /**
   * Notificar cliente sobre mudança de status do pedido
   * @param {Object} order - Dados do pedido
   * @param {string} customerPhone - Telefone do cliente
   * @returns {Promise<Object|null>}
   */
  async notifyOrderStatus(order, customerPhone) {
    if (!customerPhone) {
      logger.warn("Telefone do cliente não informado");
      return null;
    }

    const message = this.formatOrderStatusMessage(order);
    return this.sendMessage(customerPhone, message);
  }

  /**
   * Notificar cliente sobre confirmação de pagamento
   * @param {Object} order - Dados do pedido
   * @param {string} customerPhone - Telefone do cliente
   * @returns {Promise<Object|null>}
   */
  async notifyPaymentConfirmed(order, customerPhone) {
    if (!customerPhone) {
      logger.warn("Telefone do cliente não informado");
      return null;
    }

    const message = this.formatPaymentConfirmedMessage(order);
    return this.sendMessage(customerPhone, message);
  }

  /**
   * Formatar mensagem de novo pedido para o restaurante
   * @param {Object} order - Dados do pedido
   * @returns {string}
   */
  formatNewOrderMessage(order) {
    const restaurantName = process.env.RESTAURANT_NAME || "Sushihana";
    const paymentMethodText = {
      cash: "💵 Dinheiro",
      pix: "💳 PIX",
      card: "💳 Cartão",
    };

    const deliveryTypeText = {
      delivery: "🛵 Delivery",
      pickup: "🏪 Retirada",
    };

    let message = `🔔 *NOVO PEDIDO - ${restaurantName}*\n\n`;
    message += `📋 *Pedido:* ${order.order_number}\n`;
    message += `👤 *Cliente:* ${order.user_name}\n`;
    message += `${deliveryTypeText[order.delivery_type] || order.delivery_type}\n`;
    message += `${paymentMethodText[order.payment_method] || order.payment_method}\n\n`;

    message += `*Itens do Pedido:*\n`;
    order.items.forEach((item) => {
      message += `• ${item.quantity}x ${item.plate_name} - R$ ${parseFloat(
        item.subtotal
      ).toFixed(2)}\n`;
    });

    message += `\n💰 *Total:* R$ ${parseFloat(order.total).toFixed(2)}\n`;

    if (order.delivery_type === "delivery" && order.delivery_address) {
      message += `\n📍 *Endereço:*\n${order.delivery_address}\n`;
      if (order.delivery_notes) {
        message += `📝 *Observações:* ${order.delivery_notes}\n`;
      }
    }

    if (order.delivery_phone) {
      message += `\n📞 *Contato:* ${order.delivery_phone}\n`;
    }

    message += `\n⏱️ *Tempo estimado:* ${order.estimated_time} min`;

    return message;
  }

  /**
   * Formatar mensagem de status do pedido para o cliente
   * @param {Object} order - Dados do pedido
   * @returns {string}
   */
  formatOrderStatusMessage(order) {
    const restaurantName = process.env.RESTAURANT_NAME || "Sushihana";
    const statusText = {
      pending: "⏳ Aguardando confirmação",
      confirmed: "✅ Confirmado",
      preparing: "👨‍🍳 Em preparação",
      ready: "✨ Pronto",
      out_for_delivery: "🛵 Saiu para entrega",
      delivered: "🎉 Entregue",
      cancelled: "❌ Cancelado",
    };

    let message = `*${restaurantName}*\n\n`;
    message += `📋 *Pedido:* ${order.order_number}\n`;
    message += `${statusText[order.status] || order.status}\n\n`;

    if (order.status === "confirmed") {
      message += `Seu pedido foi confirmado e entrará em preparação em breve!\n`;
      message += `⏱️ Tempo estimado: ${order.estimated_time} min`;
    } else if (order.status === "preparing") {
      message += `Seu pedido está sendo preparado com todo carinho! 🍱`;
    } else if (order.status === "ready") {
      if (order.delivery_type === "delivery") {
        message += `Seu pedido está pronto e sairá para entrega em instantes!`;
      } else {
        message += `Seu pedido está pronto para retirada! 🎉`;
      }
    } else if (order.status === "out_for_delivery") {
      message += `Seu pedido saiu para entrega!\nEm breve estará aí! 🛵`;
    } else if (order.status === "delivered") {
      message += `Seu pedido foi entregue!\nBom apetite! 😋🍱\n\n`;
      message += `Obrigado pela preferência!`;
    }

    return message;
  }

  /**
   * Formatar mensagem de pagamento confirmado
   * @param {Object} order - Dados do pedido
   * @returns {string}
   */
  formatPaymentConfirmedMessage(order) {
    const restaurantName = process.env.RESTAURANT_NAME || "Sushihana";

    let message = `✅ *Pagamento Confirmado!*\n\n`;
    message += `*${restaurantName}*\n`;
    message += `📋 *Pedido:* ${order.order_number}\n`;
    message += `💰 *Valor:* R$ ${parseFloat(order.total).toFixed(2)}\n\n`;
    message += `Seu pagamento foi confirmado com sucesso!\n`;
    message += `Seu pedido entrará em preparação em breve. 👨‍🍳\n\n`;
    message += `⏱️ Tempo estimado: ${order.estimated_time} min`;

    return message;
  }

  /**
   * Verificar se o serviço está habilitado
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = new WhatsAppService();
