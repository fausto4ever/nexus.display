# Nexus.Display ↔ Gateway — requisitos de estado y sincronización de configuración

**Estado:** propuesta desde Nexus.Display para implementación/coordinación con Gateway  
**Repositorio origen:** `fausto4ever/nexus.display`  
**Rama de trabajo:** `rebuild-display-0.1.36`

## 1. Objetivo

Nexus.Display debe poder arrancar inmediatamente con su última configuración y último estado visual almacenados localmente, sin bloquear la apertura esperando al Gateway.

Gateway continúa siendo la autoridad de los datos operativos de Pickup y la autoridad remota de la configuración administrada de cada pantalla, pero Display no debe consultar su configuración completa en cada polling.

La sincronización debe permitir simultáneamente:

- configuración remota desde administración;
- autoconfiguración local desde una pantalla touch cuando esté permitida;
- operación visual inmediata con caché local;
- consulta filtrada del estado operativo;
- detección barata de cambios de configuración;
- reconciliación no invasiva del DOM;
- continuidad temporal si Gateway o la red no están disponibles.

## 2. Principios

1. **Config local-first para presentación.** Display conserva localmente su última configuración válida.
2. **State local-first sólo para presentación.** Display puede conservar el último snapshot recibido para pintar inmediatamente al arrancar. Ese snapshot nunca se convierte en autoridad operativa.
3. **Gateway/DO sigue siendo autoritativo para Pickup.** El estado local se reconcilia al recuperar comunicación.
4. **No descargar config completa en cada polling.** La respuesta normal de estado debe permitir detectar si existe una configuración remota más nueva.
5. **Los filtros son parte de la configuración de Display.** Ubicación, vista, estados visibles, filas y otros criterios determinan la proyección solicitada.
6. **Display no debe conocer ni consultar GS.** El estado operativo proviene del Gateway/DO.
7. **Cambios visuales no deben requerir recarga completa.** Display debe poder reconciliar por `requestId` y animar entradas, movimientos y salidas.
8. **Cambio de filtros/configuración es un cambio de escena.** Display puede aplicar una transición tipo “cambio de canal” y después reconciliar contra Gateway.

## 3. Configuración versionada por pantalla

Gateway debe mantener una revisión monotónica por `screenId`, por ejemplo:

```json
{
  "screenId": "SCR-001",
  "configRevision": 8
}
```

`configRevision` cambia únicamente cuando cambia la configuración efectiva de esa pantalla.

Requisitos:

- debe persistir por pantalla;
- debe aumentar cuando Admin modifica la configuración;
- debe aumentar cuando una pantalla autorizada guarda una autoconfiguración;
- no debe aumentar por cambios de Pickup Requests;
- debe devolverse junto con la configuración completa;
- debe estar disponible en la respuesta normal de estado para detectar cambios sin otra llamada.

No se requiere que Display consulte `/api/display/config` mientras su revisión local coincida con la revisión anunciada por Gateway.

## 4. Configuración local de Display

Display almacenará localmente al menos:

```json
{
  "screenId": "SCR-001",
  "configRevision": 8,
  "config": {
    "view": "DELIVERIES",
    "locationId": "1",
    "statuses": ["WAITING", "READY", "AT_GATE"],
    "rows": 10,
    "showCounter": true,
    "showDistance": true,
    "showPriority": true
  }
}
```

Los nombres definitivos de los campos deben alinearse con el contrato vigente de Gateway. `statuses` se propone como filtro explícito si todavía no forma parte de `display_screens`.

## 5. Arranque rápido

Al abrir:

1. Display lee configuración local.
2. Display lee el último snapshot visual local.
3. Display pinta inmediatamente sin esperar red.
4. En paralelo inicia sincronización con Gateway.
5. La primera respuesta autoritativa se reconcilia contra el DOM ya visible.

Gateway no debe exigir una descarga previa de configuración completa para permitir la primera consulta de estado cuando Display ya posee una configuración/revisión válida.

