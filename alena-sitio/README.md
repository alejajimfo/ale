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
1. Panel → «Nuevo pedido»: elige las piezas del catálogo (con buscador), agrega «Otros» (globos, montaje y desmontaje, transporte…) y el total se suma solo. Llena además nombre, **cédula y/o celular**, estado, mensaje y valores.
2. Sube cotización, conformidad firmada, recibos o fotos (PDF/JPG/PNG, máx. 3 MB) y toca «Subir documento».
3. Activa «Habilitar para el cliente» y guarda. Al guardar, el pedido recibe un **PIN de 4 números** (se ve en el panel).
4. Toca «Enviar enlace al cliente»: se abre WhatsApp con el enlace y el PIN ya escritos. Se envía una sola vez.
5. El cliente entra a `tu-sitio/#pedido` → «Ingresar con código» → escribe su cédula o celular y su PIN. El acceso dura 24 horas en ese navegador.
6. Si el PIN se filtra: «Generar nuevo» en el pedido; el anterior deja de funcionar.

## Seguridad (todo gratis, sin servicios externos)
- Admin y clave solo viven en variables de entorno; el acceso del admin dura 8 h y el del cliente 24 h.
- Para ver un pedido hacen falta DOS cosas: cédula o celular + PIN. El cliente solo ve pedidos y documentos marcados «visibles»; nunca las notas internas ni el PIN.
- El PIN tiene solo 4 números, por eso hay bloqueo: 5 intentos fallidos con los mismos datos bloquean 30 minutos, y 10 fallos desde una misma conexión también.
- Si los datos no coinciden, el mensaje es siempre el mismo (no revela qué clientes existen).
- Si alguien bloquea a un cliente a propósito, el cliente puede escribirte por WhatsApp o esperar 30 minutos.

## Novedades: recogida programada y opiniones con aprobación
- **Recogida programada (solo alquiler):** en el pedido, escribe el campo «Recogida programada» (ej: «Jueves 28, 10 a. m.»). El cliente la ve en su línea de tiempo, después de «Evento», y como aviso debajo. Si lo dejas vacío no aparece nada.
- **Opiniones:** cuando el pedido llega al paso «Evento» (o posterior), el cliente ve en «Mi pedido» un formulario con estrellas y comentario (1 por pedido). Queda **pendiente**; solo sale en la sección pública «Opiniones» cuando la apruebas en el panel → pestaña «Opiniones» (Aprobar, Ocultar, Eliminar). Se publica con su primer nombre y la inicial del apellido. Las tablas nuevas se crean solas al desplegar.
