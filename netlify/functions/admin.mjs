// POST /api/admin  {accion, ...}  (Authorization: Bearer <token de admin>)
import { COLS_PEDIDO, PASOS, ensureSchema, fallo, getAjustes, json, q, refDe, setAjuste, soloDigitos, tokenDe, verificar, pin5, LARGO_PIN } from '../lib/util.mjs';
import { cotizacionPdf } from '../lib/cotizacion.mjs';

const MAX_BYTES = 3 * 1024 * 1024;
const TIPOS_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const CATEGORIAS = ['cotizacion', 'conformidad', 'recibo', 'foto', 'otro'];

const texto = (v, max = 2000) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };
const limpiarItems = (v) => (Array.isArray(v) ? v : []).slice(0, 100).map((it) => ({
  n: String(it?.n ?? '').trim().slice(0, 120),
  c: Math.max(1, Math.min(999, parseInt(it?.c, 10) || 1)),
  p: Math.max(0, Math.min(2000000000, parseInt(it?.p, 10) || 0)),
})).filter((it) => it.n);
const entero = (v) => Math.max(0, Math.min(2000000000, parseInt(v, 10) || 0));

// Convierte un enlace de Instagram (o "p/CODIGO") en "p/CODIGO"
function normalizarIG(v) {
  const s = String(v || '').trim();
  const m = s.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})/i) || s.match(/^(p|reel|tv)\/([A-Za-z0-9_-]{5,})$/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
}

// Código del cliente: si ya tiene otro pedido (misma cédula o celular) se reutiliza su código; si no, se crea uno nuevo.
async function pinParaCliente(cedula, telefono) {
  if (cedula || telefono) {
    const r = await q(`SELECT pin FROM pedidos WHERE length(pin) = $3::int AND ((cedula IS NOT NULL AND cedula = $1) OR (telefono IS NOT NULL AND telefono = $2)) ORDER BY id LIMIT 1`,
      [cedula || '', telefono || '', LARGO_PIN]);
    if (r.length) return r[0].pin;
  }
  return pin5();
}
async function asegurarPin(id) {
  const p = (await q(`SELECT cedula, telefono FROM pedidos WHERE id = $1::int`, [id]))[0];
  if (!p) return;
  await q(`UPDATE pedidos SET pin = $2 WHERE id = $1::int AND pin IS NULL`, [id, await pinParaCliente(p.cedula, p.telefono)]);
}

async function listar() {
  // Desde el 18 de nov. los códigos son de 5 números: los antiguos (4 números) se reemplazan.
  await q(`UPDATE pedidos SET pin = NULL WHERE pin IS NOT NULL AND length(pin) <> $1::int`, [LARGO_PIN]);
  for (const r of await q(`SELECT id FROM pedidos WHERE pin IS NULL ORDER BY id`)) await asegurarPin(r.id);
  const pedidos = await q(`SELECT ${COLS_PEDIDO}, to_char(actualizado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS actualizado FROM pedidos ORDER BY id DESC`);
  const docs = await q(`SELECT id, pedido_id, nombre, tipo, categoria, publico, tam FROM documentos ORDER BY id`);
  return {
    pasos: PASOS,
    ajustes: await getAjustes(),
    opiniones: await q(`SELECT id, pedido_id, nombre, estrellas, texto, estado, to_char(creado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS creado
                        FROM opiniones ORDER BY (estado = 'pendiente') DESC, creado DESC`),
    pedidos: pedidos.map((p) => ({ ...p, ref: refDe(p.id), docs: docs.filter((d) => d.pedido_id === p.id) })),
  };
}

