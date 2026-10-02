const express = require('express');
const cors = require('cors');
require('dotenv').config();

const veiculosRoutes = require('./src/routes/veiculosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configuração de Middlewares
app.use(cors());
app.use(express.json());

// 2. Servir arquivos do Front-end (pasta public)
app.use(express.static('public'));

// 3. Rotas da API
app.use('/api', veiculosRoutes);

// 4. Inicialização do Servidor (chamada única no final)
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend rodando na rede em: http://10.64.10.100:${PORT}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Erro: A porta ${PORT} já está ocupada.`);
    } else {
        console.error('Erro ao iniciar o servidor:', error.message);
    }
});