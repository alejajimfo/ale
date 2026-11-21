// POST /api/admin  {accion, ...}  (Authorization: Bearer <token de admin>)
import { COLS_PEDIDO, PASOS, ensureSchema, fallo, getAjustes, json, q, refDe, setAjuste, soloDigitos, tokenDe, verificar, waConfigurado } from '../lib/util.mjs';

const MAX_BYTES = 3 * 1024 * 1024;
const TIPOS_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const CATEGORIAS = ['cotizacion', 'conformidad', 'recibo', 'foto', 'otro'];

const texto = (v, max = 2000) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };
const entero = (v) => Math.max(0, Math.min(2000000000, parseInt(v, 10) || 0));

// Convierte un enlace de Instagram (o "p/CODIGO") en "p/CODIGO"
function normalizarIG(v) {
  const s = String(v || '').trim();
  const m = s.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})/i) || s.match(/^(p|reel|tv)\/([A-Za-z0-9_-]{5,})$/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : null;
}

async function listar() {
  const pedidos = await q(`SELECT ${COLS_PEDIDO}, to_char(actualizado AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS actualizado FROM pedidos ORDER BY id DESC`);
  const docs = await q(`SELECT id, pedido_id, nombre, tipo, categoria, publico, tam FROM documentos ORDER BY id`);
  return {
    pasos: PASOS,
    ajustes: await getAjustes(),
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
  if (visible && (!telefono || telefono.length !== 10)) return json({ error: 'Para habilitar el pedido escribe el celular del cliente (10 dígitos): ahí le llegará el código por WhatsApp.' }, 400);
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

  const vals = [nombre, cedula, telefono, modalidad, texto(p.tipo_evento, 120), fecha, texto(p.lugar, 200), paso,
    JSON.stringify(historial), texto(p.mensaje, 1500), texto(p.detalle, 4000), entero(p.total), entero(p.abonado),
    entero(p.deposito), texto(p.notas_internas, 4000), visible];

  if (Number.isInteger(id)) {
    await q(`UPDATE pedidos SET nombre=$1, cedula=$2, telefono=$3, modalidad=$4, tipo_evento=$5, fecha_evento=$6::date,
             lugar=$7, paso=$8::int, historial=$9::jsonb, mensaje=$10, detalle=$11, total=$12::int, abonado=$13::int,
             deposito=$14::int, notas_internas=$15, visible=$16::boolean, actualizado=now() WHERE id=$17::int`, [...vals, id]);
  } else {
    id = (await q(`INSERT INTO pedidos (nombre, cedula, telefono, modalidad, tipo_evento, fecha_evento, lugar, paso, historial,
             mensaje, detalle, total, abonado, deposito, notas_internas, visible)
             VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8::int,$9::jsonb,$10,$11,$12::int,$13::int,$14::int,$15,$16::boolean) RETURNING id`, vals))[0].id;
  }
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
      case 'retos': {
        // Códigos que los clientes pidieron y aún no se han enviado (cuando no está configurada la API de WhatsApp)
        const rows = await q(`SELECT r.id, r.telefono, r.codigo, to_char(r.creado AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora,
            (SELECT nombre FROM pedidos p WHERE p.visible AND (p.cedula = r.ident OR p.telefono = r.ident) ORDER BY p.id DESC LIMIT 1) AS nombre
            FROM retos r WHERE NOT r.enviado AND r.expira > now() ORDER BY r.id`);
        return json({ retos: rows, auto: waConfigurado() });
      }
      case 'reto_enviado':
        await q(`UPDATE retos SET enviado = true WHERE id = $1::int`, [parseInt(b.id, 10)]);
        return json({ ok: true });
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