async function guardar(b) {
  const p = b.pedido || {};
  const nombre = texto(p.nombre, 120);
  if (!nombre) return json({ error: 'El nombre es obligatorio.' }, 400);
  const cedula = soloDigitos(p.cedula) || null;
  const telefono = soloDigitos(p.telefono) || null;
  const visible = p.visible === true;
  if (visible && !cedula && !telefono) return json({ error: 'Para habilitar el pedido escribe la cédula o el celular del cliente: con eso entrará a verlo.' }, 400);
  const modalidad = p.modalidad === 'decoracion' ? 'decoracion' : 'alquiler';
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_evento || '') ? p.fecha_evento : null;
  const paso = Math.max(0, Math.min(PASOS[modalidad].length - 1, parseInt(p.paso, 10) || 0));
  const recogida = modalidad === 'alquiler' ? texto(p.recogida, 500) : null;

  let historial = {};
  let id = parseInt(p.id, 10);
  if (Number.isInteger(id)) {
    const previo = (await q(`SELECT historial FROM pedidos WHERE id = $1`, [id]))[0];
    if (!previo) return json({ error: 'Pedido no encontrado.' }, 404);
    historial = previo.historial || {};
  }
  if (!historial[paso]) historial[paso] = new Date().toISOString();

  const vals = [nombre, cedula, telefono, modalidad, texto(p.tipo_evento, 120), fecha, texto(p.lugar, 200), paso,
    JSON.stringify(historial), texto(p.mensaje, 1500), texto(p.detalle, 4000), entero(p.total), entero(p.abonado),
    entero(p.deposito), texto(p.notas_internas, 4000), visible, JSON.stringify(limpiarItems(p.items)), recogida];

  if (Number.isInteger(id)) {
    await q(`UPDATE pedidos SET nombre=$1, cedula=$2, telefono=$3, modalidad=$4, tipo_evento=$5, fecha_evento=$6::date,
             lugar=$7, paso=$8::int, historial=$9::jsonb, mensaje=$10, detalle=$11, total=$12::int, abonado=$13::int,
             deposito=$14::int, notas_internas=$15, visible=$16::boolean, items=$17::jsonb, recogida=$18, actualizado=now() WHERE id=$19::int`, [...vals, id]);
  } else {
    id = (await q(`INSERT INTO pedidos (nombre, cedula, telefono, modalidad, tipo_evento, fecha_evento, lugar, paso, historial,
             mensaje, detalle, total, abonado, deposito, notas_internas, visible, items, recogida, pin)
             VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8::int,$9::jsonb,$10,$11,$12::int,$13::int,$14::int,$15,$16::boolean,$17::jsonb,$18,$19) RETURNING id`, [...vals, await pinParaCliente(cedula, telefono)]))[0].id;
  }
  await asegurarPin(id);
  // La cotización en PDF se crea sola al guardar; si falla, el pedido igual queda guardado.
  let cotizacion = false;
  try { cotizacion = !!(await generarCotizacion(id)); } catch (e) { console.error('[cotizacion]', e); }
  return json({ ok: true, id, ref: refDe(id), cotizacion });
}

// Cotización en PDF generada automáticamente a partir del pedido. Se reemplaza la anterior generada por el sistema
// (los documentos que sube el equipo a mano no se tocan).
const PREFIJO_COT = 'Cotización ALENA';
async function generarCotizacion(id) {
  const p = (await q(`SELECT nombre, telefono, lugar, to_char(fecha_evento, 'YYYY-MM-DD') AS fecha_evento, items, total, abonado, deposito, detalle, mensaje, recogida, modalidad
                      FROM pedidos WHERE id = $1::int`, [id]))[0];
  if (!p) return null;
  const bytes = Buffer.from(await cotizacionPdf(p));
  const nombre = `${PREFIJO_COT} - ${p.nombre}.pdf`.slice(0, 150);
  const previo = (await q(`SELECT publico FROM documentos WHERE pedido_id = $1::int AND categoria = 'cotizacion' AND nombre LIKE $2 ORDER BY id DESC LIMIT 1`, [id, PREFIJO_COT + '%']))[0];
  await q(`DELETE FROM documentos WHERE pedido_id = $1::int AND categoria = 'cotizacion' AND nombre LIKE $2`, [id, PREFIJO_COT + '%']);
  const r = await q(`INSERT INTO documentos (pedido_id, nombre, tipo, categoria, publico, tam, data)
                     VALUES ($1::int, $2, 'application/pdf', 'cotizacion', $3::boolean, $4::int, decode($5, 'base64')) RETURNING id`,
    [id, nombre, previo ? previo.publico : true, bytes.length, bytes.toString('base64')]);
  return r[0].id;
}

