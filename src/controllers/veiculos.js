const db = require('../config/database');

// Listar todos os veículos
exports.listarVeiculos = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM veiculos ORDER BY id ASC;');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar veículos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Obter detalhes de um veículo específico (histórico, avarias, manutenções, abastecimentos)
exports.detalhesVeiculo = async (req, res) => {
  const { id } = req.params;
  try {
    const veiculo = await db.query('SELECT * FROM veiculos WHERE id = $1', [id]);
    if (veiculo.rows.length === 0) {
      return res.status(404).json({ error: 'Veículo não encontrado' });
    }
    const avarias = await db.query('SELECT * FROM avarias WHERE veiculo_id = $1 ORDER BY data_registro DESC', [id]);
    const manutencoes = await db.query('SELECT * FROM manutencoes WHERE veiculo_id = $1 ORDER BY data_manutencao DESC', [id]);
    const abastecimentos = await db.query('SELECT * FROM abastecimentos WHERE veiculo_id = $1 ORDER BY data_abastecimento DESC LIMIT 10', [id]);

    res.json({
      veiculo: veiculo.rows[0],
      avarias: avarias.rows,
      manutencoes: manutencoes.rows,
      ultimos_abastecimentos: abastecimentos.rows
    });
  } catch (error) {
    console.error('Erro ao detalhar veículo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Registrar abastecimento
exports.registrarAbastecimento = async (req, res) => {
  const { veiculo_id, km_abastecimento, litros, valor_total, tipo_combustivel, posto } = req.body;
  try {
    const query = `
      INSERT INTO abastecimentos (veiculo_id, km_abastecimento, litros, valor_total, tipo_combustivel, posto)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
    `;
    const { rows } = await db.query(query, [veiculo_id, km_abastecimento, litros, valor_total, tipo_combustivel, posto]);
    res.status(201).json({ message: 'Abastecimento registrado com sucesso', registro: rows[0] });
  } catch (error) {
    console.error('Erro ao registrar abastecimento:', error);
    res.status(500).json({ error: 'Erro ao salvar abastecimento' });
  }
};