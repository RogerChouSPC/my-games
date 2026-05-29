// Custom server: serves Next.js and hosts the Socket.io game server.
require('tsx/cjs'); // allow requiring TypeScript modules (server/rooms.ts)

const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

// Default to production; only run dev mode when started with `npm run dev` (passes --dev).
const dev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, { cors: { origin: '*' } });

  const { registerHandlers } = require('./server/rooms');
  registerHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
