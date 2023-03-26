// Importar as dependências necessárias
const express = require('express');
const bodyParser = require('body-parser');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const logger = require('morgan');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// Configurar o ambiente com o dotenv
dotenv.config();

const sessionName = process.env.session || 'default';

// Definir a porta a ser usada
const port = process.env.PORT || 3000;

// Configurar o logger
const app = express();
app.use(logger('dev'));

// Configurar o middleware de análise de corpo
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Conectar-se ao banco de dados MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Conectado ao MongoDB');
  const store = new MongoStore({ mongoose: mongoose });

  // Criar o cliente do WhatsApp
  const client = new Client({
    authStrategy: new RemoteAuth({
      store: store,
      backupSyncIntervalMs: 300000
    })
  });

  // Gerar o QR Code e exibi-lo no console
  client.on('qr', (qr) => {
    if(!store.sessionExists({session: sessionName})){
    console.log('QR Code gerado!');
    qrcode.generate(qr, { small: true });}
  });

  // Salvar a sessão no banco de dados após autenticado
  client.on('authenticated', async (session) => {
    console.log('Autenticado!');
    await store.save({session: sessionName});
  });
  client.on('remote_session_saved', () => {
    console.log('Sessão remota salva no banco!');
  });
  client.on("ready", ()=>{
    console.log("Pronto!");
  })
  // Iniciar o cliente do WhatsApp
  client.initialize();

  // Gerar rotas para todas as funções públicas do cliente do WhatsApp Web
  const routes = express.Router();
  Object.getOwnPropertyNames(Object.getPrototypeOf(client)).forEach((methodName) => {
    const method = client[methodName];
    if (typeof method === 'function' && !methodName.startsWith('_')) {
      routes.post(`/${methodName}`, async (req, res) => {
        try {
          const result = await method.apply(client, req.body);
          res.status(200).json({ result });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
    }
  });

  // Definir a rota padrão
  app.use('/', routes);

  // Definir o handler de erro
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Erro interno do servidor!');
  });

  // Iniciar o servidor
  app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
  });
}).catch((err) => {
  console.error(`Erro ao conectar ao MongoDB: ${err.message}`);
});
