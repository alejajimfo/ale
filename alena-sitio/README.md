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
1. Panel → «Nuevo pedido»: nombre, **celular (obligatorio para habilitarlo: ahí llega el código)**, cédula (opcional), estado, mensaje y valores.
2. Sube cotización, conformidad firmada, recibos o fotos (PDF/JPG/PNG, máx. 3 MB) y toca «Subir documento».
3. Activa «Habilitar para el cliente», guarda y toca «Enviar enlace al cliente» (abre WhatsApp con el enlace).
4. El cliente entra a `tu-sitio/#pedido` → «Ingresar con código» → escribe su cédula o celular → recibe un código de 4 números por WhatsApp → lo escribe y ve su pedido. El acceso dura 24 horas en ese navegador.

## Cómo llega el código de 4 números
- **Modo manual (funciona ya, sin configurar nada):** cuando un cliente pide su código, aparece en el panel → pestaña **Códigos**. Tocas «Enviar por WhatsApp» y se abre el chat con el mensaje listo. El código sirve 1 hora.
- **Modo automático (opcional):** con la API oficial de WhatsApp Business (Meta) los códigos salen solos. Necesitas una plantilla de *autenticación* aprobada por Meta y estas variables en Netlify: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` (nombre de la plantilla, por defecto `codigo_acceso`) y `WHATSAPP_LANG` (por defecto `es`). Si el envío automático falla, el código cae a la pestaña Códigos.

## Seguridad
- Admin y clave solo viven en variables de entorno; el acceso del admin dura 8 h y el del cliente 24 h.
- El código de 4 números sirve una sola vez, vence en 1 hora y se anula tras 5 intentos fallidos. Máximo 3 códigos por hora por cliente.
- Siempre se envía al celular registrado en el pedido, nunca a uno que escriba quien consulta, y la respuesta es igual exista o no el pedido.
- El cliente solo ve pedidos y documentos marcados «visibles»; nunca las notas internas.
