const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// ---- Clave de administrador: cámbiala antes de entregar el trabajo ----
const ADMIN_PASSWORD = 'universidad2026';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const peers = {}; // socket.id -> { nick, ip }

function realIp(socket) {
  // Si Render/Glitch está detrás de un proxy, la IP real viene en x-forwarded-for
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return socket.handshake.address || 'desconocida';
}

function roster() {
  return Object.entries(peers).map(([id, p]) => ({ id, nick: p.nick }));
}

io.on('connection', (socket) => {
  const ip = realIp(socket);
  peers[socket.id] = { nick: 'Anónimo', ip };

  socket.on('presence', (data) => {
    const nick = String((data && data.nick) || 'Anónimo').slice(0, 24);
    peers[socket.id].nick = nick;
    io.emit('roster', roster());
    io.to('admins').emit('admin_update', { id: socket.id, nick, ip: peers[socket.id].ip });
  });

  socket.on('chat', (data) => {
    const text = String((data && data.text) || '').slice(0, 500);
    const nick = peers[socket.id] ? peers[socket.id].nick : 'Anónimo';
    if (!text.trim()) return;
    io.emit('chat', { id: socket.id, nick, text });
  });

  socket.on('admin_login', (pass) => {
    if (pass === ADMIN_PASSWORD) {
      socket.join('admins');
      socket.emit('admin_ok', Object.entries(peers).map(([id, p]) => ({ id, nick: p.nick, ip: p.ip })));
    } else {
      socket.emit('admin_fail');
    }
  });

  io.emit('roster', roster());

  socket.on('disconnect', () => {
    delete peers[socket.id];
    io.emit('roster', roster());
    io.to('admins').emit('admin_left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Chat escuchando en puerto ' + PORT));
