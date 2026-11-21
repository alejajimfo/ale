// Utilidades compartidas por las funciones de ALENA (Neon + Netlify)
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export class ConfigError extends Error {}

/* ---------- Pasos de la línea de tiempo ---------- */
export const PASOS = {
  decoracion: ['Solicitud recibida', 'Cotización enviada', 'Reserva confirmada', 'Diseño y preparación', 'Montaje', 'Evento', 'Desmontaje', 'Finalizado'],
  alquiler: ['Solicitud recibida', 'Cotización enviada', 'Reserva confirmada', 'Piezas listas', 'Entrega de piezas', 'Evento', 'Devolución y revisión', 'Finalizado'],
};

/* ---------- Base de datos ---------- */
let _sql;
export function sql() {
  if (!_sql) {
    const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    if (!url) throw new ConfigError('Falta la variable DATABASE_URL (cadena de conexión de Neon).');
    _sql = neon(url);
  }
  return _sql;
}
export const q = (text, params = []) => sql().query(text, params);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pedidos (
    id serial PRIMARY KEY,
    nombre text NOT NULL,
    cedula text,
    telefono text,
    modalidad text NOT NULL DEFAULT 'alquiler',
    tipo_evento text,
    fecha_evento date,
    lugar text,
    paso int NOT NULL DEFAULT 0,
    historial jsonb NOT NULL DEFAULT '{}'::jsonb,
    mensaje text,
    detalle text,
    total int NOT NULL DEFAULT 0,
    abonado int NOT NULL DEFAULT 0,
    deposito int NOT NULL DEFAULT 0,
    notas_internas text,
    visible boolean NOT NULL DEFAULT false,
    creado timestamptz NOT NULL DEFAULT now(),
    actualizado timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pedidos_cedula_idx ON pedidos (cedula)`,
  `CREATE INDEX IF NOT EXISTS pedidos_telefono_idx ON pedidos (telefono)`,
  `CREATE TABLE IF NOT EXISTS documentos (
    id serial PRIMARY KEY,
    pedido_id int NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    tipo text NOT NULL,
    categoria text NOT NULL DEFAULT 'otro',
    publico boolean NOT NULL DEFAULT true,
    tam int NOT NULL DEFAULT 0,
    data bytea NOT NULL,
    creado timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS documentos_pedido_idx ON documentos (pedido_id)`,
  `CREATE TABLE IF NOT EXISTS ajustes (clave text PRIMARY KEY, valor jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS intentos (
    id bigserial PRIMARY KEY,
    ip text NOT NULL,
    clase text NOT NULL,
    en timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS intentos_idx ON intentos (ip, clase, en)`,
];

let _ready;
export function ensureSchema() {
  if (!_ready) {
    _ready = (async () => { for (const s of SCHEMA) await q(s); })().catch((e) => { _ready = null; throw e; });
  }
  return _ready;
}

export async function getAjustes() {
  const rows = await q(`SELECT clave, valor FROM ajustes WHERE clave IN ('portal','instagram')`);
  const a = { portal: false, instagram: [] };
  for (const r of rows) a[r.clave] = r.valor;
  a.portal = a.portal === true;
  if (!Array.isArray(a.instagram)) a.instagram = [];
  return a;
}
export async function setAjuste(clave, valor) {
  await q(`INSERT INTO ajustes (clave, valor) VALUES ($1, $2::jsonb)
           ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`, [clave, JSON.stringify(valor)]);
}

/* ---------- Respuestas ---------- */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export function fallo(e) {
  if (e instanceof ConfigError) return json({ error: e.message }, 500);
  console.error(e);
  return json({ error: 'Error del servidor. Intenta de nuevo en un momento.' }, 500);
}
export const ipDe = (req, ctx) => (ctx && ctx.ip) || req.headers.get('x-nf-client-connection-ip') || 'desconocida';

/* ---------- Tokens firmados (HS256) ---------- */
function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new ConfigError('Falta JWT_SECRET (mínimo 16 caracteres).');
  return s;
}
const firma = (body) => crypto.createHmac('sha256', secreto()).update(body).digest('base64url');

export function firmar(payload, minutos) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + minutos * 60 })).toString('base64url');
  return `${body}.${firma(body)}`;
}
export function verificar(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const esperado = Buffer.from(firma(body));
  const recibido = Buffer.from(sig);
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp && p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
export const tokenDe = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

export function igual(a, b) {
  const h = (x) => crypto.createHash('sha256').update(String(x)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
}

/* ---------- Límite de intentos ---------- */
export async function limitado(ip, clase, max, minutos) {
  const r = await q(`SELECT count(*)::int AS n FROM intentos WHERE ip = $1 AND clase = $2 AND en > now() - make_interval(mins => $3::int)`, [ip, clase, minutos]);
  return r[0].n >= max;
}
export async function anotar(ip, clase) {
  await q(`INSERT INTO intentos (ip, clase) VALUES ($1, $2)`, [ip, clase]);
  await q(`DELETE FROM intentos WHERE en < now() - interval '2 days'`);
}

/* ---------- Normalización ---------- */
// Deja solo dígitos; si viene un celular con 57 delante (12 dígitos) le quita el 57.
export function soloDigitos(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}
export const refDe = (id) => 'AL-' + String(id).padStart(4, '0');

/* ---------- Pedido -> objeto JSON ---------- */
export const COLS_PEDIDO = `id, nombre, cedula, telefono, modalidad, tipo_evento,
  to_char(fecha_evento, 'YYYY-MM-DD') AS fecha_evento, lugar, paso, historial, mensaje, detalle,
  total, abonado, deposito, notas_internas, visible`;

export function paraCliente(p, docs = []) {
  const pasos = PASOS[p.modalidad] || PASOS.alquiler;
  return {
    id: p.id,
    ref: refDe(p.id),
    nombre: p.nombre,
    modalidad: p.modalidad,
    tipo_evento: p.tipo_evento,
    fecha_evento: p.fecha_evento,
    lugar: p.lugar,
    paso: p.paso,
    pasos,
    fechas: p.historial || {},
    mensaje: p.mensaje,
    detalle: p.detalle,
    total: p.total,
    abonado: p.abonado,
    deposito: p.deposito,
    docs: docs.filter((d) => d.pedido_id === p.id).map((d) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo, categoria: d.categoria, tam: d.tam })),
  };
}
