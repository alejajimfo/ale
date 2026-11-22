// POST /api/opinion {pedido_id, estrellas, texto}  (Bearer del cliente) -> queda "pendiente" hasta que el equipo la apruebe
import { anotar, ensureSchema, fallo, ipDe, json, limitado, q, tokenDe, verificar } from '../lib/util.mjs';

// Se publica solo el primer nombre y la inicial del último apellido
const corto = (n) => {
  const w = String(n || '').trim().split(/\s+/).filter(Boolean);
  return w.length > 1 ? `${w[0]} ${w[w.length - 1][0].toUpperCase()}.` : (w[0] || 'Cliente');
};

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    await ensureSchema();
    const t = verificar(tokenDe(req));
    if (!t || t.rol !== 'cliente' || !Array.isArray(t.ids)) return json({ error: 'Tu acceso venció. Ingresa de nuevo.' }, 401);
    const b = await req.json().catch(() => ({}));
    const id = parseInt(b.pedido_id, 10), estrellas = parseInt(b.estrellas, 10);
    const texto = String(b.texto ?? '').trim().replace(/\s+/g, ' ').slice(0, 600);
    if (!t.ids.includes(id)) return json({ error: 'Pedido no válido.' }, 403);
    if (!(estrellas >= 1 && estrellas <= 5) || texto.length < 10) return json({ error: 'Elige de 1 a 5 estrellas y cuéntanos un poco más (mínimo 10 letras).' }, 400);
    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'opinion', 5, 60)) return json({ error: 'Demasiados envíos. Intenta más tarde.' }, 429);
    const p = (await q(`SELECT nombre, paso FROM pedidos WHERE id = $1::int AND visible`, [id]))[0];
    if (!p) return json({ error: 'Pedido no válido.' }, 403);
    if (p.paso < 5) return json({ error: 'Podrás dejar tu opinión cuando tu evento haya ocurrido.' }, 400);
    const r = await q(`INSERT INTO opiniones (pedido_id, nombre, estrellas, texto) VALUES ($1::int, $2, $3::int, $4)
                       ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING RETURNING id`, [id, corto(p.nombre), estrellas, texto]);
    if (!r.length) return json({ error: 'Ya enviaste tu opinión para este pedido. ¡Gracias!' }, 409);
    await anotar(ip, 'opinion');
    return json({ ok: true });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/opinion' };
