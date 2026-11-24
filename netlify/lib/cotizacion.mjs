// Genera la cotización en PDF de un pedido (mismo diseño de la cotización de ALENA, con valores por ítem).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_JPG_B64 } from './logo.mjs';

const MARRON = rgb(0.545, 0.369, 0.235);
const CREMA = rgb(0.965, 0.925, 0.886);
const GRIS = rgb(0.38, 0.38, 0.38);
const NEGRO = rgb(0.1, 0.1, 0.1);
const W = 612, H = 792, MX = 40;

const cop = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const limpia = (s) => String(s ?? '').replace(/[^\x20-\x7E -ÿ‘’“”–—•€\n]/g, '').trim();
const fechaCorta = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '-';
const hoyBogota = () => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

function lineas(font, size, texto, ancho) {
  const out = [];
  for (const parrafo of limpia(texto).split('\n')) {
    let actual = '';
    for (const pal of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? actual + ' ' + pal : pal;
      if (font.widthOfTextAtSize(prueba, size) <= ancho) actual = prueba;
      else { if (actual) out.push(actual); actual = pal; }
    }
    out.push(actual);
  }
  return out;
}

/** p: fila de pedidos (nombre, telefono, lugar, fecha_evento, items[{n,c,p}], total, abonado, deposito, detalle, mensaje, recogida, modalidad) */
export async function cotizacionPdf(p) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cotización ALENA - ${limpia(p.nombre)}`);
  pdf.setAuthor('ALENA');
  const reg = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const ital = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await pdf.embedJpg(Buffer.from(LOGO_JPG_B64, 'base64'));

  let page = pdf.addPage([W, H]);
  const txt = (t, x, y, o = {}) => page.drawText(limpia(t), { x, y, size: o.size || 10, font: o.font || reg, color: o.color || NEGRO });
  const centro = (t, cx, y, o = {}) => { const f = o.font || reg, s = o.size || 10; txt(t, cx - f.widthOfTextAtSize(limpia(t), s) / 2, y, o); };
  const derecha = (t, xr, y, o = {}) => { const f = o.font || reg, s = o.size || 10; txt(t, xr - f.widthOfTextAtSize(limpia(t), s), y, o); };
  const rect = (x, y, w, h, o = {}) => page.drawRectangle({ x, y, width: w, height: h, borderColor: MARRON, borderWidth: 0.7, ...o });

  // Encabezado
  page.drawImage(logo, { x: MX, y: H - 40 - 56, width: 56, height: 56 });
  derecha('FECHA', W - MX, H - 46, { font: ital, color: MARRON, size: 10 });
  derecha(hoyBogota(), W - MX, H - 60, { font: ital, color: MARRON, size: 10 });
  const t = 'A L E N A';
  centro(t, W / 2, H - 92, { font: bold, size: 22, color: MARRON });

  // Datos
  let y = H - 135;
  const datos = [['Contacto', p.nombre], ['Fecha Evento', fechaCorta(p.fecha_evento)], ['Lugar', p.lugar || '-'], ['Teléfono', p.telefono || '-']];
  for (const [k, v] of datos) { txt(k, MX, y, { font: bold, color: MARRON }); txt(v || '-', MX + 90, y); y -= 16; }

  // Tabla de ítems
  const items = Array.isArray(p.items) ? p.items : [];
  const cols = [{ n: 'Ítem', w: 40 }, { n: 'Producto', w: 322 }, { n: 'Cant.', w: 50 }, { n: 'V. unit.', w: 60 }, { n: 'Valor', w: 60 }];
  const xs = []; let acc = MX; for (const c of cols) { xs.push(acc); acc += c.w; }
  const tablaW = acc - MX, RH = 17;
  y -= 14;
  const cabecera = () => {
    rect(MX, y - RH, tablaW, RH, { color: CREMA });
    cols.forEach((c, i) => { if (i) page.drawLine({ start: { x: xs[i], y }, end: { x: xs[i], y: y - RH }, thickness: 0.7, color: MARRON }); centro(c.n, xs[i] + c.w / 2, y - (i >= 3 ? 11.5 : 12), { font: bold, color: MARRON, size: i >= 3 ? 8 : 10 }); });
    y -= RH;
  };
  const fila = (vals, i) => {
    rect(MX, y - RH, tablaW, RH, { borderWidth: 0.5 });
    cols.forEach((c, k) => { if (k) page.drawLine({ start: { x: xs[k], y }, end: { x: xs[k], y: y - RH }, thickness: 0.5, color: MARRON }); });
    if (vals) {
      centro(vals[0], xs[0] + cols[0].w / 2, y - 12);
      let nombre = limpia(vals[1]); while (nombre.length > 1 && reg.widthOfTextAtSize(nombre, 10) > cols[1].w - 12) nombre = nombre.slice(0, -1);
      txt(nombre, xs[1] + 6, y - 12);
      centro(vals[2], xs[2] + cols[2].w / 2, y - 12);
      derecha(vals[3], xs[3] + cols[3].w - 5, y - 11.5, { size: 8, color: GRIS });
      derecha(vals[4], xs[4] + cols[4].w - 5, y - 11.5, { size: 8, color: GRIS });
    }
    y -= RH;
  };
  cabecera();
  const total_filas = Math.max(12, items.length);
  for (let i = 0; i < total_filas; i++) {
    if (y - RH < 150) { page = pdf.addPage([W, H]); y = H - 50; cabecera(); }
    const it = items[i];
    fila(it ? [String(i + 1), it.n, String(it.c), cop(it.p), cop(it.c * it.p)] : null, i);
  }

  // Totales
  const suma = items.reduce((a, it) => a + it.c * it.p, 0);
  const bruto = items.length ? suma : (p.total || 0);
  const neto = items.length ? (p.total > 0 && p.total <= suma ? p.total : suma) : (p.total || 0);
  const desc = Math.max(0, bruto - neto);
  const abono = p.abonado || 0;
  const saldo = Math.max(0, neto - abono);
  // «Total pago» va al final y en blanco: ahí se pone el sello cuando el cliente paga todo
  const filasT = [['TOTAL', cop(bruto), 18], ['Descuento', desc ? '-' + cop(desc) : '', 18], ['Abono', abono ? cop(abono) : '', 18], ['Saldo', cop(saldo), 18], ['Total pago', '', 40]];
  const bloqueH = filasT.reduce((a, f) => a + f[2], 0);
  if (y - bloqueH < 170) { page = pdf.addPage([W, H]); y = H - 50; }
  const tx = xs[2], tw = tablaW - (tx - MX), LW = 78;
  // Comentarios
  const com = [];
  if (p.detalle) com.push(p.detalle);
  else if (p.mensaje) com.push(p.mensaje);
  if (p.modalidad === 'alquiler' && p.recogida) com.push('Recogida: ' + p.recogida);
  rect(MX, y - bloqueH, tx - MX, bloqueH, {});
  if (com.length) {
    const ls = lineas(ital, 9.5, 'Comentarios: ' + com.join('\n'), tx - MX - 12).slice(0, 6);
    ls.forEach((l, i) => txt(l, MX + 6, y - 14 - i * 12, { font: ital, color: MARRON, size: 9.5 }));
  }
  let yy = y;
  for (const [k, v, h] of filasT) {
    rect(tx, yy - h, LW, h, { borderWidth: 0.5 }); rect(tx + LW, yy - h, tw - LW, h, { borderWidth: 0.5 });
    txt(k, tx + 6, yy - (h > 18 ? 13 : 13), { font: bold, color: MARRON });
    if (v) derecha(v, MX + tablaW - 6, yy - 13, { font: k === 'Saldo' ? bold : reg });
    yy -= h;
  }
  y -= bloqueH + 26;

  // Condiciones
  const dep = p.deposito > 0 ? cop(p.deposito) : 'el valor indicado por ALENA';
  const bloques = [
    'Separación de fecha: El servicio se asegura mediante un anticipo del 50% del valor total de la cotización. Para realizar el pago, puede utilizar la cuenta de Nequi o Bre-B al número 3132287350 a nombre de Laura Jiménez, enviando el comprobante de pago al WhatsApp 3143425264.',
    'Política de devolución: Entendemos que los planes pueden cambiar debido a imprevistos o fuerza mayor. En caso de cancelación total del evento por parte del cliente, se le devolverá el valor restante de su anticipo, descontando únicamente una tarifa fija de $50.000. Este valor corresponde a los gastos administrativos, de asesoría y al bloqueo exclusivo de la fecha en nuestra agenda.',
    `Se requiere un depósito en garantía por un valor de ${dep}, el cual se cancela previamente o el día de entrega. Este monto es reembolsable en su totalidad una vez finalizado el evento y verificado que todo el mobiliario y los elementos decorativos alquilados sean entregados en las mismas condiciones en que se recibieron. En caso de daños, faltantes o deterioro de las piezas, se descontará de este depósito el costo de reparación o reposición correspondiente.`,
    'Si el servicio ya se encuentra en fase de montaje inmediato o preparación de materiales exclusivos (como compras previas de insumos específicos para su evento), no se podrán realizar reembolsos ni modificaciones del inventario contratado.' + (p.modalidad === 'alquiler' ? '\nTodos los elementos y mobiliario detallados en esta cotización son exclusivamente bajo la modalidad de alquiler.' : ''),
    'Las solicitudes de cambio de fecha estarán sujetas estrictamente a disponibilidad. En caso de no ser viable, se considerará cancelación.',
  ];
  const CW = W - 2 * MX - 20, FS = 8;
  for (const b of bloques) {
    const ls = lineas(reg, FS, b, CW);
    if (y - ls.length * 10 < 40) { page = pdf.addPage([W, H]); y = H - 50; }
    ls.forEach((l) => { centro(l, W / 2, y, { size: FS, color: GRIS }); y -= 10; });
    y -= 8;
  }
  centro('@alenadecora | 314 3425264', W / 2, Math.max(y, 30), { size: FS, color: GRIS });
  return await pdf.save();
}
