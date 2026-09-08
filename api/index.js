// api/index.js — Vercel serverless entry point.
// vercel.json me-rewrite semua /api/:path* ke sini.

import { handleRequest } from '../src/server/handler.js';

export default function handler(req, res) {
  return handleRequest(req, res);
}
