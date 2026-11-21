// GET /api/documento?id=N  (Authorization: Bearer <token>) -> descarga el archivo
import { ensureSchema, fallo, json, q, tokenDe, verificar } from '../lib/util.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Método no permitido' }, 405);
  try {
    const p = verificar(tokenDe(req));
    if (!p || (p.rol !== 'admin' && p.rol !== 'cliente')) return json({ error: 'Sesión vencida. Vuelve a ingresar.' }, 401);

    const id = parseInt(new URL(req.url).searchParams.get('id'), 10);
    if (!Number.isInteger(id)) return json({ error: 'Documento no válido' }, 400);

    await ensureSchema();
    const r = (await q(
      `SELECT d.nombre, d.tipo, d.publico, d.pedido_id, p.visible, encode(d.data, 'base64') AS b64
       FROM documentos d JOIN pedidos p ON p.id = d.pedido_id WHERE d.id = $1`, [id]))[0];
    if (!r) return json({ error: 'No encontrado' }, 404);
    if (p.rol === 'cliente' && !(r.publico && r.visible && Array.isArray(p.ids) && p.ids.includes(r.pedido_id))) {
      return json({ error: 'No encontrado' }, 404);
    }

    const nombre = String(r.nombre).replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ()]/g, '_');
    return new Response(Buffer.from(r.b64, 'base64'), {
      status: 200,
      headers: {
        'content-type': r.tipo,
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/documento' };
