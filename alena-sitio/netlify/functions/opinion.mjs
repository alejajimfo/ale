// POST /api/opinion {pedido_id, estrellas, texto} (Bearer de cliente) -> queda PENDIENTE hasta que ALENA la apruebe
import { anotar, ensureSchema, fallo, ipDe, json, limitado, pasoEvento, q, tokenDe, verificar } from '../lib/util.mjs';

// "María Fernanda Pérez" -> "María P." (no se publica el nombre completo)
const autorPublico = (nombre) => {
  const [a, b] = String(nombre || '').trim().split(/\s+/);
  return (a || 'Cliente') + (b ? ` ${b[0].toUpperCase()}.` : '');
};

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const t = verificar(tokenDe(req));
    if (!t || t.rol !== 'cliente' || !Array.isArray(t.ids)) return json({ error: 'Tu acceso venció. Ingresa de nuevo.' }, 401);
    await ensureSchema();

    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'opinion', 10, 60)) return json({ error: 'Demasiados intentos. Intenta más tarde.' }, 429);
    await anotar(ip, 'opinion');

    const b = await req.json().catch(() => ({}));
    const id = parseInt(b.pedido_id, 10);
    if (!Number.isInteger(id) || !t.ids.includes(id)) return json({ error: 'Pedido no válido.' }, 403);
    const estrellas = parseInt(b.estrellas, 10);
    const texto = String(b.texto ?? '').trim().slice(0, 600);
    if (!(estrellas >= 1 && estrellas <= 5)) return json({ error: 'Elige de 1 a 5 estrellas.' }, 400);
    if (texto.length < 5) return json({ error: 'Cuéntanos un poco más sobre tu experiencia.' }, 400);

    const p = (await q(`SELECT nombre, tipo_evento, modalidad, paso FROM pedidos WHERE id = $1 AND visible`, [id]))[0];
    if (!p) return json({ error: 'Pedido no encontrado.' }, 404);
    if (p.paso < pasoEvento(p.modalidad)) return json({ error: 'Podrás dejar tu opinión cuando llegue el día de tu evento.' }, 400);

    const previa = (await q(`SELECT estado FROM opiniones WHERE pedido_id = $1`, [id]))[0];
    if (previa && previa.estado === 'aprobada') return json({ error: 'Tu opinión ya está publicada. ¡Gracias!' }, 409);

    await q(`INSERT INTO opiniones (pedido_id, autor, tipo_evento, estrellas, texto) VALUES ($1::int, $2, $3, $4::int, $5)
             ON CONFLICT (pedido_id) DO UPDATE SET estrellas = EXCLUDED.estrellas, texto = EXCLUDED.texto, estado = 'pendiente', creado = now()
             WHERE opiniones.estado <> 'aprobada'`, [id, autorPublico(p.nombre), p.tipo_evento, estrellas, texto]);
    return json({ ok: true, opinion: { estrellas, texto, estado: 'pendiente' } });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/opinion' };
