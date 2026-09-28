# Sistema de UI — Impulsa Company OS

Guía corta para que cualquier pantalla nueva se parezca a las existentes. Referencia: Linear / Attio / Vercel. Densidad alta, poco adorno, color solo con significado.

## 1. Tipografía

| Uso | Clase | Notas |
| --- | --- | --- |
| Título de página | `.t-page` (vía `<Cabecera>`) | Space Grotesk, 1 por pantalla |
| Título de sección | `.t-section` | Secciones dentro de una página (Analítica) |
| Etiqueta pequeña / KPI label | `.t-eyebrow` | Mayúsculas, `text-ink3` |
| Cifra KPI | `.t-kpi` | `tabular-nums` |
| Texto | `text-sm text-ink` / secundario `text-ink2` / terciario `text-ink3` | Inter |

Cifras siempre con `tabular-nums`.

## 2. Color y estados

La marca `#AAFF00` (`brand`) es **acción principal y foco**, nunca "éxito".
Los estados usan tonos semánticos de `src/lib/tonos.ts` (`TONO_CHIP`, `TONO_PUNTO`, `TONO_TEXTO`):

| Tono | Significado | Ejemplos |
| --- | --- | --- |
| `exito` (verde) | terminado bien | Ganado, Cobrada, Entregado |
| `peligro` (rojo) | error, vencido | Vencida, tarea vencida, seguimiento atrasado |
| `atencion` (ámbar) | requiere mirar | No contesta, Cobro parcial, Esperando |
| `info` (azul) | en curso | Contactado, Interesado, Pendiente de cobro, En progreso |
| `revision` (violeta) | en revisión / reunión | Reunión, Revisión |
| `neutro` (gris) | sin empezar | Pendiente |
| `inactivo` (gris tenue) | fuera de juego | Perdido, Cancelado, Archivado |

Glosario centralizado: `TONO_LEAD`, `TONO_PROYECTO`, `TONO_TAREA`, `TONO_COBRO`. `ESTADO_COLOR` (leads), `ESTADO_PROYECTO_PUNTO`, `ESTADO_TAREA_PUNTO` y `ESTADO_COBRO_ESTILO` se derivan de ahí: **no escribir clases de color de estado a mano**.

Gráficos: barras neutras (`bg-ink/25`, activa `bg-ink`); verde solo para "ganado/cobrado". Sin donuts.

## 3. Formatos

- Dinero: `formatDinero(valor, decimales = true)` de `src/lib/formato.ts` → `1.140,00 €`, `−77,00 €`. Siempre con punto de miles (también 4 cifras). `eur`, `eurCorto` y `formatEuros` delegan en ella.
- Números / porcentajes: `formatNumero`, `formatPorcentaje` (`12 %`).
- Fechas (`src/lib/dates.ts`): `formatFechaRelativa` → `Hoy · 13:00`, `Mañana · 9:00`, `Sáb 26 · 20:15` (±7 días), luego fecha completa. `formatHaceCuanto` para actividad (`hace 3 min`). Fechas cortas `26 sept`.

## 4. Componentes compartidos

| Necesidad | Componente |
| --- | --- |
| Cabecera de página + acciones | `ui/Cabecera` (`titulo`, `subtitulo`, `acciones`) |
| Subnavegación de módulo | `VentasNav`, `finanzas/FinanzasNav`, `trabajo/Pestanas` |
| Conmutador Lista/Pipeline, Mes/Año… | `Segmentado` (en `ui/Cabecera`) |
| Buscador de toolbar | `ui/CampoBusqueda` + `SELECT_TOOLBAR` para selects |
| Tarjeta con título, contador y enlace | `ui/Panel` |
| Fila de KPIs | `trabajo/FilaKpis` |
| Tablero con drag & drop (+ selector en móvil) | `ui/KanbanBoard` |
| Tabla de leads | `ventas/TablaLeads`, `EstadoLead` |
| Vacío / error / carga | `EmptyState`, `ErrorState`, `ui/Skeleton` (`SkeletonLineas`, `SkeletonTarjetas`), `LoadingState` |
| Diálogo | `Modal` |
| Insignias de trabajo | `trabajo/Insignias` (estado, prioridad, fecha límite) |
| Avatar | `Avatar` |
| Filas de actividad | `trabajo/ActividadLista`, `InteractionTimeline` (mismo lenguaje: punto + frase + "hace X") |
| Filas de tarea / seguimiento | `trabajo/TareaFila`, `EventCard` (casilla redonda) |
| Avisos (toasts) | `useApp().avisar(texto, { tono })` — no crear toasts locales |
| Iconos | `components/Icons.tsx` (trazo 1.8, 16 px en botones) |

