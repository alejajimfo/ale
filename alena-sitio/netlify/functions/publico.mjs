// GET /api/publico -> ajustes visibles para cualquier visitante del sitio
import { ensureSchema, getAjustes, json } from '../lib/util.mjs';

export default async () => {
  try {
    await ensureSchema();
    const a = await getAjustes();
    return json({ portal: a.portal, instagram: a.instagram }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (e) {
    console.error(e);
    // Si algo falla, el sitio sigue funcionando con su contenido por defecto.
    return json({ portal: false, instagram: [] }, 200);
  }
};

export const config = { path: '/api/publico' };
