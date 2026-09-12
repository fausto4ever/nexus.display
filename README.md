# Nexus.Display

Nexus.Display es un cliente web de visualización configurable. No pertenece a un solo dominio de negocio: recibe configuración y estado desde un Gateway y selecciona un renderizador según `app`.

**Versión actual:** `0.1.8`

## Principios

- Un solo cliente de visualización para distintos productos o instalaciones.
- El Gateway conserva las reglas de negocio y entrega una proyección segura para pantalla.
- Nexus.Display renderiza; no decide estados operativos ni calcula contadores oficiales.
- Configuración por pantalla mediante `screenId`.
- Identidad lógica de instalación mediante `instanceId`.
- La selección de vista puede combinar `app`, `mode` y `locationId`.
- Diseñado para teléfono, PC, tablet, navegador de Smart TV, kiosco y casting.
- Todas las vistas deben ser responsivas sin depender de JavaScript para calcular tamaños o posiciones.
- JavaScript controla datos, estado, eventos, clases y estructura. La presentación visual reside en `styles.css`.
- No se permiten estilos inline, generación de `<style>`, ni escritura o reescritura de reglas CSS desde JavaScript salvo una necesidad técnica documentada que no pueda resolverse con clases, atributos o variables CSS.
- CSS debe contener sólo reglas utilizadas por la interfaz actual; estilos obsoletos o duplicados se eliminan en la misma modificación que los deja sin uso.

## Primer módulo: Control de Acceso

El primer renderizador es `control-access`, con modos previstos:

- `ENTRY`
- `EXIT`
- `DELIVERIES`
- `MIXED`

Para Control de Acceso, el contador oficial debe venir del Gateway. Las solicitudes de entrega se muestran como estado activo; Nexus.Display no debe consumir datos privados de Tutor que no sean necesarios para la visualización.

## Identidad de instalación

Nexus.Display no se enlaza directamente con la aplicación Access. Ambos clientes deben converger en la misma instancia del Gateway.

`instanceId` identifica la instalación lógica. `screenId` identifica una pantalla concreta. El `backend_ref` del Gateway no debe utilizarse como identidad de Nexus.Display porque pertenece al adaptador de persistencia y puede cambiar sin cambiar la instalación.

Actualmente el Gateway resuelve la instancia por hostname. La pantalla obtiene su `screenId` y credencial mediante el flujo de enrolamiento seguro del Gateway.

## Configuración

`config.json` contiene la configuración de la instalación publicada. `config.example.json` sirve como plantilla para nuevas instalaciones.

La identidad autenticada de pantalla se conserva localmente después del enrolamiento y la configuración remota del Gateway tiene prioridad sobre los valores locales de presentación operativa.

## Versionado

El número visible se define en `src/version.js`. Para publicaciones normales se incrementa de forma simple en el último componente:

```text
0.1.7 -> 0.1.8 -> 0.1.9
```

Cambios mayores de arquitectura pueden incrementar `0.2.0`, `0.3.0`, etc.

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

Incluye enrolamiento seguro de pantalla, configuración remota, conexión al Gateway, polling, registro de renderizadores, modo demo, interfaz responsiva y pipeline de producción ofuscado. Nexus.Display mantiene separadas la lógica de aplicación en JavaScript y la presentación en CSS.
