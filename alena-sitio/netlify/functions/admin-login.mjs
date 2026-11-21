// POST /api/admin-login  {email, clave} -> {token}
import { ConfigError, ensureSchema, anotar, fallo, firmar, igual, ipDe, json, limitado } from '../lib/util.mjs';

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const E = process.env.ADMIN_EMAIL, P = process.env.ADMIN_PASSWORD;
    if (!E || !P) throw new ConfigError('Faltan ADMIN_EMAIL y ADMIN_PASSWORD en las variables de entorno de Netlify.');
    await ensureSchema();
    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'admin', 6, 15)) return json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);

    const body = await req.json().catch(() => ({}));
    const okMail = igual(String(body.email || '').trim().toLowerCase(), E.trim().toLowerCase());
    const okClave = igual(String(body.clave || ''), P);
    if (!(okMail && okClave)) {
      await anotar(ip, 'admin');
      return json({ error: 'Correo o clave incorrectos.' }, 401);
    }
    return json({ token: firmar({ rol: 'admin' }, 8 * 60) });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/admin-login' };
