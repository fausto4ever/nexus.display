# Nexus.Display — prueba manual de intermitencia (pendiente de validación)

**Issue:** https://github.com/fausto4ever/nexus.display/issues/2  
**Rama:** `rebuild-display-0.1.36`  
**Estado:** procedimiento documentado; **NO ejecutado ni aprobado**. La issue permanece abierta hasta aprobación explícita del responsable.

## Alcance

Comprobar con una pantalla **realmente enrolada**, contra un Gateway de pruebas, que la vista se recupera de interrupciones de red sin refrescar el navegador, sin duplicar tarjetas ni abrir streams SSE simultáneos. No usar datos sensibles, no modificar producción ni ejecutar `sync all`.

## Diagnóstico opcional propuesto (NO implementado)

Reservar `?diagnostics=1` para una instrumentación futura, **solo de observación**, que muestre: estado de red, generación de SSE, apertura/cierre y reintentos, cantidad de conexiones activas, último evento SSE, polling iniciado/completado, revisiones pickup/config/operational, latencia de recuperación y código de error sanitizado. Nunca exponer screenToken, Authorization, nombres ni datos personales en logs. El parámetro **no activa hoy ningún panel**; no se debe presentar como funcionalidad existente. Desactivar por defecto y evitar persistir trazas sensibles.

## Preparación

1. Registrar URL, entorno, versión y SHA desplegados de Display y Gateway; comprobar `GET /api/gateway/version` en el Gateway que usa Display.
2. Abrir Display en Chrome/Edge con una pantalla de pruebas vinculada. Abrir DevTools → Network (Preserve log), filtrar `state`; revisar GET SSE `/api/displays/{screenId}/state` y POST `/api/display/state`. **No compartir HAR sin depurar credenciales.**
3. Tener dos estados de prueba distinguibles en Gateway (p. ej. WAITING → READY o cambios de contador) para verificar actualización al recuperar conectividad. Registrar tiempos con reloj.

## Casos y criterios

| Caso | Inyección | Resultado exigido |
| --- | --- | --- |
| Corte breve | DevTools Network → Offline durante 15 s y volver Online | La vista se recupera sin reload, no duplica tarjetas y termina mostrando el estado vigente. |
| Cortes repetidos | 3 ciclos Offline/Online de 10–20 s | No se acumulan streams SSE ni timers; el estado final es correcto. |
| Red lenta | Slow 3G durante 60 s | Sin errores permanentes ni regresión a revisiones antiguas. |
| Respuesta tardía | Iniciar POST polling, provocar reconexión/estado SSE nuevo antes de su respuesta | La respuesta vieja no pisa el estado nuevo. |
| Corte prolongado | Wi-Fi físico desconectado 2 min y restablecido | Reconecta sin intervención manual, con estado correcto. |
| Cambio de configuración | Cambiar filtro autorizado desde admin mientras hay conexión; repetir tras corte | Aplica configuración vigente, no mezcla grupos/ubicaciones. |
| Revocación/re-enrolamiento | En entorno controlado invalidar token de pantalla | Se muestra flujo de vinculación y se recupera tras aprobación, sin conservar token anterior. |
| Solo contadores | Modificar contador sin cambio de solicitudes | Contadores actualizados sin limpiar indebidamente las tarjetas. |

**Observación:** DevTools Offline puede no interrumpir inmediatamente un SSE ya abierto. Para confirmar la pérdida real usar desconexión física del Wi-Fi o bloquear el endpoint en DevTools y observar el cierre de la conexión. No interpretar ausencia de errores en consola como prueba suficiente.

## Evidencia y cierre

Para cada caso registrar fecha, dispositivo/navegador, URL de entorno, SHAs, inicio/fin del corte, tiempo de recuperación, revisiones observadas, capturas o video sin datos sensibles, resultado PASS/FAIL y anomalías. Si falla, conservar la issue abierta y adjuntar pasos de reproducción. **No cerrar ni marcar validación del usuario hasta su aprobación explícita.**

## Pendientes adicionales de issue #2

- Confirmar CI del commit actual, compilación y versión desplegada; CI local no demuestra despliegue.
- Auditar caché/manifest/service worker de PWA y comportamiento tras nueva versión.
- Completar pruebas del ciclo de vida real de `src/app.js` (reintentos, polling/SSE, identidad) con automatización cuando sea viable.
- Verificar que el modo de preview temporal no afecte el host productivo y planear su retiro.

## Estado de automatización (2026-10-22)

Se añadieron pruebas unitarias de reconexión cancelable, arbitraje SSE/polling y orquestación de recuperación de identidad. **No sustituyen** una prueba E2E de navegador con Gateway real y autorización administrativa. La prueba de Wi-Fi físico, aprobación real de enrolamiento, comprobación de revisiones y autorización del cierre requieren intervención del validador y siguen pendientes. No se ha activado `?diagnostics=1` (solo está especificado).
