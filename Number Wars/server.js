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

  // The game page and the Socket.io server are the same site, so same-origin
  // connections need no CORS. In dev we allow any origin for convenience; in
  // production we default to same-origin only, overridable via ALLOWED_ORIGIN
  // (comma-separated list) if the client is ever hosted elsewhere.
  const corsOrigin = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',')
    : dev; // true in dev (allow all); false in prod (same-origin only)
  const io = new Server(httpServer, { cors: { origin: corsOrigin, credentials: false } });

  const { registerHandlers } = require('./server/rooms');
  registerHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