async function subirDoc(b) {
  const pedidoId = parseInt(b.pedido_id, 10);
  if (!Number.isInteger(pedidoId)) return json({ error: 'Pedido no válido.' }, 400);
  if (!TIPOS_OK.includes(b.tipo)) return json({ error: 'Solo se permiten PDF, JPG, PNG o WEBP.' }, 400);
  const b64 = String(b.b64 || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json({ error: 'Archivo no válido.' }, 400);
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) return json({ error: 'El archivo supera 3 MB.' }, 400);
  const existe = await q(`SELECT 1 FROM pedidos WHERE id = $1`, [pedidoId]);
  if (!existe.length) return json({ error: 'Pedido no encontrado.' }, 404);
  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : 'otro';
  const r = await q(`INSERT INTO documentos (pedido_id, nombre, tipo, categoria, publico, tam, data)
                     VALUES ($1::int, $2, $3, $4, $5::boolean, $6::int, decode($7, 'base64')) RETURNING id`,
    [pedidoId, texto(b.nombre, 150) || 'documento', b.tipo, categoria, b.publico !== false, bytes, b64]);
  return json({ ok: true, id: r[0].id });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const t = verificar(tokenDe(req));
    if (!t || t.rol !== 'admin') return json({ error: 'Sesión vencida. Vuelve a iniciar sesión.' }, 401);
    await ensureSchema();
    const b = await req.json().catch(() => ({}));

    switch (b.accion) {
      case 'listar':
        return json(await listar());
      case 'guardar':
        return await guardar(b);
      case 'eliminar': {
        const id = parseInt(b.id, 10);
        if (!Number.isInteger(id)) return json({ error: 'Pedido no válido.' }, 400);
        await q(`DELETE FROM pedidos WHERE id = $1`, [id]);
        return json({ ok: true });
      }
      case 'nuevo_pin': {
        const id = parseInt(b.id, 10);
        if (!Number.isInteger(id)) return json({ error: 'Pedido no válido.' }, 400);
        const ped = (await q(`SELECT cedula, telefono FROM pedidos WHERE id = $1::int`, [id]))[0];
        if (!ped) return json({ error: 'Pedido no encontrado.' }, 404);
        const nuevo = pin5();
        // El código es por cliente: se cambia en todos sus pedidos (misma cédula o celular)
        await q(`UPDATE pedidos SET pin = $2 WHERE id = $1::int OR (cedula IS NOT NULL AND cedula = $3) OR (telefono IS NOT NULL AND telefono = $4)`,
          [id, nuevo, ped.cedula || '', ped.telefono || '']);
        return json({ ok: true, pin: nuevo });
      }
      case 'ajustes': {
        if (typeof b.portal === 'boolean') await setAjuste('portal', b.portal);
        if (Array.isArray(b.instagram)) {
          const lista = [...new Set(b.instagram.map(normalizarIG).filter(Boolean))].slice(0, 12);
          await setAjuste('instagram', lista);
        }
        return json({ ok: true, ajustes: await getAjustes() });
      }
      case 'opinion_estado': {
        if (!['aprobada', 'rechazada', 'pendiente'].includes(b.estado)) return json({ error: 'Estado no válido.' }, 400);
        await q(`UPDATE opiniones SET estado = $2 WHERE id = $1::int`, [parseInt(b.id, 10), b.estado]);
        return json({ ok: true });
      }
      case 'opinion_eliminar': {
        await q(`DELETE FROM opiniones WHERE id = $1::int`, [parseInt(b.id, 10)]);
        return json({ ok: true });
      }
      case 'generar_cotizacion': {
        const id = parseInt(b.id, 10);
        if (!Number.isInteger(id)) return json({ error: 'Pedido no válido.' }, 400);
        const doc = await generarCotizacion(id);
        return doc ? json({ ok: true, id: doc }) : json({ error: 'Pedido no encontrado.' }, 404);
      }
      case 'subir_doc':
        return await subirDoc(b);
      case 'doc_publico': {
        await q(`UPDATE documentos SET publico = $2::boolean WHERE id = $1::int`, [parseInt(b.id, 10), b.publico === true]);
        return json({ ok: true });
      }
      case 'eliminar_doc': {
        await q(`DELETE FROM documentos WHERE id = $1::int`, [parseInt(b.id, 10)]);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Acción no reconocida.' }, 400);
    }
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/admin' };
