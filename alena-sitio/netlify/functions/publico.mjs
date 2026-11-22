// GET /api/publico -> ajustes visibles para cualquier visitante del sitio
import { ensureSchema, getAjustes, json, q } from '../lib/util.mjs';

export default async () => {
  try {
    await ensureSchema();
    const a = await getAjustes();
    const opiniones = await q(`SELECT o.nombre, o.estrellas, o.texto, p.tipo_evento FROM opiniones o LEFT JOIN pedidos p ON p.id = o.pedido_id
                               WHERE o.estado = 'aprobada' ORDER BY o.creado DESC LIMIT 50`);
    return json({ portal: a.portal, instagram: a.instagram, opiniones }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (e) {
    console.error(e);
    // Si algo falla, el sitio sigue funcionando con su contenido por defecto.
    return json({ portal: false, instagram: [], opiniones: [] }, 200);
  }
};

export const config = { path: '/api/publico' };
