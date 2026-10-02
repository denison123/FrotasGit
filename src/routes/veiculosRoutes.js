const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Importe o controller se for utilizar nas rotas abaixo
// const veiculosController = require('../controllers/veiculosController');

// Listar veículos
router.get('/veiculos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM frota.veiculos ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar veículos:', err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Cadastrar novo veículo / moto
router.post('/veiculos', async (req, res) => {
  const { placa, marca, modelo, ano, km_atual, responsavel, localidade, tipo } = req.body;

  if (!placa || !marca || !modelo || !ano) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO frota.veiculos (placa, marca, modelo, ano, km_atual, status, responsavel, localidade, tipo) 
       VALUES ($1, $2, $3, $4, $5, 'ATIVO', $6, $7, $8) 
       RETURNING *`,
      [
        placa.toUpperCase(),
        marca,
        modelo,
        ano,
        km_atual || 0,
        responsavel || 'Base',
        localidade || 'Belém',
        tipo || 'CARRO'
      ]
    );

    res.status(201).json({ mensagem: 'Veículo cadastrado com sucesso!', veiculo: result.rows[0] });
  } catch (err) {
    console.error('Erro ao cadastrar veículo:', err);
    if (err.code === '23505') {
      return res.status(400).json({ erro: 'Já existe um veículo cadastrado com esta placa.' });
    }
    res.status(500).json({ erro: 'Erro interno ao cadastrar veículo.' });
  }
});

// Buscar detalhes de um veículo específico pelo ID
router.get('/veiculos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const veiculoQuery = await pool.query('SELECT * FROM frota.veiculos WHERE id = $1', [id]);
    if (veiculoQuery.rows.length === 0) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }

    const abastecimentosQuery = await pool.query(
      `SELECT * FROM frota.abastecimentos WHERE veiculo_id = $1 ORDER BY data_abastecimento DESC LIMIT 5`,
      [id]
    );

    let avarias = [];
    try {
      const avariasQuery = await pool.query(
        `SELECT * FROM frota.avarias WHERE veiculo_id = $1 ORDER BY data_registro DESC`,
        [id]
      );
      avarias = avariasQuery.rows;
    } catch (err) {
      avarias = [];
    }

    res.json({
      veiculo: veiculoQuery.rows[0],
      ultimos_abastecimentos: abastecimentosQuery.rows,
      avarias: avarias
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes:', err);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

// Registrar nova avaria
router.post('/avarias', async (req, res) => {
    const { veiculo_id, descricao } = req.body;

    if (!veiculo_id || !descricao) {
        return res.status(400).json({ erro: 'Informe o veículo e a descrição da avaria.' });
    }

    try {
        // 1. Insere a avaria
        await pool.query(
            `INSERT INTO frota.avarias (veiculo_id, descricao, data_registro) 
       VALUES ($1, $2, NOW())`,
            [veiculo_id, descricao]
        );

        // 2. Atualiza o status do veículo para EM_MANUTENCAO
        await pool.query(
            `UPDATE frota.veiculos SET status = 'EM_MANUTENCAO' WHERE id = $1`,
            [veiculo_id]
        );

        res.status(201).json({ mensagem: 'Avaria registrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar avaria:', err);
        res.status(500).json({ erro: 'Erro interno ao registrar avaria.' });
    }
});

// Rota para alternar o status da avaria (PENDENTE <-> SOLUCIONADO)
router.patch('/avarias/:id/status', async (req, res) => {
  const { id } = req.params;
  // Altere de 'SOLUCIONADO' para 'EM_REPARO' caso seu banco só aceite este valor
  const status = req.body.status || 'EM_REPARO'; 

  try {
    const dataSolucao = status === 'EM_REPARO' || status === 'SOLUCIONADO' ? new Date() : null;

    const result = await pool.query(
      `UPDATE frota.avarias 
       SET status = $1, data_solucao = $2 
       WHERE id = $3 
       RETURNING *`,
      [status, dataSolucao, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Avaria não encontrada.' });
    }

    const avariaAtualizada = result.rows[0];

    // Verifica avarias pendentes para liberar o veículo
    const pendentesQuery = await pool.query(
      `SELECT COUNT(*) FROM frota.avarias 
       WHERE veiculo_id = $1 AND status = 'PENDENTE'`,
      [avariaAtualizada.veiculo_id]
    );

    if (parseInt(pendentesQuery.rows[0].count) === 0) {
      await pool.query(
        `UPDATE frota.veiculos SET status = 'ATIVO' WHERE id = $1`,
        [avariaAtualizada.veiculo_id]
      );
    }

    res.json({ mensagem: 'Status da avaria atualizado com sucesso!', avaria: avariaAtualizada });
  } catch (err) {
    console.error('Erro ao atualizar status da avaria:', err);
    res.status(500).json({ erro: 'Erro interno no servidor ao atualizar avaria.' });
  }
});

// Registrar novo abastecimento
// Registrar novo abastecimento
router.post('/abastecimentos', async (req, res) => {
  const { veiculo_id, km_abastecimento, litros, valor_total, tipo_combustivel, posto } = req.body;

  if (!veiculo_id || !km_abastecimento || !litros || !valor_total) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    // 1. Insere na tabela frota.abastecimentos utilizando os nomes de colunas exatos da tabela
    const result = await pool.query(
      `INSERT INTO frota.abastecimentos 
       (veiculo_id, km_abastecimento, litros, valor_total, tipo_combustivel, posto, data_abastecimento) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
       RETURNING *`,
      [
        parseInt(veiculo_id),
        parseInt(km_abastecimento),
        parseFloat(litros),
        parseFloat(valor_total),
        tipo_combustivel || 'Gasolina',
        posto || 'Não informado'
      ]
    );

    // 2. Atualiza o km_atual na tabela frota.veiculos
    await pool.query(
      `UPDATE frota.veiculos SET km_atual = GREATEST(km_atual, $1) WHERE id = $2`,
      [parseInt(km_abastecimento), parseInt(veiculo_id)]
    );

    res.status(201).json({ mensagem: 'Abastecimento registrado com sucesso!', abastecimento: result.rows[0] });
  } catch (err) {
    console.error('Erro ao registrar abastecimento:', err);
    res.status(500).json({ erro: 'Erro interno ao registrar abastecimento.' });
  }
});

module.exports = router;