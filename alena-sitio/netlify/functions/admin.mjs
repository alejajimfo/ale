// POST /api/admin  {accion, ...}  (Authorization: Bearer <token de admin>)
import { CATALOGO, PRECIO } from '../lib/catalogo.mjs';
import { COLS_PEDIDO, PASOS, ensureSchema, fallo, getAjustes, json, normCodigo, q, refDe, setAjuste, soloDigitos, tokenDe, verificar, pin4 } from '../lib/util.mjs';

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

async function asegurarPin(id) {
  await q(`UPDATE pedidos SET pin = $2 WHERE id = $1 AND pin IS NULL`, [id, pin4()]);
}

async function listar() {
  for (const r of await q(`SELECT id FROM pedidos WHERE pin IS NULL`)) await asegurarPin(r.id);
  const pedidos = await q(`SELECT ${COLS_PEDIDO}, to_char(actualizado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS actualizado FROM pedidos ORDER BY id DESC`);
  const docs = await q(`SELECT id, pedido_id, nombre, tipo, categoria, publico, tam FROM documentos ORDER BY id`);
  return {
    pasos: PASOS,
    ajustes: await getAjustes(),
    codigos: await q(`SELECT id, codigo, valor_alquiler, valor_decoracion, activo, nota, items FROM descuentos ORDER BY activo DESC, id DESC`),
    catalogo: CATALOGO.map(([id, n, p, c]) => ({ id, n, p, c })),
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

  let historial = {};
  let id = parseInt(p.id, 10);
  if (Number.isInteger(id)) {
    const previo = (await q(`SELECT historial FROM pedidos WHERE id = $1`, [id]))[0];
    if (!previo) return json({ error: 'Pedido no encontrado.' }, 404);
    historial = previo.historial || {};
  }
  if (!historial[paso]) historial[paso] = new Date().toISOString();

  const total = entero(p.total);
  const descuento = Math.min(entero(p.descuento), total);           // el descuento nunca supera el total
  const deposito = entero(p.deposito);
  const devuelto = Math.min(entero(p.deposito_devuelto), deposito);  // lo devuelto nunca supera el depósito
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const fechaDev = devuelto > 0 ? (/^\d{4}-\d{2}-\d{2}$/.test(p.deposito_dev_fecha || '') ? p.deposito_dev_fecha : hoy) : null;

  const vals = [nombre, cedula, telefono, modalidad, texto(p.tipo_evento, 120), fecha, texto(p.lugar, 200), paso,
    JSON.stringify(historial), texto(p.mensaje, 1500), texto(p.detalle, 4000), total, entero(p.abonado),
    deposito, texto(p.notas_internas, 4000), visible, JSON.stringify(limpiarItems(p.items)),
    modalidad === 'alquiler' ? texto(p.recogida, 500) : null,
    descuento, descuento > 0 ? texto(p.descuento_nota, 300) : null, devuelto, fechaDev];

  if (Number.isInteger(id)) {
    await q(`UPDATE pedidos SET nombre=$1, cedula=$2, telefono=$3, modalidad=$4, tipo_evento=$5, fecha_evento=$6::date,
             lugar=$7, paso=$8::int, historial=$9::jsonb, mensaje=$10, detalle=$11, total=$12::int, abonado=$13::int,
             deposito=$14::int, notas_internas=$15, visible=$16::boolean, items=$17::jsonb, recogida=$18,
             descuento=$19::int, descuento_nota=$20, deposito_devuelto=$21::int, deposito_dev_fecha=$22::date, actualizado=now() WHERE id=$23::int`, [...vals, id]);
  } else {
    id = (await q(`INSERT INTO pedidos (nombre, cedula, telefono, modalidad, tipo_evento, fecha_evento, lugar, paso, historial,
             mensaje, detalle, total, abonado, deposito, notas_internas, visible, items, recogida,
             descuento, descuento_nota, deposito_devuelto, deposito_dev_fecha, pin)
             VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8::int,$9::jsonb,$10,$11,$12::int,$13::int,$14::int,$15,$16::boolean,$17::jsonb,$18,$19::int,$20,$21::int,$22::date,$23) RETURNING id`, [...vals, pin4()]))[0].id;
  }
  await asegurarPin(id);
  return json({ ok: true, id, ref: refDe(id) });
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
      case 'codigo_guardar': {
        const codigo = String(b.codigo ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const norm = normCodigo(codigo);
        if (norm.length < 3) return json({ error: 'El código debe tener al menos 3 caracteres.' }, 400);
        const va = entero(b.valor_alquiler), vd = entero(b.valor_decoracion);
        // Precio especial por pieza: { idPieza: precioConDescuento } (solo piezas del catálogo y con precio menor al normal)
        const items = {};
        for (const [k, v] of Object.entries(b.items && typeof b.items === 'object' ? b.items : {})) {
          const precio = parseInt(v, 10);
          if (PRECIO[k] !== undefined && Number.isInteger(precio) && precio >= 0 && precio < PRECIO[k]) items[k] = precio;
        }
        if (!va && !vd && !Object.keys(items).length) return json({ error: 'Define un descuento: un valor fijo para alquiler o montaje, o un precio especial en alguna pieza.' }, 400);
        const id = parseInt(b.id, 10), activo = b.activo !== false, nota = texto(b.nota, 200);
        try {
          if (Number.isInteger(id)) await q(`UPDATE descuentos SET codigo=$2, norm=$3, valor_alquiler=$4::int, valor_decoracion=$5::int, activo=$6::boolean, nota=$7, items=$8::jsonb WHERE id=$1::int`, [id, codigo, norm, va, vd, activo, nota, JSON.stringify(items)]);
          else await q(`INSERT INTO descuentos (codigo, norm, valor_alquiler, valor_decoracion, activo, nota, items) VALUES ($1,$2,$3::int,$4::int,$5::boolean,$6,$7::jsonb)`, [codigo, norm, va, vd, activo, nota, JSON.stringify(items)]);
        } catch (e) {
          if (/duplicate|unique/i.test(String(e?.message))) return json({ error: 'Ya existe un código con ese texto.' }, 400);
          throw e;
        }
        return json({ ok: true, codigos: (await listar()).codigos });
      }
      case 'codigo_borrar':
        await q(`DELETE FROM descuentos WHERE id = $1::int`, [parseInt(b.id, 10)]);
        return json({ ok: true, codigos: (await listar()).codigos });
      case 'opiniones': {
        const rows = await q(`SELECT o.id, o.pedido_id, o.autor, o.tipo_evento, o.estrellas, o.texto, o.estado,
            to_char(o.creado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha
            FROM opiniones o ORDER BY (o.estado = 'pendiente') DESC, o.id DESC`);
        return json({ opiniones: rows.map((o) => ({ ...o, ref: refDe(o.pedido_id) })) });
      }
      case 'opinion_estado': {
        if (!['pendiente', 'aprobada', 'rechazada'].includes(b.estado)) return json({ error: 'Estado no válido.' }, 400);
        await q(`UPDATE opiniones SET estado = $2 WHERE id = $1::int`, [parseInt(b.id, 10), b.estado]);
        return json({ ok: true });
      }
      case 'opinion_borrar':
        await q(`DELETE FROM opiniones WHERE id = $1::int`, [parseInt(b.id, 10)]);
        return json({ ok: true });
      case 'nuevo_pin': {
        const id = parseInt(b.id, 10);
        if (!Number.isInteger(id)) return json({ error: 'Pedido no válido.' }, 400);
        const r = await q(`UPDATE pedidos SET pin = $2 WHERE id = $1::int RETURNING pin`, [id, pin4()]);
        return r.length ? json({ ok: true, pin: r[0].pin }) : json({ error: 'Pedido no encontrado.' }, 404);
      }
      case 'ajustes': {
        if (typeof b.portal === 'boolean') await setAjuste('portal', b.portal);
        if (Array.isArray(b.instagram)) {
          const lista = [...new Set(b.instagram.map(normalizarIG).filter(Boolean))].slice(0, 12);
          await setAjuste('instagram', lista);
        }
        return json({ ok: true, ajustes: await getAjustes() });
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
