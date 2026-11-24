import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = import.meta.dirname;
const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'studio-maria-beauty.sqlite');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const HASH_ITERATIONS = 310000;
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
const SESSION_COOKIE = 'maria_admin_session';
const deriveKey = promisify(pbkdf2);
const catalog = [
  ['Alongamento molde F1', 75], ['Soft gel', 75], ['Blindagem', 50],
  ['Blindagem nos pés', 40], ['Esmaltação em gel', 35], ['Remoção de gel', 20],
  ['Reposição cada unha', 10], ['Troca de formato', 10],
  ['Manicure tradicional', 35], ['Pedicure', 35], ['Manicure e pedicure', 60],
];
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const sessions = new Map();
const loginFailures = new Map();

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS administrators (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt BLOB NOT NULL,
    password_hash BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS prices (
    service TEXT PRIMARY KEY,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    sold_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const seedPrices = db.prepare('INSERT OR IGNORE INTO prices (service, amount_cents) VALUES (?, ?)');
for (const [service, amount] of catalog) seedPrices.run(service, amount * 100);
if (!db.prepare('SELECT id FROM administrators WHERE id = 1').get()) {
  const username = process.env.ADMIN_INITIAL_USERNAME;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!username || !password || password.length < 12) {
    throw new Error('Primeiro início: informe ADMIN_INITIAL_USERNAME e ADMIN_INITIAL_PASSWORD (mínimo 12 caracteres) no ambiente.');
  }
  const salt = randomBytes(16);
  const hash = await deriveKey(password, salt, HASH_ITERATIONS, 32, 'sha256');
  db.prepare('INSERT INTO administrators (id, username, password_salt, password_hash) VALUES (1, ?, ?, ?)').run(username, salt, hash);
  console.log(`Administrador inicial "${username}" criado; a senha foi gravada no SQLite somente como hash.`);
}
delete process.env.ADMIN_INITIAL_USERNAME;
delete process.env.ADMIN_INITIAL_PASSWORD;

const json = (res, status, value, extraHeaders = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders });
  res.end(JSON.stringify(value));
};
const readJson = async (req) => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64 * 1024) throw Object.assign(new Error('Requisição muito grande.'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
};
const safeOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
};
const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter((pair) => pair.length === 2));
const getSession = (req) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const session = token && sessions.get(token);
  if (!session || session.expires < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return { token, ...session };
};
const requireAdmin = (req, res) => {
  const session = getSession(req);
  if (!session) json(res, 401, { error: 'Faça login para continuar.' });
  return session;
};
const sessionCookie = (token, maxAgeSeconds) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const verifyPassword = async (password, salt, expectedHash) => {
  const actual = await deriveKey(password, salt, HASH_ITERATIONS, expectedHash.length, 'sha256');
  return timingSafeEqual(actual, expectedHash);
};
const handleApi = async (req, res, url) => {
  const method = req.method;
  if (method !== 'GET' && !safeOrigin(req)) return json(res, 403, { error: 'Origem da requisição não permitida.' });

  if (method === 'GET' && url.pathname === '/api/prices') {
    return json(res, 200, { prices: db.prepare('SELECT service, amount_cents FROM prices ORDER BY rowid').all().map((row) => ({ service: row.service, price: row.amount_cents / 100 })) });
  }

  if (method === 'POST' && url.pathname === '/api/auth/login') {
    const address = req.socket.remoteAddress || 'unknown';
    const failures = loginFailures.get(address) || { count: 0, until: 0 };
    if (failures.until > Date.now() && failures.count >= 5) return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    const body = await readJson(req);
    const admin = db.prepare('SELECT username, password_salt, password_hash FROM administrators WHERE username = ?').get(String(body.username || '').trim());
    const accepted = admin && typeof body.password === 'string' && await verifyPassword(body.password, admin.password_salt, admin.password_hash);
    if (!accepted) {
      const next = failures.until > Date.now() ? failures : { count: 0, until: Date.now() + 15 * 60 * 1000 };
      next.count += 1;
      loginFailures.set(address, next);
      return json(res, 401, { error: 'Usuário ou senha incorretos.' });
    }
    loginFailures.delete(address);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { username: admin.username, expires: Date.now() + SESSION_MAX_AGE });
    return json(res, 200, { username: admin.username }, { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE / 1000) });
  }

  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    const session = getSession(req);
    if (session) sessions.delete(session.token);
    return json(res, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0) });
  }

  if (method === 'GET' && url.pathname === '/api/admin/session') {
    const session = requireAdmin(req, res);
    if (!session) return;
    return json(res, 200, { username: session.username });
  }

  if (method === 'POST' && url.pathname === '/api/admin/password') {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await readJson(req);
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string' || body.newPassword.length < 12) return json(res, 400, { error: 'A nova senha deve ter pelo menos 12 caracteres.' });
    const admin = db.prepare('SELECT password_salt, password_hash FROM administrators WHERE id = 1').get();
    if (!await verifyPassword(body.currentPassword, admin.password_salt, admin.password_hash)) return json(res, 403, { error: 'Senha atual incorreta.' });
    const salt = randomBytes(16);
    const hash = await deriveKey(body.newPassword, salt, HASH_ITERATIONS, 32, 'sha256');
    db.prepare('UPDATE administrators SET password_salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(salt, hash);
    return json(res, 200, { ok: true });
  }

  if (method === 'PUT' && url.pathname === '/api/admin/prices') {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await readJson(req);
    if (!body.prices || typeof body.prices !== 'object') return json(res, 400, { error: 'Lista de preços inválida.' });
    const update = db.prepare('UPDATE prices SET amount_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE service = ?');
    db.exec('BEGIN');
    try {
      for (const [service] of catalog) {
        const price = Number(body.prices[service]);
        if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error(`Valor inválido para ${service}.`);
        update.run(Math.round(price * 100), service);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      return json(res, 400, { error: error.message });
    }
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/admin/dashboard' && method === 'GET') {
    const session = requireAdmin(req, res);
    if (!session) return;
    const sales = db.prepare('SELECT id, service, amount_cents, sold_at FROM sales ORDER BY sold_at DESC, id DESC').all().map((row) => ({ id: row.id, service: row.service, amount: row.amount_cents / 100, createdAt: row.sold_at }));
    const total = sales.reduce((sum, sale) => sum + sale.amount, 0);
    const grouped = new Map();
    for (const sale of sales) {
      const item = grouped.get(sale.service) || { service: sale.service, count: 0, total: 0 };
      item.count += 1;
      item.total += sale.amount;
      grouped.set(sale.service, item);
    }
    return json(res, 200, { sales, summary: { revenue: total, count: sales.length, average: sales.length ? total / sales.length : 0, byService: [...grouped.values()].sort((a, b) => b.total - a.total) } });
  }

  if (url.pathname === '/api/admin/sales' && method === 'POST') {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = await readJson(req);
    const service = String(body.service || '');
    const amount = Number(body.amount);
    const soldAt = new Date(body.createdAt);
    if (!catalog.some(([name]) => name === service) || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || Number.isNaN(soldAt.getTime())) return json(res, 400, { error: 'Dados da venda inválidos.' });
    const result = db.prepare('INSERT INTO sales (service, amount_cents, sold_at) VALUES (?, ?, ?)').run(service, Math.round(amount * 100), soldAt.toISOString());
    return json(res, 201, { id: Number(result.lastInsertRowid) });
  }

  const deleteMatch = url.pathname.match(/^\/api\/admin\/sales\/(\d+)$/);
  if (deleteMatch && method === 'DELETE') {
    const session = requireAdmin(req, res);
    if (!session) return;
    db.prepare('DELETE FROM sales WHERE id = ?').run(Number(deleteMatch[1]));
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Rota não encontrada.' });
};

const serveStatic = (req, res, pathname) => {
  let relativePath;
  if (pathname === '/' || pathname === '/index.html') relativePath = 'index.html';
  else if (['/style.css', '/script.js'].includes(pathname)) relativePath = pathname.slice(1);
  else if (pathname.startsWith('/fotos/')) relativePath = pathname.slice(1);
  else return json(res, 404, { error: 'Arquivo não encontrado.' });
  const file = resolve(ROOT, relativePath);
  if (!file.startsWith(`${ROOT}${sep}`) || !existsSync(file)) return json(res, 404, { error: 'Arquivo não encontrado.' });
  res.writeHead(200, { 'content-type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin' });
  res.end(readFileSync(file));
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método não permitido.' });
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Erro interno do servidor.' });
    else res.destroy();
  }
});
server.listen(PORT, HOST, () => console.log(`Studio Maria Beauty disponível em http://${HOST}:${PORT}`));
for (const token of sessions.keys()) sessions.delete(token);
process.on('SIGINT', () => { server.close(() => { db.close(); process.exit(0); }); });
process.on('SIGTERM', () => { server.close(() => { db.close(); process.exit(0); }); });
