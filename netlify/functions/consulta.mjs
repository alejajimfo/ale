// POST /api/consulta {dato, pin}  -> cédula o celular + PIN del pedido; devuelve los pedidos (acceso por 24 h)
// GET  /api/consulta (Bearer)     -> vuelve a cargar los pedidos mientras el acceso siga vigente
import { COLS_PEDIDO, HORAS_SESION, LARGO_PIN, anotar, ensureSchema, fallo, firmar, getAjustes, igual, ipDe, json, limitado, paraCliente, q, soloDigitos, tokenDe, verificar } from '../lib/util.mjs';

async function cargar(ids) {
  const pedidos = await q(`SELECT ${COLS_PEDIDO} FROM pedidos WHERE visible AND id = ANY(string_to_array($1, ',')::int[])
                           ORDER BY fecha_evento DESC NULLS LAST, id DESC`, [ids.join(',')]);
  if (!pedidos.length) return [];
  const docs = await q(`SELECT id, pedido_id, nombre, tipo, categoria, tam FROM documentos
                        WHERE publico AND pedido_id = ANY(string_to_array($1, ',')::int[]) ORDER BY id`, [pedidos.map((p) => p.id).join(',')]);
  const ops = await q(`SELECT pedido_id, estrellas, texto, estado FROM opiniones WHERE pedido_id = ANY(string_to_array($1, ',')::int[])`, [pedidos.map((p) => p.id).join(',')]);
  return pedidos.map((p) => paraCliente(p, docs, ops));
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

    const body = await req.json().catch(() => ({}));
    const d = soloDigitos(body.dato);
    const pin = String(body.pin ?? '').replace(/\D/g, '');
    if (d.length < 6 || d.length > 12 || pin.length !== LARGO_PIN) return json({ error: `Escribe tu cédula o celular y tu código de ${LARGO_PIN} números.` }, 400);

    // Límites: por IP y por cliente (el código tiene solo 5 números, así que se bloquea tras 5 fallos)
    const ip = ipDe(req, ctx), llave = 'cliente:' + d;
    if (await limitado(ip, 'pin', 10, 10) || await limitado(llave, 'pin', 5, 30)) {
      return json({ error: 'Demasiados intentos. Espera 30 minutos o escríbenos por WhatsApp.' }, 429);
    }

    const filas = await q(`SELECT ${COLS_PEDIDO} FROM pedidos WHERE visible AND (cedula = $1 OR telefono = $1)`, [d]);
    const ok = filas.filter((r) => r.pin && igual(r.pin, pin));
    if (!ok.length) {
      await anotar(ip, 'pin'); await anotar(llave, 'pin');
      return json({ error: 'Los datos o el código no coinciden. Revísalos o escríbenos por WhatsApp.' }, 401);
    }

    const ids = ok.map((r) => r.id);
    const pedidos = await cargar(ids);
    return json({ token: firmar({ rol: 'cliente', ids }, HORAS_SESION * 60), exp: Date.now() + HORAS_SESION * 3600 * 1000, pedidos });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/consulta' };
