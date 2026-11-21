// POST /api/codigo  {dato: cédula o celular} -> envía un código de 4 números al WhatsApp registrado del pedido
import { MIN_CODIGO, anotar, codigo4, ensureSchema, enviarWhatsApp, fallo, getAjustes, ipDe, json, limitado, q, soloDigitos, waConfigurado } from '../lib/util.mjs';

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    await ensureSchema();
    if (!(await getAjustes()).portal) return json({ error: 'La consulta de pedidos aún no está habilitada.' }, 403);

    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'codigo', 8, 10)) return json({ error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }, 429);
    await anotar(ip, 'codigo');

    const body = await req.json().catch(() => ({}));
    const d = soloDigitos(body.dato);
    if (d.length < 6 || d.length > 12) return json({ error: 'Escribe tu número de cédula o de celular.' }, 400);

    // La respuesta es siempre la misma, exista o no el pedido, para no revelar qué clientes tenemos.
    const respuesta = json({ ok: true, auto: waConfigurado() });

    const pedidos = await q(`SELECT telefono FROM pedidos WHERE visible AND (cedula = $1 OR telefono = $1) ORDER BY id DESC`, [d]);
    const tel = pedidos.map((p) => p.telefono).find(Boolean);
    if (!tel) return respuesta;

    // Máximo 3 códigos por hora para cada cliente (evita que alguien le llene el WhatsApp a otra persona)
    const n = (await q(`SELECT count(*)::int AS n FROM retos WHERE ident = $1 AND creado > now() - interval '1 hour'`, [d]))[0].n;
    if (n >= 3) return respuesta;

    await q(`UPDATE retos SET expira = now() WHERE ident = $1 AND expira > now()`, [d]);
    const codigo = codigo4();
    const id = (await q(`INSERT INTO retos (ident, telefono, codigo, expira) VALUES ($1, $2, $3, now() + make_interval(mins => $4::int)) RETURNING id`,
      [d, tel, codigo, MIN_CODIGO]))[0].id;
    await q(`DELETE FROM retos WHERE creado < now() - interval '2 days'`);

    if (await enviarWhatsApp(tel, codigo)) await q(`UPDATE retos SET enviado = true WHERE id = $1`, [id]);
    return respuesta;
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/codigo' };
