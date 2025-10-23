const { Pix } = require("pix-utils");
const QRCode = require("qrcode");

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
      // Criar payload PIX
      const pix = new Pix({
        merchantName,
        merchantCity,
        key: pixKey,
        keyType: pixKeyType || "cnpj",
        transactionId,
        message: description,
      });

      // Definir valor
      pix.setAmount(parseFloat(amount).toFixed(2));

      // Gerar código copia e cola (EMV)
      const pixCopyPaste = pix.getPayload();

      // Gerar QR Code em base64
      const qrCodeBase64 = await QRCode.toDataURL(pixCopyPaste, {
        errorCorrectionLevel: "H",
        type: "image/png",
        width: 300,
        margin: 2,
      });

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
    const merchantName = process.env.PIX_MERCHANT_NAME || "Sushihana";
    const merchantCity = process.env.PIX_MERCHANT_CITY || "Sao Paulo";
    const pixKey = process.env.PIX_KEY;
    const pixKeyType = process.env.PIX_KEY_TYPE || "cnpj";

    if (!pixKey) {
      throw new Error("Chave PIX não configurada no servidor!");
    }

    return this.generatePixPayment({
      merchantName,
      merchantCity,
      pixKey,
      pixKeyType,
      amount,
      transactionId: orderId,
      description: description || `Pedido #${orderId}`,
    });
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
}

module.exports = new PixService();
