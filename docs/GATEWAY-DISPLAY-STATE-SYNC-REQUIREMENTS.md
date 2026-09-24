# Nexus.Display ↔ Gateway — requisitos de estado y sincronización de configuración

**Estado:** propuesta desde Nexus.Display para implementación/coordinación con Gateway  
**Repositorio origen:** `fausto4ever/nexus.display`  
**Rama de trabajo:** `rebuild-display-0.1.36`

## 1. Objetivo

Nexus.Display debe poder arrancar inmediatamente con su última configuración y último estado visual almacenados localmente, sin bloquear la apertura esperando al Gateway.

Gateway continúa siendo la autoridad de los datos operativos de Pickup y la autoridad remota de la configuración administrada de cada pantalla, pero Display no debe consultar su configuración completa en cada polling.

La sincronización debe permitir simultáneamente configuración remota, autoconfiguración touch autorizada, operación visual inmediata con caché local, consulta filtrada del estado operativo, detección barata de cambios de configuración, reconciliación no invasiva del DOM y continuidad visual durante interrupciones temporales de red.

## 2. Principios

1. **Config local-first para presentación.** Display conserva localmente su última configuración válida.
2. **State local-first sólo para presentación.** Display puede conservar el último snapshot recibido para pintar inmediatamente al arrancar. Ese snapshot nunca se convierte en autoridad operativa.
3. **Gateway sigue siendo autoritativo para Pickup y métricas.** El estado local se reconcilia al recuperar comunicación.
4. **No descargar config completa en cada polling.** La respuesta normal de estado debe permitir detectar si existe una configuración remota más nueva.
5. **Los filtros son parte de la configuración de Display.** Ubicación, vista, estados visibles, filas y otros criterios determinan la proyección solicitada.
6. **Display no debe conocer ni consultar GS.** El estado operativo y las métricas llegan a través de Gateway.
7. **Cambios visuales no deben requerir recarga completa.** Display debe poder reconciliar por `requestId` y animar entradas, movimientos y salidas.
8. **Cambio de filtros/configuración es un cambio de escena.** Display puede aplicar una transición tipo “cambio de canal” y después reconciliar contra Gateway.
9. **Display no calcula métricas operativas.** Contadores y promedios son valores autoritativos entregados por Gateway; Display únicamente los representa y anima.

## 3. Configuración versionada por pantalla

Gateway debe mantener una revisión monotónica por `screenId` (`configRevision`). Debe persistir por pantalla, aumentar cuando Admin o una pantalla touch autorizada modifica la configuración efectiva, no cambiar por movimientos de Pickup y estar incluida tanto en la configuración completa como en cada respuesta normal de estado.

Mientras la revisión local coincida con la anunciada por Gateway, Display no necesita consultar `/api/display/config`.

## 4. Configuración local de Display

Display almacenará localmente su `screenId`, `configRevision` y filtros/configuración efectiva, por ejemplo vista, ubicación, estados visibles, filas y opciones visuales. Los nombres definitivos deben alinearse con el contrato vigente de Gateway.

## 5. Arranque rápido

Al abrir, Display lee su configuración local y el último snapshot visual —incluidos los últimos contadores y métricas—, pinta inmediatamente sin esperar red y en paralelo inicia sincronización con Gateway. La primera respuesta autoritativa se reconcilia contra el DOM ya visible.

El snapshot local es exclusivamente visual. No puede completar, cancelar, restaurar ni modificar una Pickup Request ni recalcular métricas autoritativas.

## 6. Estado filtrado de Display

Se prefiere mantener una frontera específica de Display en vez de hacer que Nexus.Display consuma directamente `/api/pickup-requests/query`.

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

Gateway valida los filtros contra identidad, permisos y configuración permitida de la pantalla. Para la cola Pickup visible puede reutilizar internamente la semántica de `/api/pickup-requests/query`. Los contadores y métricas pueden provenir de otras fuentes/colas operativas y no deben asumirse derivados del Durable Object de Pickup.

## 7. Respuesta de estado y métricas autoritativas

Ejemplo contractual:

```json
{
  "ok": true,
  "screenId": "SCR-001",
  "configRevision": 8,
  "revision": 142,
  "items": [],
  "counters": {
    "inside": 427,
    "exitsToday": 38,
    "averageDeliverySeconds": 94,
    "averageDeliverySampleSize": 31,
    "updatedAt": "2026-09-23T23:15:04.000Z"
  }
}
```

