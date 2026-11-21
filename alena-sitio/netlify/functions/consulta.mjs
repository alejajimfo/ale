// POST /api/consulta  {codigo: cédula o celular} -> pedidos habilitados de ese cliente
import { COLS_PEDIDO, anotar, ensureSchema, fallo, firmar, getAjustes, ipDe, json, limitado, paraCliente, q, soloDigitos } from '../lib/util.mjs';

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    await ensureSchema();
    const ajustes = await getAjustes();
    if (!ajustes.portal) return json({ error: 'La consulta de pedidos aún no está habilitada.' }, 403);

    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'consulta', 12, 10)) return json({ error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }, 429);

    const body = await req.json().catch(() => ({}));
    const d = soloDigitos(body.codigo);
    await anotar(ip, 'consulta');
    if (d.length < 6 || d.length > 12) return json({ error: 'Escribe tu cédula o tu número de celular.' }, 400);

    const pedidos = await q(
      `SELECT ${COLS_PEDIDO} FROM pedidos
       WHERE visible AND (cedula = $1 OR telefono = $1)
       ORDER BY fecha_evento DESC NULLS LAST, id DESC LIMIT 10`, [d]);
    if (!pedidos.length) return json({ error: 'No encontramos un pedido habilitado con ese dato. Revisa el número o escríbenos por WhatsApp.' }, 404);

    const ids = pedidos.map((p) => p.id);
    const docs = await q(
      `SELECT id, pedido_id, nombre, tipo, categoria, tam FROM documentos
       WHERE publico AND pedido_id = ANY(string_to_array($1, ',')::int[]) ORDER BY id`, [ids.join(',')]);

    return json({ token: firmar({ rol: 'cliente', ids }, 30), pedidos: pedidos.map((p) => paraCliente(p, docs)) });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/consulta' };
