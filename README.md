# Nexus Display

Nexus Display es un cliente web de visualización configurable. No pertenece a un solo dominio de negocio: recibe configuración y estado desde un Gateway y selecciona un renderizador según `app`.

**Versión actual:** `0.1.0`

## Principios

- Un solo cliente de visualización para distintos productos o instalaciones.
- El Gateway conserva las reglas de negocio y entrega una proyección segura para pantalla.
- Nexus Display renderiza; no decide estados operativos ni calcula contadores oficiales.
- Configuración por pantalla mediante `screenId`.
- Identidad lógica de instalación mediante `instanceId`.
- La selección de vista puede combinar `app`, `mode` y `locationId`.
- Diseñado para PC, tablet, navegador de Smart TV, kiosco y casting. Clientes nativos futuros pueden consumir el mismo contrato.

## Primer módulo: Control de Acceso

El primer renderizador es `control-access`, con modos previstos:

- `ENTRY`
- `EXIT`
- `DELIVERIES`
- `MIXED`

Para Control de Acceso, el contador oficial debe venir del Gateway. Las solicitudes de entrega se muestran como estado activo; Nexus Display no debe consumir datos privados de Tutor que no sean necesarios para la visualización.

## Identidad de instalación

Nexus Display no se enlaza directamente con la aplicación Access. Ambos clientes deben converger en la misma instancia del Gateway.

Para la instalación actual se deja preparado:

```json
{
  "instanceId": "TEST-001",
  "screenId": "SCR_001",
  "gatewayBaseUrl": "https://control-acceso-gateway.shindarked.workers.dev"
}
```

`instanceId` identifica la instalación lógica. `screenId` identifica esta pantalla concreta. El `backend_ref` del Gateway (por ejemplo `CUI_001` para Google Sheets) no debe utilizarse como identidad de Nexus Display porque pertenece al adaptador de persistencia y puede cambiar sin cambiar la instalación.

Actualmente el Gateway resuelve la instancia por hostname. `instanceId` se conserva en la configuración de Nexus Display como identidad estable y queda preparado para el contrato de pantallas; no sustituye todavía la resolución por hostname del Worker.

## Configuración

`config.json` contiene la configuración de la instalación publicada. `config.example.json` sirve como plantilla para nuevas instalaciones. Algunos campos también se pueden sobreescribir por query string para pruebas:

```text
?app=control-access&instanceId=TEST-001&screenId=SCR_001&mode=DELIVERIES&locationId=LOC-PUERTA&demo=false
```

La configuración remota por pantalla tiene prioridad cuando el Gateway implemente:

```text
GET /api/screens/{screenId}/config
GET /api/screens/{screenId}/state
```

Mientras esas rutas no existan, el cliente puede leer `GET /api/attendance/state` como fallback para el contador oficial. No se usa el endpoint crudo de solicitudes de entrega como fallback porque la pantalla debe recibir una proyección sanitizada.

## Versionado

El número visible se define en `src/version.js`. Para publicaciones normales se incrementa de forma simple en el último componente:

```text
0.1.0 -> 0.1.1 -> 0.1.2
```

Cambios mayores de arquitectura pueden incrementar `0.2.0`, `0.3.0`, etc. La versión queda visible de forma permanente en la esquina inferior derecha.

## Build de producción

El despliegue de Cloudflare utiliza `npm run build` y publica únicamente `dist/`.

El pipeline:

- ofusca todos los módulos JavaScript de `src/`;
- minifica HTML y CSS;
- no genera source maps;
- excluye `node_modules/`, `dist/` y archivos `*.map` del repositorio;
- genera `dist/build-info.json` con producto, versión y tipo de build;
- publica encabezados de seguridad y evita cachear `config.json` y `build-info.json`.

```bash
npm install
npm run build
npx wrangler deploy
```

Cloudflare ejecuta automáticamente `npm run build` porque `wrangler.jsonc` define el comando de build y la carpeta de assets `./dist`.

## Estructura

```text
index.html
styles.css
config.json
config.example.json
_headers
package.json
wrangler.jsonc
scripts/
  build.mjs
src/
  app.js
  version.js
  core/
    config.js
    gateway-client.js
    renderer-registry.js
  renderers/
    control-access.js
```

## Estado actual

Base inicial funcional. Incluye modo demo, configuración runtime, conexión al Gateway, polling, registro de renderizadores, versión visible y pipeline de producción ofuscado. La siguiente etapa es definir en Gateway la proyección autenticada/sanitizada para cada pantalla y después agregar actualización en tiempo real mediante SSE con polling como respaldo.