Semántica obligatoria:

- `inside`: cantidad autoritativa de alumnos que continúan físicamente dentro de la institución.
- `exitsToday`: cantidad autoritativa de alumnos que ya registraron salida de la institución durante el día local actual, independientemente de que hayan tenido o no una Pickup Request.
- `averageDeliverySeconds`: promedio operativo de entrega calculado exclusivamente con Pickup Requests válidas que recorrieron `AT_GATE → COMPLETED`.
- `averageDeliverySampleSize`: cantidad de Pickup Requests que participaron en ese promedio; **no tiene por qué coincidir con `exitsToday`**.
- `updatedAt`: instante UTC de actualización/cálculo de las métricas.

### 7.1 Etiquetas de interfaz vs semántica del contrato

La interfaz de Nexus.Display puede mostrar las etiquetas:

```text
PRESENTES   → counters.inside
ENTREGADOS  → counters.exitsToday
PROMEDIO    → counters.averageDeliverySeconds
```

La etiqueta visual **ENTREGADOS** es una decisión de presentación. Su valor representa realmente **alumnos que salieron de la institución hoy**, no el número de Pickup Requests `COMPLETED`.

Por tanto, para estos dos indicadores principales:

```text
PRESENTES  = alumnos que aún están dentro
ENTREGADOS = alumnos que ya salieron hoy
```

No debe calcularse `ENTREGADOS` contando requests `COMPLETED`.

### 7.2 Fuente de PRESENTES y ENTREGADOS

Ambos valores son responsabilidad de Gateway y deben provenir de la fuente/cola operativa que represente correctamente entradas y salidas de alumnos.

Display no debe inferirlos contando `items`, Pickup Requests ni eventos del DOM. En particular, `inside` y `exitsToday` no deben asumirse derivados del Durable Object de Pickup.

Gateway puede conservar además `entriesToday` si es útil internamente o para otras vistas, pero los indicadores requeridos actualmente por Nexus.Display son `inside` y `exitsToday`.

### 7.3 Promedio AT_GATE → COMPLETED

El promedio sí pertenece al flujo Pickup. Para cada Pickup Request válida:

```text
deliverySeconds = completedAt - atGateAt
```

Participan únicamente requests que terminaron en `COMPLETED`, tienen `atGateAt` y `completedAt` válidos y corresponden al día local y alcance solicitado. `CANCELLED`, `EXPIRED` y completadas sin `atGateAt` válido no participan.

Cuando no exista ninguna muestra válida:

```json
{
  "averageDeliverySeconds": null,
  "averageDeliverySampleSize": 0
}
```

Display no necesita recibir ni conservar requests `COMPLETED` para calcular este promedio: Gateway entrega el agregado autoritativo.

### 7.4 Alcance global y por ubicación

El promedio de entrega debe poder calcularse globalmente o por `locationId`/`locationIds`, porque la ubicación pertenece al flujo Pickup y permite medir cuánto tarda una entrega en cada punto.

Los contadores institucionales `inside` y `exitsToday` son, por defecto, totales de la institución. No deben filtrarse automáticamente por la ubicación Pickup de la pantalla salvo que en el futuro exista una fuente de acceso que permita definir explícitamente contadores por ubicación física.

Esto evita mezclar dos conceptos distintos: **ubicación de recogida** y **presencia/salida institucional**.

## 8. Recuperación de configuración sólo cuando cambió

Si Display tiene `configRevision=7` y `/api/display/state` anuncia `8`, Display continúa mostrando la escena actual, recupera `/api/display/config`, guarda la revisión 8, aplica la nueva configuración mediante transición visual y reconcilia el estado usando los nuevos filtros. No debe consultar configuración completa en cada polling.

## 9. Autoconfiguración touch

Cuando `configurationMode` lo permita, Display puede modificar sus filtros desde el panel local y escribirlos a través de Gateway. Se recomienda enviar `baseConfigRevision` para detectar conflictos Admin ↔ Touch. Gateway debe devolver la nueva `configRevision` y aplicar los permisos definidos por `configurationMode`.

## 10. Aplicación optimista en Display