El snapshot local es exclusivamente visual. No puede completar, cancelar, restaurar ni modificar una Pickup Request.

## 6. Estado filtrado de Display

Se prefiere mantener una frontera específica de Display en vez de hacer que Nexus.Display consuma directamente el contrato general `/api/pickup-requests/query`.

Ruta propuesta:

```http
POST /api/display/state
Authorization: Bearer <screenToken>
Content-Type: application/json
```

Ejemplo:

```json
{
  "screenId": "SCR-001",
  "configRevision": 8,
  "filters": {
    "date": "2026-09-23",
    "statuses": ["WAITING", "READY", "AT_GATE"],
    "locationIds": ["1"]
  }
}
```

Gateway debe validar los filtros contra la identidad, permisos y configuración permitida de la pantalla antes de consultar el estado operativo.

Internamente Gateway puede reutilizar la misma semántica/función del contrato:

```http
POST /api/pickup-requests/query
```

pero Display no queda acoplado directamente a ese contrato.

## 7. Respuesta mínima de estado

Ejemplo:

```json
{
  "ok": true,
  "screenId": "SCR-001",
  "configRevision": 8,
  "revision": 142,
  "items": [],
  "counters": {}
}
```

Significado:

- `configRevision`: revisión remota actual de configuración de esa pantalla.
- `revision`: revisión del estado operativo/proyección, independiente de `configRevision`.
- `items`: Pickup Requests/proyección ya autorizada para Display.
- `counters`: contadores requeridos por la vista, si aplica.

Si `configRevision` coincide con la local, Display continúa sin solicitar configuración.

Si no coincide, Display puede seguir mostrando la escena actual mientras obtiene la nueva configuración.

## 8. Recuperación de configuración sólo cuando cambió

Cuando Display tiene revisión `7` y la respuesta de estado anuncia `8`:

```text
Display local: 7
Gateway:       8
```

Display solicita entonces:

```http
GET /api/display/config?screenId=SCR-001
```

Respuesta:

```json
{
  "ok": true,
  "configRevision": 8,
  "config": {}
}
```

Display guarda la nueva configuración y la aplica mediante transición visual. Después solicita/reconcilia el estado usando los nuevos filtros.

No debe existir obligación de consultar esta ruta en cada polling.

## 9. Autoconfiguración touch

Cuando `configurationMode` permita autoconfiguración, Display puede modificar sus filtros desde su panel local.

La escritura continúa a través de Gateway, por ejemplo:

```http
PUT /api/display/config
Authorization: Bearer <screenToken>
```

Ejemplo:

```json
{
  "screenId": "SCR-001",
  "baseConfigRevision": 8,
  "locationId": "2",
  "statuses": ["READY", "AT_GATE"],
  "rows": 8
}
```

Respuesta esperada:

```json
{
  "ok": true,
  "configRevision": 9,
  "config": {}
}
```

Se recomienda `baseConfigRevision` para evitar que una pantalla touch sobrescriba silenciosamente una modificación administrativa más nueva. Si existe conflicto, Gateway debe responder un error explícito de revisión/conflicto y devolver o permitir recuperar la configuración vigente.

Gateway debe seguir aplicando `configurationMode` (`ADMIN_ONLY`, `SELF_SERVICE`, `LOCKED` o equivalentes vigentes) para decidir qué campos puede modificar la pantalla.

## 10. Aplicación optimista en Display

Una modificación touch puede aplicarse inmediatamente sobre el DOM y la caché local para que la interfaz no dependa de la latencia de red.

Después:

1. Display envía la configuración a Gateway.
2. Gateway valida y persiste.
3. Display adopta la `configRevision` confirmada.
4. Display consulta estado con los filtros confirmados.
5. Display reconcilia diferencias.

Si Gateway rechaza el cambio, Display debe recuperar/adoptar la configuración autoritativa sin recargar la aplicación completa.

## 11. Reconciliación visual

