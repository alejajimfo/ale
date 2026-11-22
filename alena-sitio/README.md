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
7. **Alquileres → Recogida programada:** en un pedido de alquiler, escribe en «Recogida programada» el día, la hora y el lugar. El cliente lo ve en su línea de tiempo (paso 5) y en un recuadro destacado. En decoración con montaje no aplica.
8. **Opiniones con estrellas:** cuando el pedido llega al paso «Evento», el cliente ve en «Mi pedido» un formulario de 1 a 5 estrellas + comentario. Queda *pendiente*; entra al panel → pestaña **Opiniones** (muestra un contador de pendientes) y toca «Aprobar y publicar». Solo las aprobadas salen en la sección pública Opiniones (con nombre + inicial del apellido). También puedes rechazar, quitar del sitio o eliminar.
10. **Lista del panel:** arriba hay tres botones: *En proceso*, *Finalizados* y *Todos* (con su conteo). Los pedidos finalizados salen en **rojo**. Se ordenan por fecha del evento (próximos primero, más recientes primero, o últimos creados) y se agrupan por mes. La búsqueda mira todos los pedidos. Cada fila muestra total, saldo y, si falta, «Depósito por devolver».
11. **Descuento y depósito:** en «Cuentas del pedido» escribes subtotal, descuento (con motivo), abonado, depósito y cuánto del depósito se devolvió (con fecha, o el botón «Marcar depósito devuelto completo»). Solo tú puedes editarlos. El cliente ve el desglose completo: valor, descuento, total a pagar, abonado, saldo, depósito y si ya se le devolvió.
12. **Códigos de descuento:** panel → pestaña «Códigos de descuento». Escribe el texto que quieras (ej: BAUTIZO2026). El descuento puede ser (a) un valor fijo en pesos para alquiler y/o montaje, (b) un **precio especial en las piezas que habilites** (buscas la pieza, escribes el precio con el código y el panel te muestra el **%**; también puedes escribir el % y calcula el precio, o poner un % a todas), o ambos. El cliente escribe el código en su carrito y ve el descuento **en %**; los pesos no se muestran. Se ignoran mayúsculas, tildes y espacios. Puedes editar, desactivar o eliminar. El código viaja en el mensaje de WhatsApp; al crear el pedido, escríbelo en «Aplicar un código de descuento» y se llena el descuento solo (suma el precio especial de las piezas que estén en el pedido). Tras 10 intentos fallidos la persona queda bloqueada 15 minutos.
13. **Si cambias precios o piezas del catálogo** en `public/index.html`, actualiza también `netlify/lib/catalogo.mjs` (el servidor usa esa lista para calcular los descuentos).
14. **Mensajes sugeridos:** en el pedido, debajo de «Mensaje para el cliente» aparecen botones con mensajes ya escritos para la etapa en la que está el pedido (los de la etapa llevan ★) y otros generales (recordar saldo, depósito devuelto, pedir opinión). Toca uno y se escribe con el nombre, fecha, saldo, etc. ya puestos; puedes editarlo. Guarda el pedido para que el cliente lo vea en «Mi pedido», o toca «Enviar este mensaje por WhatsApp».
9. Si tenías pedidos de alquiler en curso, el sistema corre sus pasos automáticamente una sola vez al desplegar (se agregó un paso nuevo), así que nadie pierde su avance.

## Seguridad (todo gratis, sin servicios externos)
- Admin y clave solo viven en variables de entorno; el acceso del admin dura 8 h y el del cliente 24 h.
- Para ver un pedido hacen falta DOS cosas: cédula o celular + PIN. El cliente solo ve pedidos y documentos marcados «visibles»; nunca las notas internas ni el PIN.
- El PIN tiene solo 4 números, por eso hay bloqueo: 5 intentos fallidos con los mismos datos bloquean 30 minutos, y 10 fallos desde una misma conexión también.
- Si los datos no coinciden, el mensaje es siempre el mismo (no revela qué clientes existen).
- Si alguien bloquea a un cliente a propósito, el cliente puede escribirte por WhatsApp o esperar 30 minutos.
