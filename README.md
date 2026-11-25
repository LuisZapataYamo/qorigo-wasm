# QoriGo

PWA local para gestionar suscripciones, préstamos y pagos. **No hay backend**:
todos los datos viven en el `IndexedDB` del dispositivo donde se instala la
aplicación y se comparten solo mediante un archivo JSON exportado/importado.

## Requisitos

- Node.js 20 o superior.
- Navegador moderno con IndexedDB y service worker (Chrome, Edge, Safari,
  Firefox). En Android se instala desde el menú del navegador al abrir la PWA
  publicada por HTTPS.

## Comandos

```bash
npm install
npm run dev       # desarrollo
npm test          # pruebas de aceptación y unitarias
npm run build     # compilación + service worker
npm run preview   # sirve la compilación (incluye la PWA)
npm run iconos    # regenera los iconos PNG del manifiesto
```

## Arquitectura

- **React + TypeScript + Vite** para la interfaz.
- **Dexie** sobre **IndexedDB** para persistencia local y transacciones.
- **vite-plugin-pwa** para el manifiesto, la instalación y el modo sin conexión.
- **Vitest + fake-indexeddb** para ejecutar las pruebas contra una base real en
  memoria.
- Importes en **enteros de céntimos**; nunca coma flotante.
- Identificadores **UUID** en todas las entidades para poder transportarlas.

```
src/
  dominio/      dinero, fechas, normalización, errores
  db/           esquema Dexie, tipos, semilla, auditoría
  aplicacion/   casos de uso (reglas de negocio)
  ui/           pantallas y componentes
  pruebas/      utilidades de prueba
```

## Datos y respaldo

- Los datos quedan asociados al navegador y al origen. Borrar los datos del
  sitio o desinstalar la PWA puede eliminarlos.
- Exporta un JSON desde **Respaldo** y guárdalo en un lugar seguro.
- Importar un JSON permite **reemplazar** o **combinar** los datos locales.
  Combinar nunca sobrescribe en silencio: si un UUID existe con otro
  contenido, la importación se cancela.
- La importación no crea sincronización: cada instalación sigue siendo
  independiente hasta el siguiente intercambio manual.

## Documentación

El plan funcional completo está en [`docs/plan_v2.md`](docs/plan_v2.md).
