# Tienda Platón

Tienda demostrativa de la librería, hecha en Angular. Usa el logo, la tipografía Satoshi, los colores y las tarjetas del panel administrativo.

Se puede explorar el catálogo, ver un libro y preparar el carrito sin ingresar. Para confirmar un pedido se necesita una cuenta de cliente. Se puede crear desde la tienda o desde el panel. El registro de la tienda asigna USER y estado activo desde Account; el cliente no elige su rol.

El pedido reserva stock y pasa a una pantalla de pago simulado. Solo se aceptan las tarjetas configuradas para la demostración; sus datos no aparecen como instrucciones en las pantallas. El titular, número, vencimiento y CVV deben corresponder a la misma tarjeta; el nombre admite diferencias de mayúsculas y espacios. Al aprobarse, Payments guarda el pedido pagado con método, fecha y referencia. El administrador lo recibe automáticamente, sin confirmar el cobro a mano. No se realizan cargos reales ni envíos.

El menú de cliente permite entrar a Mi perfil, editar teléfono y dirección, y cerrar sesión. La identidad y el rol no se editan desde ese formulario. Las pantallas se adaptan a móvil, tableta y escritorio.

## Ejecutar en local

```sh
npm ci
npm start
```

Abrir http://127.0.0.1:4201. El panel administrativo sigue en el puerto 4200.

Se necesitan Gateway, Account, Products, Payments, Eureka, Config Server, PostgreSQL y RabbitMQ funcionando. El archivo `proxy.conf.json` dirige `/api` al Gateway del puerto 8080. Para otro entorno se debe configurar el proxy de la aplicación o del servidor que publique la tienda.

## APIs

- Catálogo público: `GET /api/products/catalog`.
- Registro de clientes: `POST /api/accounts/register`.
- Inicio de sesión: `POST /api/v1/login`.
- Datos de la cuenta: `GET /api/accounts/{id}` con JWT.
- Estados y creación de pedidos: `/api/states-sold` y `/api/products-sold`, con JWT.
- Contacto propio: `PUT /api/accounts/me/contact`.
- Pago simulado: `POST /api/products-sold/{id}/payment/simulate-card`. Solo recibe importe y token de prueba; no recibe ni guarda tarjeta o CVV.
- Mis pedidos consulta por el ID del cliente conectado.

La consulta pública del catálogo no devuelve costos de compra, márgenes ni movimientos de inventario. Los cambios necesarios están en las ramas de Products y Gateway; las rutas administrativas se conservan.

## Comprobar

```sh
npm run build
npm test -- --watch=false
npm run lint
```

El carrito conserva solo identificadores y cantidades en el navegador. Los precios se consultan nuevamente y Payments valida el total y el stock. No se reintentan automáticamente las solicitudes que crean pedidos.

El proyecto completo todavía tiene pendientes de seguridad en backend, incluido el acceso directo a servicios y la autorización sobre datos de otros usuarios. La tienda filtra los pedidos por el cliente conectado, pero ese filtro no reemplaza la validación de propietario en el servidor. Las seis pruebas anteriores de Productos siguen pendientes; esta tienda no corrige esos fallos.

Para una base existente, aplicar `backend/platon-microservice-payments/database/04-simulated-card-payment.sql` antes de iniciar Payments. El entorno local de revisión ya tiene esa actualización. Los endpoints de contacto y pago identifican al cliente mediante la cabecera que Gateway obtiene del JWT y reemplaza; los servicios deben permanecer en una red privada.

La tarjeta muestra el titular, número y vencimiento mientras se completan los campos. Al enfocar el CVV gira al reverso y muestra el código; al salir vuelve al frente. Respeta la preferencia de reducir movimiento. El titular, número y CVV no se envían a Payments ni se guardan en el navegador.

Mis pedidos muestra el estado de entrega separado del pago y lo actualiza cada ocho segundos. Las confirmaciones de salida usan un diálogo de la tienda y conservan el carrito.
