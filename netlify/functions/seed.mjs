// Función temporal de carga inicial de datos históricos.
// Llámala UNA VEZ con: POST /api/seed  {clave: "ALENA_SEED_2026"}
// Después del commit y ejecución, BORRA este archivo y haz otro commit.
import { ensureSchema, fallo, json, q, pin4 } from '../lib/util.mjs';

const CLAVE = 'ALENA_SEED_2026';

// ── Contactos (Solo preguntaron, sin pedido) ──────────────────────────────────
const CONTACTOS = [
  { nombre: 'Juan',                          telefono: '3143601378', etiqueta: 'Baby Shower' },
  { nombre: 'María del Carmen Hernandez',    telefono: '3123007958', etiqueta: 'Cumpleaños' },
  { nombre: 'Jackeline Ortiz',               telefono: '3136998373', etiqueta: 'Cumpleaños' },
  { nombre: 'Danelys',                       telefono: '3018281304', etiqueta: 'Cumpleaños' },
  { nombre: 'Hector Castro',                 telefono: '3124157111', etiqueta: 'Cumpleaños' },
  { nombre: 'Maxi James',                    telefono: '3134647442', etiqueta: 'Baby Shower' },
  { nombre: 'Alexa',                         telefono: '3144924198', etiqueta: 'Cumpleaños' },
  { nombre: null,                            telefono: '3238143777', etiqueta: 'Cumpleaños' },
  { nombre: 'Diana Arevalo',                 telefono: '3332507969', etiqueta: 'Cumpleaños' },
  { nombre: 'Javier Scarpeta',               telefono: '3103184619', etiqueta: 'Cumpleaños' },
  { nombre: 'Yarilis Zuniga Torres',         telefono: '3112180262', etiqueta: 'Cumpleaños' },
  { nombre: null,                            telefono: '3209864628', etiqueta: 'Matrimonio' },
  { nombre: 'Jhonathan',                     telefono: '3219033697', etiqueta: 'Cumpleaños' },
  { nombre: 'Deisi Cubides',                 telefono: '3006688682', etiqueta: 'Cumpleaños' },
  { nombre: 'Angela Salazar',                telefono: '3132642633', etiqueta: 'Cumpleaños' },
  { nombre: 'Juliana',                       telefono: '3180066663', etiqueta: 'Cumpleaños' },
  { nombre: 'Sofía',                         telefono: '3208918195', etiqueta: 'Baby Shower' },
  { nombre: 'Martha Isabel',                 telefono: '3209491784', etiqueta: 'Cumpleaños' },
  { nombre: 'Alejandra',                     telefono: '3143388960', etiqueta: 'Cumpleaños' },
  { nombre: 'Wendy Mendoza',                 telefono: '3013075927', etiqueta: 'Baby Shower' },
  { nombre: 'Zulma Quiroga',                 telefono: '3125862120', etiqueta: 'Cumpleaños' },
  { nombre: 'Andrea',                        telefono: '3125710175', etiqueta: 'Revelación de género' },
  { nombre: null,                            telefono: '3227398356', etiqueta: 'Cumpleaños' },
  { nombre: 'Marcela Ramirez',               telefono: '3214776227', etiqueta: 'Bautizo' },
  { nombre: 'Jairo Arévalo',                 telefono: '3132126848', etiqueta: 'Baby Shower' },
  { nombre: 'Rocío Salazar',                 telefono: '3115850405', etiqueta: 'Bautizo' },
  { nombre: 'Luna',                          telefono: '3150683885', etiqueta: 'Baby Shower y Revelación de género' },
  { nombre: 'Carolina Guerrero',             telefono: '3208737264', etiqueta: 'Bautizo' },
  { nombre: 'Omaira',                        telefono: '3105658339', etiqueta: 'Baby Shower' },
  { nombre: 'Yoxe',                          telefono: '3125456243', etiqueta: 'Cumpleaños' },
  { nombre: 'Diana Castellanos',             telefono: '3114668772', etiqueta: 'Cumpleaños niño 2 años' },
  { nombre: 'Ingrid Herrera',                telefono: '3202340163', etiqueta: 'Decoración 15 años' },
  { nombre: null,                            telefono: '3125523952', etiqueta: 'Revelación de género' },
  { nombre: 'Andrea',                        telefono: '3155306370', etiqueta: 'Quince años' },
  { nombre: null,                            telefono: '3134086924', etiqueta: 'Cumpleaños' },
  { nombre: 'Sonia Cruz',                    telefono: '3174858753', etiqueta: 'Decoración 15 años' },
  { nombre: 'Paula Gonzales',                telefono: '3123320758', etiqueta: 'Cumpleaños' },
  { nombre: 'Johana',                        telefono: '3118404430', etiqueta: 'Decoración 15 años' },
  { nombre: 'Javier',                        telefono: '3163021821', etiqueta: 'Decoración boda' },
  { nombre: 'Michael Hernandez',             telefono: '3102442787', etiqueta: 'Cumpleaños 6 años' },
  { nombre: 'Paola',                         telefono: '3011012085', etiqueta: 'Alquiler sillas' },
  { nombre: 'Paola Rojas',                   telefono: '3132244300', etiqueta: 'Bautizo' },
  { nombre: 'Erika Nossa',                   telefono: '3044100095', etiqueta: 'Bautizo y cumpleaños 1 año' },
  { nombre: 'Camilo Vallejo',                telefono: '3183902822', etiqueta: 'Baby Shower' },
  { nombre: 'Yina Lorena Mendoza',           telefono: '3204700237', etiqueta: 'Baby Shower' },
  { nombre: 'Maria Luisa Camelo',            telefono: null,         etiqueta: 'Mobiliario picnic' },
  { nombre: 'Gonzalo',                       telefono: '3043731179', etiqueta: null },
  { nombre: 'Geraldine',                     telefono: '3203287479', etiqueta: 'Curso bombas' },
  { nombre: 'Jonathan Rodriguez',            telefono: '3229420455', etiqueta: 'Baby Shower' },
  { nombre: 'Valentina',                     telefono: '3126005602', etiqueta: 'Cumpleaños spiderman' },
  { nombre: 'Kathy',                         telefono: null,         etiqueta: 'Baby shower' },
  { nombre: 'Valentina',                     telefono: null,         etiqueta: 'Cumpleaños' },
  { nombre: 'Yesica Velasco',                telefono: null,         etiqueta: 'Mesas' },
  { nombre: 'Mónica T González',             telefono: '3114596366', etiqueta: 'Cumpleaños 4 años' },
  { nombre: 'Laura',                         telefono: '3052432984', etiqueta: 'Cumpleaños' },
  { nombre: 'Jesús Juez',                    telefono: '3223653877', etiqueta: 'Primera comunión' },
  { nombre: null,                            telefono: '3102438008', etiqueta: 'Revelación de género' },
  { nombre: 'José Luis',                     telefono: '3186162980', etiqueta: 'Baby shower' },
  { nombre: 'Francy',                        telefono: null,         etiqueta: 'Decoración 15 años' },
  { nombre: 'Diana Ruiz',                    telefono: null,         etiqueta: 'Guerreras kpop' },
  { nombre: null,                            telefono: '3142580012', etiqueta: 'Revelación de género' },
  { nombre: 'Andres Salas',                  telefono: null,         etiqueta: 'Cumpleaños 50' },
  { nombre: 'Tatiana',                       telefono: '3195421855', etiqueta: 'Pedida de mano' },
  { nombre: null,                            telefono: '3118662071', etiqueta: 'Decoración colegio' },
  { nombre: null,                            telefono: '3005073357', etiqueta: 'Baby shower' },
  { nombre: 'Paola',                         telefono: '3143745645', etiqueta: 'Cumpleaños' },
  { nombre: 'Monica Barragan',               telefono: null,         etiqueta: 'Bodas de oro' },
  { nombre: 'Sally Valentina',               telefono: null,         etiqueta: 'Amor y amistad' },
  { nombre: 'María Alejandra',               telefono: '3204678059', etiqueta: 'Decoración 30 años' },
  { nombre: 'Sofia Villarraga',              telefono: null,         etiqueta: 'Decoración 1 año' },
  { nombre: 'Yadira',                        telefono: '3212228209', etiqueta: 'Decoración 15 años' },
];

