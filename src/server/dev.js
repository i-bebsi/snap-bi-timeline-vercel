// dev.js — server lokal untuk development (bukan dipakai di Vercel).
import 'dotenv/config';
import { createServer } from 'node:http';
import { handleRequest } from './handler.js';

const port = Number(process.env.PORT || 3000);
const server = createServer((req, res) => {
  handleRequest(req, res).catch((e) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ ok: false, error: e && e.message ? e.message : String(e) }));
  });
});

server.listen(port, () => {
  console.log('SNAP BI Timeline dev server → http://localhost:' + port);
});