Las respuestas deben conservar `requestId` como identidad estable para permitir que Display determine:

- elemento nuevo → animación de entrada;
- mismo request y mismo carril → actualización/reordenamiento;
- mismo request con nuevo estado → movimiento entre carriles;
- request ausente → animación de salida/desaparición.

Un cambio de configuración/filtros puede producir una transición global de escena tipo “cambio de canal”. Después de la transición se reconcilian los elementos que permanecen, salen o entran.

Gateway no necesita definir las animaciones; sólo debe conservar identidad y consistencia de la proyección.

## 12. Polling normal

El ciclo normal debe reducirse a una sola consulta operativa:

```text
Display → POST /api/display/state
Gateway → items + counters + revision + configRevision
```

No:

```text
Display → GET config
Display → GET state
```

cada pocos segundos.

La configuración completa sólo se recupera si:

- no existe configuración local;
- cambió `configRevision`;
- Display detecta corrupción/incompatibilidad local;
- el usuario solicita explícitamente restaurar/sincronizar;
- Gateway exige una nueva configuración por cambio incompatible de contrato.

## 13. Filtros y seguridad

Los filtros enviados por Display son una solicitud de proyección, no una autorización.

Gateway debe:

- autenticar `screenId` + `screenToken`;
- validar que la pantalla esté habilitada;
- limitar filtros a los valores permitidos por su configuración/modo;
- consultar únicamente estado operativo del DO;
- no exponer datos adicionales porque el cliente envíe filtros más amplios;
- devolver sólo campos necesarios para la presentación.

## 14. Compatibilidad / migración

Durante la migración puede mantenerse temporalmente:

```http
GET /api/display/state?screenId=...
```

pero el objetivo es disponer de un contrato que permita filtros explícitos y `configRevision` sin requerir `GET /api/display/config` en cada polling.

El Gateway debe poder mantener compatibilidad con Display desplegados anteriores mientras se actualizan las pantallas.

## 15. Requisitos concretos solicitados a Gateway

1. Añadir `configRevision` monotónica por `screenId`.
2. Incluir `configRevision` en `GET /api/display/config`.
3. Incluir `configRevision` en cada respuesta de estado de Display.
4. Permitir estado filtrado para Display sin descargar configuración completa previamente.
5. Preferentemente soportar `POST /api/display/state` con filtros explícitos.
6. Resolver esa proyección contra el estado operativo del Durable Object, reutilizando la semántica de `/api/pickup-requests/query`.
7. Mantener autenticación y autorización por pantalla; los filtros del cliente nunca amplían permisos.
8. Mantener `requestId` estable en los items proyectados.
9. Separar `configRevision` de la revisión del estado operativo.
10. Permitir `PUT /api/display/config` desde pantalla sólo cuando `configurationMode` lo autorice.
11. Devolver la nueva `configRevision` al guardar configuración.
12. Soportar control optimista mediante `baseConfigRevision` o mecanismo equivalente para detectar conflictos Admin ↔ Touch.
13. Mantener compatibilidad temporal con el `GET /api/display/state` actual.
14. No consultar GS/histórico para construir el estado operativo de Display.
15. Documentar el contrato final para que Nexus.Display pueda eliminar el polling permanente de `/api/display/config`.

## 16. Criterio de aceptación

La implementación se considera suficiente cuando una pantalla ya enrolada puede:

- abrir y pintar inmediatamente desde su caché local;
- realizar una sola consulta operativa periódica al Gateway;
- recibir `configRevision` sin descargar la configuración completa;
- detectar una modificación administrativa y adoptarla sin recargar la aplicación;
- cambiar filtros localmente en modo touch autorizado y sincronizarlos con Gateway;
- reconciliar las Pickup Requests por `requestId`;
- continuar mostrando el último snapshot durante una interrupción de red;
- recuperar el estado autoritativo del DO al restablecer conexión;
- nunca depender de GS/histórico para la cola viva de Display.