## 5. Botones y campos

- `.btn-primary` (una por zona, la acción principal), `.btn-secondary`, `.btn-ghost`, `.btn-danger` (solo confirmaciones destructivas).
- Campos: `.input` dentro de `<label>` con `.field-label`; ayuda `.field-help`; error `.field-error` (debajo del formulario o del campo).
- Pie de formulario: `flex justify-end gap-2` → `Cancelar` (`btn-ghost`) + acción (`btn-primary px-4`).
- Chips/insignias: `.chip` + tono.

## 6. Modal, Drawer o Página

| Usar | Cuándo |
| --- | --- |
| **Modal** (`Modal`) | Altas rápidas y ediciones cortas (≤ ~8 campos): lead rápido, tarea, cobro, gasto, documento, evento, confirmar borrado |
| **Panel lateral** | Ver un elemento sin perder la lista (visor de documentos) |
| **Página** | Entidades con historia: lead, proyecto, cuenta, marca, factura; y formularios largos (alta completa de lead, factura) |

`Modal` ya resuelve: Esc, clic fuera, trampa de foco, foco inicial (primer campo, nunca el botón cerrar), devolver el foco al cerrar y bloqueo del scroll de fondo. En móvil es una hoja inferior.

## 7. Tablas y listas

- Escritorio: tabla/grid compacta (filas de ~48 px, cabecera `text-xs text-ink3`), importes alineados a la derecha.
- Móvil: **no** tabla con scroll horizontal; lista apilada de dos líneas (principal + secundaria, importe a la derecha). Patrón: `<ul className="md:hidden">` + `<div className="hidden md:block">` (líneas de factura, facturas de cuenta).
- Vencido en rojo (`text-red-600 dark:text-red-400`), nunca todo el fila coloreada.

## 8. Estados de pantalla

- Cargando: esqueleto con la forma final (nunca texto "Cargando…" de página).
- Vacío: `EmptyState` con frase humana y, si procede, la acción que lo resuelve.
- Error: `ErrorState` — mensaje humano; el detalle técnico va a consola; botón "Reintentar".

## 9. Layout y navegación

- Contenedor: `mx-auto max-w-6xl px-4 pt-6 md:px-8` (formularios largos: contenido `max-w-3xl` dentro).
- Sidebar: TRABAJO (Proyectos, Tareas, Calendario) · NEGOCIO (Ventas, Cuentas, Finanzas) · INFORMACIÓN (Documentos, Actividad, Analítica) · SISTEMA (Configuración). Finanzas y Documentos solo admin.
- Móvil: barra inferior (Inicio, Tareas, +, Proyectos, Menú) con `safe-area-inset-bottom`; el contenido deja hueco inferior.
- Nunca scroll horizontal de página: las filas de filtros largas usan `overflow-x-auto` propio; el pipeline hace scroll dentro de su contenedor.
- ⌘K: buscar y crear en cualquier sitio; `+ Añadir`: primero las acciones del contexto actual.

## 10. Espaciado y superficies

- Radios: `rounded-lg` (controles), `rounded-xl` (paneles y modales). Sin `rounded-2xl/3xl`, sin degradados ni glass en contenido.
- Separación entre bloques `gap-6`; dentro de paneles `px-4 py-2.5/3`; listas con `divide-y divide-line`.
- Sombras: `shadow-card` solo en tarjetas arrastrables; `shadow-lg` en flotantes (menús, modales, toasts).
- Modo oscuro: usar tokens (`bg-surface`, `bg-canvas`, `bg-mute`, `border-line`, `text-ink*`); si se usa un color de Tailwind, añadir su variante `dark:`.
