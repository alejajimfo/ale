// Recogida programada (alquiler) y opiniones con estrellas moderadas por el equipo.
// No modifica util.mjs: usa sus utilidades y crea sus propias tablas/columnas.
//
// GET  /api/extras                        -> opiniones APROBADAS (público)
// POST /api/extras {accion} + Bearer admin   : recogidas | recogida_guardar | opiniones_listar | opinion_estado | opinion_eliminar
//                                             codigos_listar | codigo_crear | codigo_editar | codigo_eliminar
// POST /api/extras {accion} + Bearer cliente : mio | opinar
// POST /api/extras {accion} sin token        : codigo_validar
import { ensureSchema, fallo, json, q, tokenDe, verificar } from '../lib/util.mjs';

const PASO_MIN_OPINION = 5; // alquiler: desde «Evento» en adelante el cliente puede opinar

let _listo;
function esquemaExtra() {
  if (!_listo) {
    _listo = (async () => {
      await ensureSchema();
      await q(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recogida text`);
      await q(`CREATE TABLE IF NOT EXISTS opiniones (
        id serial PRIMARY KEY,
        pedido_id int NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
        nombre text NOT NULL,
        evento text,
        estrellas int NOT NULL,
        texto text NOT NULL,
        aprobada boolean NOT NULL DEFAULT false,
        creado timestamptz NOT NULL DEFAULT now(),
        actualizado timestamptz NOT NULL DEFAULT now()
      )`);
      // Precios de descuento privados del equipo (nunca se envían a clientes ni al público)
      await q(`CREATE TABLE IF NOT EXISTS precios_desc (nombre text PRIMARY KEY, precio int NOT NULL)`);
      // Códigos de descuento: valor fijo en COP que el equipo crea y el cliente puede canjear en el carrito
      await q(`CREATE TABLE IF NOT EXISTS codigos_descuento (
        id serial PRIMARY KEY,
        codigo text NOT NULL UNIQUE,
        valor int NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        descripcion text,
        creado timestamptz NOT NULL DEFAULT now()
      )`);
    })().catch((e) => { _listo = null; throw e; });
  }
  return _listo;
}

const texto = (v, max) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };
const ids = (a) => (Array.isArray(a) ? a : []).map((x) => parseInt(x, 10)).filter(Number.isInteger).join(',');
// "María Fernanda Pérez Gómez" -> "María P."
function nombrePublico(n) {
  const p = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'Cliente';
  return p.length > 2 ? `${p[0]} ${p[p.length - 2][0].toUpperCase()}.` : p.length === 2 ? `${p[0]} ${p[1][0].toUpperCase()}.` : p[0];
}

async function publicas() {
  const r = await q(`SELECT nombre, evento, estrellas, texto FROM opiniones WHERE aprobada ORDER BY actualizado DESC LIMIT 60`);
  return json({ opiniones: r.map((o) => ({ n: o.nombre, e: o.evento, s: o.estrellas, t: o.texto })) }, 200, { 'cache-control': 'public, max-age=60' });
}

async function admin(b) {
  switch (b.accion) {
    case 'recogidas': {
      const r = await q(`SELECT id, recogida FROM pedidos WHERE recogida IS NOT NULL`);
      return json({ recogidas: Object.fromEntries(r.map((x) => [x.id, x.recogida])) });
    }
    case 'recogida_guardar': {
      const id = parseInt(b.id, 10);
      if (!Number.isInteger(id)) return json({ error: 'Pedido no válido.' }, 400);
      await q(`UPDATE pedidos SET recogida = $2, actualizado = now() WHERE id = $1::int`, [id, texto(b.texto, 300)]);
      return json({ ok: true });
    }
    case 'precios_listar': {
      const r = await q(`SELECT nombre, precio FROM precios_desc`);
      return json({ precios: Object.fromEntries(r.map((x) => [x.nombre, x.precio])) });
    }
    case 'precios_guardar': {
      const src = b.precios && typeof b.precios === 'object' ? b.precios : {};
      const lista = Object.entries(src).slice(0, 400)
        .map(([n, p]) => ({ nombre: String(n).trim().slice(0, 120), precio: Math.max(0, Math.min(2000000000, parseInt(p, 10) || 0)) }))
        .filter((x) => x.nombre && x.precio > 0);
      const js = JSON.stringify(lista);
      await q(`INSERT INTO precios_desc (nombre, precio) SELECT nombre, precio FROM jsonb_to_recordset($1::jsonb) AS x(nombre text, precio int)
               ON CONFLICT (nombre) DO UPDATE SET precio = EXCLUDED.precio`, [js]);
      await q(`DELETE FROM precios_desc WHERE nombre NOT IN (SELECT nombre FROM jsonb_to_recordset($1::jsonb) AS x(nombre text))`, [js]);
      return json({ ok: true, total: lista.length });
    }
    case 'opiniones_listar': {
      const r = await q(`SELECT o.id, o.pedido_id, o.nombre, o.evento, o.estrellas, o.texto, o.aprobada,
        to_char(o.actualizado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS fecha, p.nombre AS cliente
        FROM opiniones o JOIN pedidos p ON p.id = o.pedido_id ORDER BY o.aprobada, o.actualizado DESC`);
      return json({ opiniones: r });
    }
    case 'opinion_estado': {
      await q(`UPDATE opiniones SET aprobada = $2::boolean WHERE id = $1::int`, [parseInt(b.id, 10), b.aprobada === true]);
      return json({ ok: true });
    }
    case 'opinion_eliminar': {
      await q(`DELETE FROM opiniones WHERE id = $1::int`, [parseInt(b.id, 10)]);
      return json({ ok: true });
    }
    // ---- Códigos de descuento ----
    case 'codigos_listar': {
      const r = await q(`SELECT id, codigo, valor, activo, descripcion,
        to_char(creado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS creado
        FROM codigos_descuento ORDER BY creado DESC`);
      return json({ codigos: r });
    }
    case 'codigo_crear': {
      const cod = texto(b.codigo, 40);
      const val = parseInt(b.valor, 10);
      if (!cod) return json({ error: 'El código no puede estar vacío.' }, 400);
      if (!(val > 0)) return json({ error: 'El valor debe ser mayor a 0.' }, 400);
      const codUp = cod.toUpperCase().replace(/\s+/g, '');
      await q(`INSERT INTO codigos_descuento (codigo, valor, activo, descripcion)
               VALUES ($1, $2::int, $3::boolean, $4)`,
        [codUp, val, b.activo !== false, texto(b.descripcion, 200) || null]);
      return json({ ok: true });
    }
    case 'codigo_editar': {
      const id = parseInt(b.id, 10);
      const val = parseInt(b.valor, 10);
      if (!Number.isInteger(id)) return json({ error: 'ID no válido.' }, 400);
      if (!(val > 0)) return json({ error: 'El valor debe ser mayor a 0.' }, 400);
      await q(`UPDATE codigos_descuento SET valor = $2::int, activo = $3::boolean, descripcion = $4 WHERE id = $1::int`,
        [id, val, b.activo !== false, texto(b.descripcion, 200) || null]);
      return json({ ok: true });
    }
    case 'codigo_eliminar': {
      await q(`DELETE FROM codigos_descuento WHERE id = $1::int`, [parseInt(b.id, 10)]);
      return json({ ok: true });
    }
    default: return json({ error: 'Acción no reconocida.' }, 400);
  }
}

async function cliente(t, b) {
  const lista = ids(t.ids);
  if (!lista) return json({ error: 'Tu acceso venció. Ingresa de nuevo.' }, 401);
  if (b.accion === 'mio') {
    const rec = await q(`SELECT id, recogida FROM pedidos WHERE visible AND recogida IS NOT NULL AND id = ANY(string_to_array($1, ',')::int[])`, [lista]);
    const op = await q(`SELECT pedido_id, estrellas, texto, aprobada FROM opiniones WHERE pedido_id = ANY(string_to_array($1, ',')::int[])`, [lista]);
    return json({
      recogidas: Object.fromEntries(rec.map((x) => [x.id, x.recogida])),
      opiniones: Object.fromEntries(op.map((o) => [o.pedido_id, { s: o.estrellas, t: o.texto, aprobada: o.aprobada }])),
    });
  }
  if (b.accion === 'opinar') {
    const id = parseInt(b.pedido_id, 10);
    const s = parseInt(b.estrellas, 10);
    const t2 = texto(b.texto, 600);
    if (!Number.isInteger(id) || !String(lista).split(',').includes(String(id))) return json({ error: 'Pedido no válido.' }, 400);
    if (!(s >= 1 && s <= 5)) return json({ error: 'Elige de 1 a 5 estrellas.' }, 400);
    if (!t2 || t2.length < 10) return json({ error: 'Cuéntanos un poco más (mínimo 10 letras).' }, 400);
    const p = (await q(`SELECT nombre, tipo_evento, modalidad, paso FROM pedidos WHERE id = $1::int AND visible`, [id]))[0];
    if (!p || p.modalidad !== 'alquiler') return json({ error: 'Pedido no válido.' }, 400);
    if (p.paso < PASO_MIN_OPINION) return json({ error: 'Podrás opinar cuando tu evento ya esté en marcha o terminado.' }, 400);
    // Al crear o editar, vuelve a quedar pendiente de aprobación.
    await q(`INSERT INTO opiniones (pedido_id, nombre, evento, estrellas, texto, aprobada)
             VALUES ($1::int, $2, $3, $4::int, $5, false)
             ON CONFLICT (pedido_id) DO UPDATE SET estrellas = EXCLUDED.estrellas, texto = EXCLUDED.texto,
               nombre = EXCLUDED.nombre, evento = EXCLUDED.evento, aprobada = false, actualizado = now()`,
      [id, nombrePublico(p.nombre), texto(p.tipo_evento, 120), s, t2]);
    return json({ ok: true });
  }
  return json({ error: 'Acción no reconocida.' }, 400);
}

export default async (req) => {
  try {
    await esquemaExtra();
    if (req.method === 'GET') return await publicas();
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    // Validar código de descuento: acción pública, sin token
    const b = await req.json().catch(() => ({}));
    if (b.accion === 'codigo_validar') {
      const cod = String(b.codigo || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!cod) return json({ error: 'Escribe un código.' }, 400);
      const r = await q(`SELECT valor FROM codigos_descuento WHERE codigo = $1 AND activo`, [cod]);
      if (!r.length) return json({ error: 'Código no válido o inactivo.' }, 400);
      return json({ ok: true, valor: r[0].valor });
    }
    const t = verificar(tokenDe(req));
    if (!t) return json({ error: 'Sesión vencida. Vuelve a ingresar.' }, 401);
    if (t.rol === 'admin') return await admin(b);
    if (t.rol === 'cliente') return await cliente(t, b);
    return json({ error: 'No autorizado.' }, 401);
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/extras' };
