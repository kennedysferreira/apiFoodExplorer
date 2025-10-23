const knex = require("../database/knex");
const AppError = require("../utils/AppError");

class AddressesController {
  // Criar novo endereço
  async create(request, response) {
    const user_id = request.user.id;
    const {
      label,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zip_code,
      reference,
      is_default,
    } = request.body;

    // Validações
    if (!label || !street || !number || !neighborhood || !city || !state || !zip_code) {
      throw new AppError("Preencha todos os campos obrigatórios!");
    }

    try {
      // Se for marcado como padrão, remover padrão dos outros
      if (is_default) {
        await knex("addresses").where({ user_id }).update({ is_default: false });
      }

      const [address_id] = await knex("addresses").insert({
        user_id,
        label,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zip_code,
        reference,
        is_default: is_default || false,
      });

      return response.status(201).json({
        id: address_id,
        message: "Endereço cadastrado com sucesso!",
      });
    } catch (error) {
      throw new AppError("Erro ao cadastrar endereço: " + error.message);
    }
  }

  // Listar endereços do usuário
  async index(request, response) {
    const user_id = request.user.id;

    const addresses = await knex("addresses")
      .where({ user_id })
      .orderBy("is_default", "desc")
      .orderBy("created_at", "desc");

    return response.json(addresses);
  }

  // Buscar endereço específico
  async show(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;

    const address = await knex("addresses").where({ id, user_id }).first();

    if (!address) {
      throw new AppError("Endereço não encontrado!");
    }

    return response.json(address);
  }

  // Atualizar endereço
  async update(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;
    const {
      label,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zip_code,
      reference,
      is_default,
    } = request.body;

    const address = await knex("addresses").where({ id, user_id }).first();

    if (!address) {
      throw new AppError("Endereço não encontrado!");
    }

    // Se for marcado como padrão, remover padrão dos outros
    if (is_default) {
      await knex("addresses")
        .where({ user_id })
        .whereNot({ id })
        .update({ is_default: false });
    }

    await knex("addresses")
      .where({ id })
      .update({
        label: label ?? address.label,
        street: street ?? address.street,
        number: number ?? address.number,
        complement: complement ?? address.complement,
        neighborhood: neighborhood ?? address.neighborhood,
        city: city ?? address.city,
        state: state ?? address.state,
        zip_code: zip_code ?? address.zip_code,
        reference: reference ?? address.reference,
        is_default: is_default ?? address.is_default,
        updated_at: knex.fn.now(),
      });

    return response.json({ message: "Endereço atualizado com sucesso!" });
  }

  // Deletar endereço
  async delete(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;

    const address = await knex("addresses").where({ id, user_id }).first();

    if (!address) {
      throw new AppError("Endereço não encontrado!");
    }

    await knex("addresses").where({ id }).delete();

    // Se era o padrão, marcar outro como padrão
    if (address.is_default) {
      const firstAddress = await knex("addresses")
        .where({ user_id })
        .orderBy("created_at", "desc")
        .first();

      if (firstAddress) {
        await knex("addresses")
          .where({ id: firstAddress.id })
          .update({ is_default: true });
      }
    }

    return response.json({ message: "Endereço deletado com sucesso!" });
  }

  // Definir endereço padrão
  async setDefault(request, response) {
    const { id } = request.params;
    const user_id = request.user.id;

    const address = await knex("addresses").where({ id, user_id }).first();

    if (!address) {
      throw new AppError("Endereço não encontrado!");
    }

    // Remover padrão dos outros
    await knex("addresses").where({ user_id }).update({ is_default: false });

    // Definir como padrão
    await knex("addresses").where({ id }).update({ is_default: true });

    return response.json({ message: "Endereço padrão definido com sucesso!" });
  }
}

module.exports = AddressesController;
