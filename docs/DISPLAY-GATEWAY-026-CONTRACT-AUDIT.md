# Auditoría de contratos Display ↔ Gateway 0.26.0

Fecha: 2026-10-22. Fuente: `control-acceso-gateway/main`, `docs/api/openapi.yaml`, `docs/integration/DISPLAY-CONTRACT-UPDATE-0.26.0.md`, `docs/api/DISPLAY-OPERATIONAL-STATE.md`. Sólo lectura en Gateway.

## Contratos confirmados

- GET `/api/displays/{screenId}/config`: Bearer de pantalla; respuesta `{ok,screenId,config}`.
- POST `/api/display/config/save`: Bearer de pantalla, `screenId` obligatorio en JSON. Sólo pantalla `SELF_SERVICE` puede modificar `view,locationId,entityType,rows,showCounter,showDistance,showPriority`. El servidor cierra SSE al guardar.
- POST `/api/display/state`: `screenId`, `revision`, `configRevision`, filtros opcionales; devuelve revisiones independientes de Pickup y operación y contadores aunque las tarjetas no cambien. `config` llega cuando `configRevision` cambió.
- GET `/api/displays/{screenId}/state` con `Accept:text/event-stream` y Bearer para SSE.
- `configurationMode`: `ADMIN_ONLY`, `SELF_SERVICE`, `LOCKED`. `enabled` es booleano.
- Vistas operativas: únicamente `DELIVERIES`; `ENTRY`, `EXIT` y `MIXED` siguen en esquema legado, pero **no tienen proyección operativa implementada**.
- `baseConfigRevision` **no figura** en `DisplayConfigCommandInput` ni como requisito contractual de escritura. No enviar ni prometer control de conflictos por revisión.

## Implicaciones de implementación

El cliente ya tiene las rutas canónicas. Se agregó `self-service-config.js` para validar campos editables y modo de pantalla, sin inventar opciones. No se activa una UI de edición touch hasta definir UX y verificar comportamiento de guardado real. Configuración administrada remotamente se consume en Display; administrar pantallas desde Nexus.Admin pertenece al otro repositorio y no está autorizado modificarlo desde aquí.

La autorización real siempre la aplica Gateway: las validaciones del cliente son preventivas, no controles de seguridad. Validación física y producción pendientes; issue #2 no se cierra sin autorización del usuario.
