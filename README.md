# Nexus Display

Nexus Display es un cliente web de visualización configurable. No pertenece a un solo dominio de negocio: recibe configuración y estado desde un Gateway y selecciona un renderizador según `app`.

## Principios

- Un solo cliente de visualización para distintos productos o instalaciones.
- El Gateway conserva las reglas de negocio y entrega una proyección segura para pantalla.
- Nexus Display renderiza; no decide estados operativos ni calcula contadores oficiales.
- Configuración por pantalla mediante `screenId`.
- La selección de vista puede combinar `app`, `mode` y `locationId`.
- Diseñado para PC, tablet, navegador de Smart TV, kiosco y casting. Clientes nativos futuros pueden consumir el mismo contrato.

## Primer módulo: Control de Acceso

El primer renderizador es `control-access`, con modos previstos:

- `ENTRY`
- `EXIT`
- `DELIVERIES`
- `MIXED`

Para Control de Acceso, el contador oficial debe venir del Gateway. Las solicitudes de entrega se muestran como estado activo; Nexus Display no debe consumir datos privados de Tutor que no sean necesarios para la visualización.

## Configuración

Copiar `config.example.json` como `config.json` al desplegar y ajustar los valores. También se pueden sobreescribir algunos campos por query string para pruebas:

```text
?app=control-access&screenId=SCR-001&mode=DELIVERIES&locationId=LOC-PUERTA&demo=false
```

La configuración remota por pantalla tiene prioridad cuando el Gateway implemente:

```text
GET /api/screens/{screenId}/config
GET /api/screens/{screenId}/state
```

Mientras esas rutas no existan, el cliente puede leer `GET /api/attendance/state` como fallback para el contador oficial. No se usa el endpoint crudo de solicitudes de entrega como fallback porque la pantalla debe recibir una proyección sanitizada.

## Desarrollo local

Es una aplicación web estática basada en módulos ES. Debe servirse mediante HTTP local; abrir `index.html` directamente como `file://` puede bloquear módulos o `fetch` en algunos navegadores.

Ejemplo:

```bash
python -m http.server 8080
```

Después abrir `http://localhost:8080`.

## Estructura

```text
index.html
styles.css
config.example.json
src/
  app.js
  core/
    config.js
    gateway-client.js
    renderer-registry.js
  renderers/
    control-access.js
```

## Estado actual

Base inicial funcional. Incluye modo demo, configuración runtime, conexión al Gateway, polling y registro de renderizadores. La siguiente etapa es definir en Gateway la proyección autenticada/sanitizada para cada pantalla y después agregar actualización en tiempo real mediante SSE con polling como respaldo.
