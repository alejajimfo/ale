// POST /api/descuento {codigo, modalidad, items:{idPieza:cantidad}} -> valida un código de descuento (público, sin sesión)
// El descuento se calcula aquí con los precios del servidor: el cliente solo recibe el resultado (pesos y %).
import { CATALOGO, PRECIO } from '../lib/catalogo.mjs';
import { anotar, ensureSchema, fallo, ipDe, json, limitado, normCodigo, q } from '../lib/util.mjs';

export default async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    await ensureSchema();
    const ip = ipDe(req, ctx);
    if (await limitado(ip, 'descuento', 10, 15)) return json({ ok: false, error: 'Demasiados intentos. Inténtalo en unos minutos o escríbenos por WhatsApp.' }, 429);
    const b = await req.json().catch(() => ({}));
    const norm = normCodigo(b.codigo);
    const alquiler = b.modalidad !== 'cotizar' && b.modalidad !== 'decoracion';
    const c = norm ? (await q(`SELECT codigo, valor_alquiler, valor_decoracion, items FROM descuentos WHERE norm = $1 AND activo`, [norm]))[0] : null;
    if (!c) { await anotar(ip, 'descuento'); return json({ ok: false, error: 'Ese código no es válido. Revisa que esté bien escrito.' }, 200); }
    const especiales = c.items && typeof c.items === 'object' ? c.items : {};
    const hayItems = Object.keys(especiales).length > 0;
    const fijo = alquiler ? c.valor_alquiler : c.valor_decoracion;
    if (!fijo && !(alquiler && hayItems)) return json({ ok: false, error: alquiler ? 'Este código no aplica para alquiler simple.' : 'Este código no aplica para decoración con montaje.' }, 200);
    if (!alquiler) return json({ ok: true, codigo: c.codigo, descuento: null, pct: null });

    // Subtotal y descuento por pieza, con los precios del servidor
    let sub = 0, porPieza = 0;
    for (const [id, cant] of Object.entries(b.items && typeof b.items === 'object' ? b.items : {})) {
      const n = Math.max(0, Math.min(99, parseInt(cant, 10) || 0));
      if (PRECIO[id] === undefined || !n) continue;
      sub += n * PRECIO[id];
      if (especiales[id] !== undefined && especiales[id] < PRECIO[id]) porPieza += n * (PRECIO[id] - especiales[id]);
    }
    const desc = Math.min(sub, (fijo && sub ? fijo : 0) + porPieza);
    const res = { ok: true, codigo: c.codigo, descuento: desc, pct: sub ? Math.round((desc / sub) * 1000) / 10 : 0 };
    if (hayItems && !porPieza) res.piezas = CATALOGO.filter((x) => especiales[x[0]] !== undefined).map((x) => x[1]).slice(0, 8);
    return json(res);
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/descuento' };
