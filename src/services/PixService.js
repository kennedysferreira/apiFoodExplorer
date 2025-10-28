const { createStaticPix, hasError } = require("pix-utils");
const logger = require("../configs/logger");

class PixService {
  /**
   * Gerar código PIX para pagamento
   * @param {Object} params
   * @param {string} params.merchantName - Nome do beneficiário
   * @param {string} params.merchantCity - Cidade do beneficiário
   * @param {string} params.pixKey - Chave PIX
   * @param {string} params.pixKeyType - Tipo da chave (cpf, cnpj, email, phone, evp)
   * @param {number} params.amount - Valor em reais
   * @param {string} params.transactionId - ID único da transação
   * @param {string} params.description - Descrição opcional
   * @returns {Promise<{pixCopyPaste: string, qrCodeBase64: string}>}
   */
  async generatePixPayment({
    merchantName,
    merchantCity,
    pixKey,
    pixKeyType,
    amount,
    transactionId,
    description = "Pedido Sushihana",
  }) {
    try {
      // Truncar campos para respeitar limites do padrão PIX
      const truncatedMerchantName = merchantName.substring(0, 25);
      const truncatedMerchantCity = merchantCity.substring(0, 15);
      const truncatedDescription = description.substring(0, 72);
      const truncatedTxid = transactionId.substring(0, 25);

      // Criar payload PIX usando pix-utils
      const pix = createStaticPix({
        merchantName: truncatedMerchantName,
        merchantCity: truncatedMerchantCity,
        pixKey,
        infoAdicional: truncatedDescription,
        transactionAmount: parseFloat(amount),
        txid: truncatedTxid,
      });

      // Verificar se houve erro
      if (hasError(pix)) {
        throw new Error(`Erro ao criar payload PIX: ${pix.message || 'Dados inválidos'}`);
      }

      // Gerar código copia e cola (BRCode)
      const pixCopyPaste = pix.toBRCode();

      // Gerar QR Code em base64
      const qrCodeBase64 = await pix.toImage();

      return {
        pixCopyPaste,
        qrCodeBase64,
      };
    } catch (error) {
      throw new Error(`Erro ao gerar PIX: ${error.message}`);
    }
  }

  /**
   * Gerar PIX usando dados do ambiente
   * @param {Object} params
   * @param {number} params.amount - Valor em reais
   * @param {string} params.orderId - ID do pedido
   * @param {string} params.description - Descrição opcional
   * @returns {Promise<{pixCopyPaste: string, qrCodeBase64: string}>}
   */
  async generateOrderPix({ amount, orderId, description }) {
    try {
      // Validar inputs
      if (!amount || amount <= 0) {
        throw new Error("Valor inválido para geração de PIX");
      }

      if (!orderId) {
        throw new Error("ID do pedido é obrigatório");
      }

      const merchantName = process.env.PIX_MERCHANT_NAME || "Sushihana";
      const merchantCity = process.env.PIX_MERCHANT_CITY || "Sao Paulo";
      const pixKey = process.env.PIX_KEY;
      const pixKeyType = process.env.PIX_KEY_TYPE || "cnpj";

      if (!pixKey) {
        logger.error("Chave PIX não configurada no servidor!");
        throw new Error("Chave PIX não configurada no servidor!");
      }

      logger.info(`Gerando PIX para pedido ${orderId}, valor: R$ ${amount}`);

      const pixData = await this.generatePixPayment({
        merchantName,
        merchantCity,
        pixKey,
        pixKeyType,
        amount,
        transactionId: orderId,
        description: description || `Pedido #${orderId}`,
      });

      logger.info(`PIX gerado com sucesso para pedido ${orderId}`);

      return pixData;
    } catch (error) {
      logger.error(`Erro ao gerar PIX para pedido ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validar se um código PIX é válido
   * @param {string} pixCode - Código PIX copia e cola
   * @returns {boolean}
   */
  validatePixCode(pixCode) {
    try {
      // Código PIX válido começa com "00020101" ou "00020126"
      if (!pixCode || typeof pixCode !== "string") {
        return false;
      }

      return (
        pixCode.startsWith("00020101") ||
        pixCode.startsWith("00020126") ||
        pixCode.startsWith("00020104")
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Calcular tempo de expiração do PIX (30 minutos por padrão)
   * @param {number} minutes - Minutos até expirar
   * @returns {Date}
   */
  calculatePixExpiration(minutes = 30) {
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + minutes);
    return expirationDate;
  }

  /**
   * Verificar se um PIX expirou
   * @param {Date|string} expirationDate - Data de expiração
   * @returns {boolean}
   */
  isPixExpired(expirationDate) {
    if (!expirationDate) return false;

    const now = new Date();
    const expiration = new Date(expirationDate);

    return now > expiration;
  }

  /**
   * Formatar valor para PIX (2 casas decimais)
   * @param {number} value - Valor a formatar
   * @returns {number}
   */
  formatPixValue(value) {
    return parseFloat(parseFloat(value).toFixed(2));
  }
}

module.exports = new PixService();
