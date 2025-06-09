require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const http = require('http');
const { WebSocketServer } = require('ws');

const tvRoutes = require('./routes/tvRoutes');
const authController = require('./controllers/authController');

const app = express();
const server = http.createServer(app); // necessário para o WebSocket
const wss = new WebSocketServer({ server }); // WebSocket

const tvClients = {};     // { tvCode: [ws1, ws2, ...] }
const adminClients = new Set(); // conexões WebSocket dos admins

// Conexão WebSocket
wss.on('connection', (ws, req) => {
  if (req.url.startsWith('/ws/tv/')) {
    const match = req.url.match(/\/ws\/tv\/(.+)/);
    const tvCode = match?.[1];
    if (!tvCode) {
      ws.close();
      return;
    }

    console.log(`TV ${tvCode} conectada via WebSocket`);

    if (!tvClients[tvCode]) tvClients[tvCode] = [];
    tvClients[tvCode].push(ws);

    // Notifica admins que a TV ficou online
    notifyAdmins({ type: 'status', code: tvCode, status: 'online' });

    ws.on('close', () => {
      tvClients[tvCode] = tvClients[tvCode].filter(client => client !== ws);
      if (tvClients[tvCode].length === 0) {
        delete tvClients[tvCode];
        // Notifica admins que a TV ficou offline
        notifyAdmins({ type: 'status', code: tvCode, status: 'offline' });
      }
    });

  } else if (req.url === '/ws/admin/tvs-status') {
    console.log('Admin conectado ao WebSocket de status das TVs');
    adminClients.add(ws);

    // Envia status atual das TVs online para o admin
    Object.keys(tvClients).forEach(tvCode => {
      if (tvClients[tvCode].length > 0) {
        ws.send(JSON.stringify({ type: 'status', code: tvCode, status: 'online' }));
      }
    });

    ws.on('close', () => {
      adminClients.delete(ws);
      console.log('Admin desconectado do WebSocket de status das TVs');
    });

  } else {
    // URL não reconhecida, fecha conexão
    ws.close();
  }
});

// Função para notificar todos os admins conectados
function notifyAdmins(data) {
  const msg = JSON.stringify(data);
  adminClients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  });
}

// Função para notificar TVs específicas (se precisar)
function notifyTV(tvCode, message = 'update') {
  if (tvClients[tvCode]) {
    tvClients[tvCode].forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }
}
module.exports.notifyTV = notifyTV; // para importar em controllers

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'sua_chave_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
}));

app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  req.user = req.session.user;
  next();
};

// Rotas de autenticação
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/me', authController.getCurrentUser);

// Rotas protegidas (pode usar requireAuth dentro de tvRoutes se necessário)
app.use('/api', tvRoutes);

// Arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use('/admin', express.static(path.join(__dirname, '../public/admin'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.get('/admin/css/*', (req, res) => {
  const filePath = path.join(__dirname, '../public/admin/css', req.params[0]);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath, { headers: { 'Content-Type': 'text/css' } });
  } else {
    res.status(404).end();
  }
});

app.use('/player', express.static(path.join(__dirname, '../public/player')));

app.get('/p/:code', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player/index.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

// Rota pública para verificação de status (ping)
app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player/index.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/tvs.html'));
});

// Inicia servidor
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`Player exemplo: http://localhost:${PORT}/p/CODIGO_DA_TV`);
});