// ── Pedidos históricos (hoja Eventos) ────────────────────────────────────────
// modalidad: alquiler = los que dicen "Alquiler", decoracion = el resto
// paso: último paso = completado. Para alquiler son 7 pasos (índice 6), decoracion 8 pasos (índice 7).
// visible: false — solo el equipo los ve
const PASOS_ALQ = 6; // índice del último paso de alquiler
const PASOS_DEC = 7; // índice del último paso de decoracion

const PEDIDOS = [
  {
    nombre: 'Johan Bernal',       telefono: '3115183217', modalidad: 'decoracion',
    tipo_evento: 'Decoración Cumpleaños',
    fecha_evento: '2026-01-03',   lugar: 'Cogua · Restaurante del evento de miguel',
    total: 180000, abonado: 180000,
  },
  {
    nombre: 'Ximena Pineda',      telefono: '3053220925', modalidad: 'decoracion',
    tipo_evento: 'Decoración 15 años',
    fecha_evento: '2026-04-25',   lugar: 'Zipaquirá · Hospedería Catedral de Sal',
    total: 280000, abonado: 280000,
  },
  {
    nombre: 'Ivonne Gaviria',     telefono: '3206328677', modalidad: 'alquiler',
    tipo_evento: 'Alquiler mobiliario',
    fecha_evento: '2026-06-20',   lugar: 'Zipaquirá · Oikos Versalles Torre 4 apt 403',
    total: 110000, abonado: 110000,
  },
  {
    nombre: 'Lisseth Florez',     telefono: '12019263624', modalidad: 'decoracion',
    tipo_evento: 'Decoración apartamento — Bienvenida a tu nuevo hogar',
    fecha_evento: '2026-07-18',   lugar: 'Zipaquirá · La quinta 3 T6 apt 605',
    total: 230000, abonado: 230000,
  },
  {
    nombre: 'Leidy Rodriguez Jiménez', telefono: '3105663561', modalidad: 'decoracion',
    tipo_evento: 'Decoración Bautizo y cumpleaños 7 años',
    fecha_evento: '2026-07-19',   lugar: 'Tausa · Boquerón',
    total: 400000, abonado: 400000,
  },
  {
    nombre: 'Carlos Cabra',       telefono: '3213378859', modalidad: 'decoracion',
    tipo_evento: 'Decoración 28 años "Toy Story"',
    fecha_evento: '2026-07-26',   lugar: 'Zipaquirá · Club del comercio casa 24',
    total: 435000, abonado: 435000,
  },
  {
    nombre: 'Leidy Linero',       telefono: '3125307484', modalidad: 'decoracion',
    tipo_evento: 'Decoración cumpleaños',
    fecha_evento: '2026-08-07',   lugar: 'Zipaquirá · Conjunto Los Cedros',
    total: 170000, abonado: 170000,
  },
  {
    nombre: 'Julieth Carreño',    telefono: '3006652813', modalidad: 'decoracion',
    tipo_evento: 'Decoración 40 años',
    fecha_evento: '2026-08-16',   lugar: 'Cajica · Gipsy Grill Park',
    total: 410000, abonado: 410000,
  },
  {
    nombre: 'María Rojas',        telefono: '3015874761', modalidad: 'decoracion',
    tipo_evento: 'Decoración Revelación de género',
    fecha_evento: '2026-08-22',   lugar: 'Zipaquirá · San Simón La quinta',
    total: 280000, abonado: 280000,
  },
  {
    nombre: 'Johanna',            telefono: '3213240284', modalidad: 'decoracion',
    tipo_evento: 'Decoración Baby Shower',
    fecha_evento: '2026-08-30',   lugar: 'Zipaquirá · Conjunto Botanika',
    total: 430000, abonado: 430000,
  },
  {
    nombre: 'Valentina Cubillos', telefono: '3212838633', modalidad: 'alquiler',
    tipo_evento: 'Alquiler "7,0", estructura y Happy Birthday',
    fecha_evento: '2026-09-04',   lugar: 'Zipaquirá · San Miguel y El Mortiño',
    total: 175000, abonado: 175000,
  },
  {
    nombre: 'Ximena Benavides',   telefono: '3118562817', modalidad: 'decoracion',
    tipo_evento: 'Decoración 80 años',
    fecha_evento: '2026-09-19',   lugar: 'Zipaquirá · Salón Comunal San Carlos',
    total: 340000, abonado: 340000,
  },
  {
    nombre: 'Natalia Suarez',     telefono: '3204673529', modalidad: 'alquiler',
    tipo_evento: 'Alquiler arco',
    fecha_evento: '2026-09-19',   lugar: 'Zipaquirá · Hacienda San Rafael',
    total: 20000, abonado: 20000,
  },
  {
    nombre: 'Viviana Lemus',      telefono: '3166969231', modalidad: 'decoracion',
    tipo_evento: 'Decoración 80 años',
    fecha_evento: '2026-09-20',   lugar: 'Zipaquirá · La toscana Arezzo',
    total: 390000, abonado: 390000,
  },
  {
    nombre: 'Johan',              telefono: '3214558155', modalidad: 'decoracion',
    tipo_evento: 'Decoración Baby Shower',
    fecha_evento: '2026-09-27',   lugar: 'Cogua · Vereda La Chapa',
    total: 480000, abonado: 480000,
  },
  {
    nombre: 'Mariana Villarraga', telefono: null, modalidad: 'alquiler',
    tipo_evento: 'Alquiler arco tela blanca',
    fecha_evento: '2026-10-10',   lugar: 'Zipaquirá · La quinta 1',
    total: 45000, abonado: 45000,
  },
  {
    nombre: 'Andrea Nataly Oliveros Enciso', telefono: '3102255181', modalidad: 'decoracion',
    tipo_evento: 'Decoración Revelación de género',
    fecha_evento: '2026-10-11',   lugar: 'Zipaquirá · San Simón La quinta',
    total: 400000, abonado: 400000,
  },
  {
    nombre: 'Viviana Franco',     telefono: '3142550663', modalidad: 'decoracion',
    tipo_evento: 'Decoración Revelación de género',
    fecha_evento: '2026-10-17',   lugar: 'Cogua · Embalse del Neusa',
    total: 435000, abonado: 435000,
  },
  {
    nombre: 'Pilar Buitrago',     telefono: '3112393861', modalidad: 'decoracion',
    tipo_evento: 'Decoración Baby Shower',
    fecha_evento: '2026-10-18',   lugar: 'Cogua · El altico',
    total: 300000, abonado: 300000,
  },
  {
    nombre: 'Stfanny Arias Peña', telefono: '3024553358', modalidad: 'decoracion',
    tipo_evento: 'Decoración 30 años',
    fecha_evento: '2026-10-25',   lugar: 'Zipaquirá · Hacienda vista hermosa zona franca',
    total: 310000, abonado: 310000,
  },
  {
    nombre: 'Yesica Velasco',     telefono: '3138518566', modalidad: 'alquiler',
    tipo_evento: 'Alquiler mesas y estructura',
    fecha_evento: '2026-10-30',   lugar: 'Zipaquirá · La libertad',
    total: 70000, abonado: 70000,
  },
  {
    nombre: 'Paola',              telefono: '3143745645', modalidad: 'decoracion',
    tipo_evento: 'Decoración cumpleaños',
    fecha_evento: '2026-10-17',   lugar: 'Zipaquirá · Los pinos',
    total: 280000, abonado: 280000,
  },
];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    await ensureSchema();
    const b = await req.json().catch(() => ({}));
    if (b.clave !== CLAVE) return json({ error: 'Clave incorrecta.' }, 403);

    // Crear tabla contactos si no existe (por si extras.mjs aún no corrió)
    await q(`CREATE TABLE IF NOT EXISTS contactos (
      id serial PRIMARY KEY,
      nombre text,
      telefono text,
      etiqueta text,
      notas text,
      creado timestamptz NOT NULL DEFAULT now(),
      actualizado timestamptz NOT NULL DEFAULT now()
    )`);

    // Insertar contactos ignorando duplicados por teléfono
    let ctInsertados = 0, ctOmitidos = 0;
    for (const c of CONTACTOS) {
      const tel = c.telefono || null;
      const nom = c.nombre || null;
      if (!tel && !nom) { ctOmitidos++; continue; }
      // Verificar duplicado por teléfono si tiene teléfono
      if (tel) {
        const existe = await q(`SELECT 1 FROM contactos WHERE telefono = $1`, [tel]);
        if (existe.length) { ctOmitidos++; continue; }
      }
      await q(`INSERT INTO contactos (nombre, telefono, etiqueta) VALUES ($1, $2, $3)`,
        [nom, tel, c.etiqueta || null]);
      ctInsertados++;
    }

    // Insertar pedidos históricos
    let pedInsertados = 0, pedOmitidos = 0;
    for (const p of PEDIDOS) {
      // No duplicar si ya existe un pedido con mismo nombre y fecha
      const existe = await q(
        `SELECT 1 FROM pedidos WHERE nombre=$1 AND fecha_evento=$2::date`,
        [p.nombre, p.fecha_evento]
      );
      if (existe.length) { pedOmitidos++; continue; }

      const paso = p.modalidad === 'alquiler' ? PASOS_ALQ : PASOS_DEC;
      const historial = JSON.stringify({ [paso]: new Date().toISOString() });

      await q(`INSERT INTO pedidos
        (nombre, telefono, modalidad, tipo_evento, fecha_evento, lugar,
         paso, historial, total, abonado, deposito, visible, items, notas_internas, pin)
        VALUES ($1,$2,$3,$4,$5::date,$6,$7::int,$8::jsonb,$9::int,$10::int,0,false,'[]'::jsonb,'',$11)`,
        [p.nombre, p.telefono || null, p.modalidad, p.tipo_evento,
         p.fecha_evento, p.lugar, paso, historial,
         p.total, p.abonado, pin4()]);
      pedInsertados++;
    }

    return json({
      ok: true,
      contactos: { insertados: ctInsertados, omitidos: ctOmitidos },
      pedidos:   { insertados: pedInsertados, omitidos: pedOmitidos },
    });
  } catch (e) { return fallo(e); }
};

export const config = { path: '/api/seed' };
