// POST /api/consulta {dato, codigo}  -> verifica el código de 4 números y devuelve los pedidos (acceso por 24 h)
// GET  /api/consulta (Bearer)        -> vuelve a cargar los pedidos mientras el acceso siga vigente
import { COLS_PEDIDO, HORAS_SESION, anotar, ensureSchema, fallo, firmar, getAjustes, igual, ipDe, json, limitado, paraCliente, q, soloDigitos, tokenDe, verificar } from '../lib/util.mjs';

async function cargar(ids) {
  const pedidos = await q(`SELECT ${COLS_PEDIDO} FROM pedidos WHERE visible AND id = ANY(string_to_array($1, ',')::int[])
                           ORDER BY fecha_evento DESC NULLS LAST, id DESC`, [ids.join(',')]);
  if (!pedidos.length) return [];
  const docs = await q(`SELECT id, pedido_id, nombre, tipo, categoria, tam FROM documentos
                        WHERE publico AND pedido_id = ANY(string_to_array($1, ',')::int[]) ORDER BY id`, [pedidos.map((p) => p.id).join(',')]);
  return pedidos.map((p) => paraCliente(p, docs));
}

export default async (req, ctx) => {
  try {
    await ensureSchema();
    if (!(await getAjustes()).portal) return json({ error: 'La consulta de pedidos aún no está habilitada.' }, 403);

    if (req.method === 'GET') {
      const t = verificar(tokenDe(req));
      if (!t || t.rol !== 'cliente' || !Array.isArray(t.ids)) return json({ error: 'Tu acceso venció. Ingresa de nuevo.' }, 401);
      const pedidos = await cargar(t.ids);
      if (!pedidos.length) return json({ error: 'Tu acceso venció. Ingresa de nuevo.' }, 401);
      return json({ pedidos });
    }
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'consulta', 10, 10)) return json({ error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }, 429);
    await anotar(ip, 'consulta');

    const body = await req.json().catch(() => ({}));
    const d = soloDigitos(body.dato);
    const c = String(body.codigo ?? '').replace(/\D/g, '');
    if (d.length < 6 || c.length !== 4) return json({ error: 'Escribe tu cédula o celular y el código de 4 números.' }, 400);

    const reto = (await q(`SELECT id, codigo FROM retos WHERE ident = $1 AND expira > now() AND intentos < 5 ORDER BY id DESC LIMIT 1`, [d]))[0];
    if (!reto) return json({ error: 'El código venció o no es válido. Pide uno nuevo.' }, 401);
    if (!igual(reto.codigo, c)) {
      await q(`UPDATE retos SET intentos = intentos + 1 WHERE id = $1`, [reto.id]);
      return json({ error: 'Código incorrecto. Revisa el mensaje de WhatsApp.' }, 401);
    }
    await q(`UPDATE retos SET expira = now() WHERE id = $1`, [reto.id]); // un código sirve una sola vez

    const ids = (await q(`SELECT id FROM pedidos WHERE visible AND (cedula = $1 OR telefono = $1)`, [d])).map((r) => r.id);
    const pedidos = ids.length ? await cargar(ids) : [];
    if (!pedidos.length) return json({ error: 'No encontramos un pedido habilitado.' }, 404);

    return json({ token: firmar({ rol: 'cliente', ids }, HORAS_SESION * 60), exp: Date.now() + HORAS_SESION * 3600 * 1000, pedidos });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/consulta' };