Una modificación touch puede aplicarse inmediatamente al DOM y caché local. Después Display la envía a Gateway, adopta la revisión confirmada, consulta estado con los filtros confirmados y reconcilia diferencias. Si Gateway rechaza el cambio, Display recupera la configuración autoritativa sin recargar la aplicación completa.

## 11. Reconciliación visual

Las respuestas deben conservar `requestId` estable para distinguir elementos nuevos, movimientos entre carriles, reordenamientos y desapariciones. Un cambio de filtros/configuración puede producir una transición global tipo “cambio de canal”. Los contadores y promedio pueden animarse visualmente entre valores, pero Display no recalcula el valor autoritativo.

## 12. Polling normal

El ciclo normal debe reducirse a:

```text
Display → POST /api/display/state
Gateway → items + counters + revision + configRevision
```

La configuración completa sólo se recupera si no existe localmente, cambió `configRevision`, existe corrupción/incompatibilidad, el usuario fuerza sincronización o Gateway exige una nueva configuración por cambio incompatible de contrato.

## 13. Filtros y seguridad

Los filtros enviados por Display son una solicitud de proyección, no una autorización. Gateway autentica `screenId` + `screenToken`, valida que la pantalla esté habilitada, limita filtros a valores permitidos, consulta la fuente operativa apropiada para cada dato y devuelve únicamente campos necesarios para presentación.

## 14. Compatibilidad / migración

Durante la migración puede mantenerse temporalmente `GET /api/display/state?screenId=...`, pero el objetivo es disponer de un contrato con filtros explícitos, métricas autoritativas y `configRevision`, sin requerir `GET /api/display/config` en cada polling.

Gateway debe mantener compatibilidad con Displays anteriores mientras se actualizan las pantallas.

## 15. Requisitos concretos solicitados a Gateway

1. Añadir `configRevision` monotónica por `screenId`.
2. Incluir `configRevision` en configuración y respuestas de estado.
3. Permitir estado filtrado sin descargar configuración completa previamente.
4. Preferentemente soportar `POST /api/display/state` con filtros explícitos.
5. Resolver la cola Pickup visible contra el estado operativo apropiado, pudiendo reutilizar `/api/pickup-requests/query` internamente.
6. Mantener autenticación/autorización por pantalla; los filtros nunca amplían permisos.
7. Mantener `requestId` estable.
8. Separar `configRevision` de la revisión del estado operativo.
9. Permitir escritura de configuración desde pantalla sólo cuando `configurationMode` lo autorice y soportar control optimista mediante `baseConfigRevision` o equivalente.
10. Mantener compatibilidad temporal con el `GET /api/display/state` actual.
11. Entregar `inside` como cantidad de alumnos que todavía permanecen dentro de la institución.
12. Entregar `exitsToday` como cantidad de alumnos que ya salieron hoy, independientemente de Pickup Requests.
13. No calcular `exitsToday` a partir de `COMPLETED`; debe provenir de la fuente/cola operativa de acceso/salidas.
14. Entregar `averageDeliverySeconds` calculado sobre `AT_GATE → COMPLETED` de Pickup Requests válidas.
15. Entregar `averageDeliverySampleSize` para conocer el tamaño de muestra del promedio.
16. Permitir promedio global o filtrado por ubicación Pickup.
17. Mantener `inside` y `exitsToday` como métricas institucionales globales salvo que exista explícitamente una fuente de presencia por ubicación.
18. Entregar `updatedAt` para identificar vigencia de las métricas.
19. No obligar a Display a consultar GS/histórico ni requests `COMPLETED` para calcular métricas.
20. Documentar el contrato final para que Display elimine el polling permanente de configuración y cualquier cálculo local de métricas.

## 16. Criterio de aceptación

La implementación se considera suficiente cuando una pantalla ya enrolada puede abrir y pintar inmediatamente desde caché local, realizar una sola consulta periódica, detectar/adoptar cambios de configuración sin recarga, autoconfigurarse cuando esté autorizada, reconciliar requests por `requestId`, recibir **PRESENTES = alumnos aún dentro**, **ENTREGADOS = alumnos que salieron hoy** y el promedio `AT_GATE → COMPLETED` como valores autoritativos, continuar mostrando el último snapshot durante una interrupción y recuperar el estado real al restablecer conexión.
