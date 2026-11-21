# ALENA · sitio + portal de pedidos (Netlify + Neon)

## Qué hay aquí
- `public/index.html` – el sitio (opiniones corregidas, carrusel de Instagram, «Mi pedido»).
- `public/admin.html` – panel del equipo (se entra desde «Mi pedido» → «Inicia sesión»).
- `netlify/functions/` – el servidor (usa tu base de datos Neon). Las tablas se crean solas.

## Puesta en marcha (una sola vez)
1. Sube esta carpeta a un repositorio de GitHub y conéctalo en Netlify (o arrastra la carpeta si usas Netlify CLI). Netlify instala solo `@neondatabase/serverless`.
2. En Neon copia la cadena de conexión (Connection string, con pooling). En Netlify → Site configuration → Environment variables crea:
   - `DATABASE_URL` = la cadena de Neon (si usaste la integración Neon de Netlify, ya existe `NETLIFY_DATABASE_URL` y no hace falta).
   - `ADMIN_EMAIL` = tu correo de administrador.
   - `ADMIN_PASSWORD` = una clave larga.
   - `JWT_SECRET` = texto aleatorio de 32+ caracteres.
3. Haz deploy. Entra a `tu-sitio/#pedido` → «Inicia sesión».
4. En el panel → «Ajustes del sitio»: activa «Habilitar Mi pedido» y pega los enlaces de tus publicaciones de Instagram.

## Uso diario
1. Panel → «Nuevo pedido»: nombre, cédula y/o celular, estado, mensaje, valores.
2. Sube cotización, conformidad firmada, recibos o fotos (PDF/JPG/PNG, máx. 3 MB).
3. Activa «Habilitar para el cliente», guarda y usa «Enviar enlace al cliente» (abre WhatsApp).
4. El cliente entra a `tu-sitio/#pedido` → «Ingresar con código» con su cédula o celular.

## Seguridad
- Admin y clave solo viven en variables de entorno; las sesiones vencen (8 h admin, 30 min cliente).
- Límite de intentos por IP (admin: 6 / 15 min; clientes: 12 / 10 min).
- El cliente solo ve pedidos marcados «visibles» y documentos marcados «visibles»; nunca las notas internas.
- Ojo: la cédula/celular como único código es práctico pero débil (alguien que conozca esos datos podría ver el pedido). Si quieres más seguridad se puede agregar un PIN por pedido.
