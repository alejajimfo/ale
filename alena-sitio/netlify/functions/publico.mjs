// GET /api/publico -> ajustes visibles para cualquier visitante del sitio
import { ensureSchema, getAjustes, json, q } from '../lib/util.mjs';

export default async () => {
  try {
    await ensureSchema();
    const a = await getAjustes();
    const opiniones = (await q(`SELECT autor AS n, tipo_evento AS e, texto AS t, estrellas AS s FROM opiniones WHERE estado = 'aprobada' ORDER BY id DESC LIMIT 30`));
    return json({ portal: a.portal, instagram: a.instagram, opiniones }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (e) {
    console.error(e);
    // Si algo falla, el sitio sigue funcionando con su contenido por defecto.
    return json({ portal: false, instagram: [], opiniones: [] }, 200);
  }
};

export const config = { path: '/api/publico' };
