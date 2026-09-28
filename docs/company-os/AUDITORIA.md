# Impulsa Company OS — Auditoría y propuesta

Documento de referencia para evolucionar el CRM de Impulsa Studio hacia un panel central de empresa. Recoge el estado real del repositorio (septiembre 2026), los problemas encontrados y el plan por fases. Se actualiza al cerrar cada fase.

---

## 1. Arquitectura actual

| Capa | Implementación |
|---|---|
| Framework | Next.js 14 App Router, todo en componentes cliente (`"use client"`). No hay Server Components con datos ni Route Handlers. |
| Datos | Cliente único de Supabase en el navegador (`src/lib/supabase.ts`, `@supabase/ssr`). Capa fina en `src/lib/data/*.ts` (una función por consulta). |
| Seguridad | Supabase Auth (email + contraseña) + RLS en Postgres. El middleware (`src/middleware.ts`) solo exige sesión; la autorización real vive en las políticas. |
| Estado | `UsuarioContext` (perfil + rol) y `ThemeContext` (claro/oscuro). Sin caché de datos: cada página vuelve a consultar al montarse. |
| UI | Tailwind con tokens CSS (`--canvas`, `--surface`, `--ink`…) que cambian en modo oscuro. Componentes propios, sin librería de UI. Iconos SVG propios en `Icons.tsx`. |
| Navegación | `AppShell`: cabecera fija + dock flotante en escritorio + barra inferior con "Más" en móvil. |
| Despliegue | Vercel, variables `NEXT_PUBLIC_SB_URL` y `NEXT_PUBLIC_SB_ANON_KEY` (clave publicable, pública por diseño). |

Rutas: `/login`, `/actualizar-password`, `/hoy`, `/leads`, `/leads/nuevo`, `/leads/[id]`, `/calendario`, `/analitica`, `/importar`, `/perfil`.

## 2. Esquema actual (migraciones 0001–0007)

```
auth.users ──1:1── usuarios (id, nombre, email, rol[admin|comercial], notificaciones_activas)
                      │
leads (… estado, origen, segmento, canal, valor, archivado, asignado_a → usuarios)
  ├── interacciones (lead_id → leads CASCADE, usuario_id, fecha, canal, resultado, nota)
  └── eventos       (lead_id → leads CASCADE, usuario_id, titulo, fecha_hora, completada, leida_en)
```

- **RLS**: `leads` visibles para admin o para su `asignado_a`; `eventos` e `interacciones` heredan la visibilidad del lead. `usuarios` legible por cualquier autenticado; cada uno edita solo su preferencia de notificaciones (trigger de 0006). Borrado de leads solo admin (0007).
- `public.is_admin()` es `SECURITY DEFINER` para evitar recursión de RLS.
- Campos de texto libre sin `check`: `leads.estado`, `origen`, `segmento`, `canal`.
- `leads.proximo_contacto` está en desuso (el calendario real es `eventos`).

## 3. Funcionalidades existentes (todas se conservan)

Login y recuperación de contraseña · roles admin/comercial · CRM de leads (alta, edición, estados, responsables, segmentos, origen, referidos, Instagram, WhatsApp/llamada con detección de fijos) · lista y tablero Kanban · valor en € · archivar/eliminar · acciones masivas · exportar CSV · registro de llamadas, notas e historial · seguimientos (eventos) · calendario mes/semana · campana de notificaciones · importación CSV/TSV/HTML con duplicados · analítica comercial · vista Hoy · tema claro/oscuro · PWA instalable.

## 4. Componentes reutilizables

`Modal`, `Avatar`, `EmptyState`, `LoadingState`, `ErrorState`, `Switch`, `LeadBoard` (base del Kanban genérico), `analitica/*` (KpiCard, BarChart, FunnelChart, Sparkline, TeamTable, ActivityFeed, PeriodSelector), `CalendarView`, `EventCard`, `NotificationBell`, `useBorradorFormulario` (borradores persistentes de formularios), `lib/data/paginar.ts` (paginación >1000 filas), `lib/exportar.ts`, `lib/dates.ts`, `lib/phone.ts`.

## 5. Problemas técnicos

1. **Rol leído de `user_metadata`** — `handle_new_user()` asigna `rol` desde `raw_user_meta_data`. Si el registro público de Supabase Auth está activo, cualquiera podría registrarse como `admin`. **Corregido en 0008**: todo alta nueva es `comercial`; se asciende a admin solo por SQL.
2. **Deriva de esquema** — producción tenía columnas y políticas que no estaban en el repo (corregido en `master` con 0005/0006). A partir de ahora, ningún cambio de esquema fuera de migraciones.
3. **Sin caché de datos** — cada navegación repite consultas (`listarUsuarios` se pide en casi todas las páginas). Aceptable hoy; en Fase 1 se cachea la lista de usuarios en contexto.
4. **Límite de 1000 filas** — resuelto para leads y analítica con `traerTodo`; las tablas nuevas lo usan desde el principio.
5. **Tipos escritos a mano** — `types.ts` no se genera de la base de datos; hay que mantenerlos alineados con cada migración.
6. **Sin tests automatizados** — la verificación es build + lint + typecheck + prueba visual.
7. **`maximumScale: 1`** bloquea el zoom en móvil (accesibilidad). Se mantiene de momento porque evita saltos de zoom en iOS; revisar en Fase 5.
8. `ErrorState` no tenía variante oscura; `theme-color` del manifest no coincide con el lienzo real.

## 6. Problemas de UX

- Todo gira en torno al lead: no hay dónde registrar trabajo, entregas ni cobros.
- El dock flotante no escala a más de 6 secciones; "Más" en móvil esconde Analítica e Importar.
- Glassmorphism y manchas de color de fondo dan aspecto de concepto, no de herramienta.
- Estados de carga con texto ("Cargando…") en vez de skeletons.
- No hay búsqueda global ni atajos de teclado.
- "Cerrado"/"Descartado" no expresan ganado/perdido.

## 7. Riesgos de migración

| Riesgo | Mitigación |
|---|---|
| Romper el CRM en producción | Rutas de leads intactas (`/leads`, `/hoy`…); las migraciones nuevas solo añaden tablas, columnas nullable, triggers y políticas. |
| Triggers de actividad que bloqueen escrituras | La función de registro captura cualquier error y nunca aborta la operación original. |
| Desplegar código antes que la migración | El código nuevo depende de 0007/0008. Orden obligatorio: ejecutar migraciones → desplegar. Documentado en el README. |
| Comerciales viendo datos de negocio | Proyectos, cuentas, marcas y actividad son solo admin por RLS; tareas visibles solo para su responsable o creador. |
| Borrado accidental | Proyectos se archivan; borrar exige admin y confirmación. Tareas de un proyecto borrado se borran en cascada (son parte del proyecto). |

## 8. Arquitectura propuesta

- **Módulos** como carpetas de rutas: Inicio, Proyectos, Tareas, Calendario, Ventas (CRM actual), Finanzas, Gastos, Documentos, Analítica, Configuración.
- **Capa de datos** igual que ahora (`src/lib/data/<modulo>.ts`), con RLS como única fuente de autorización.
- **Actividad por triggers de base de datos**: cualquier escritura (desde la app, un script o una automatización futura) queda registrada igual. La tabla `actividad` es la base de las automatizaciones de la Fase 6 (webhooks de Supabase o Edge Functions sobre sus inserciones).
- **Valores derivados, no duplicados**: el importe cobrado y el estado de pago de un proyecto se calcularán a partir de facturas y cobros (Fase 3), no se guardan en `proyectos`.
- **Roles**: `admin` ve todo el Company OS; `comercial` conserva exactamente su CRM actual (Ventas, seguimientos, calendario) más sus propias tareas.

## 9. Modelo de datos

```
cuentas            ← de dónde viene el trabajo (Fer, un cliente directo…)
  └── marcas       ← empresas/marcas finales (Segurma, Clínica X…) — N por cuenta
proyectos          → cuenta_id, marca_id (opcional), lead_id (si nació de un lead)
  ├── proyecto_enlaces (Drive, Figma, Vercel, Meta Ads…)
  └── tareas       → proyecto_id (opcional), lead_id (opcional)
actividad          ← escrita por triggers (proyectos, tareas, leads, y lo que venga)

Fase 3:
facturas           → cuenta_id, número, fecha, vencimiento, base, IVA, IRPF, estado[borrador|emitida|cancelada]
  ├── factura_lineas → proyecto_id (opcional), concepto, importe   ← una factura puede cubrir varios proyectos (p. ej. la mensual de Fer) y un proyecto puede facturarse en varias
  └── cobros       → fecha, importe, método                        ← pagos parciales
  estado visible (pendiente/parcial/cobrada/vencida) = derivado de cobros y vencimiento en una vista
gastos_recurrentes (nombre, categoría, importe, periodicidad, próxima renovación, activo)
gastos             → recurrente_id (opcional), categoría, importe, fecha, proveedor

Fase 4:
documentos         → storage_path en bucket privado `documentos`; FKs opcionales a proyecto, cuenta, lead, factura, gasto
```

Detalles de Fase 1 (migración `0008_company_os_base.sql`):

| Tabla | Campos clave | Notas |
|---|---|---|
| `cuentas` | nombre, tipo (`intermediario`/`cliente_directo`/`interno`), email, teléfono, notas, lead_id único, archivada | Fer = `intermediario`. Un lead ganado puede convertirse en cuenta `cliente_directo`. |
| `marcas` | cuenta_id, nombre, web, notas | Evita repetir "Segurma" como texto en cada proyecto. |
| `proyectos` | nombre, descripción, cuenta_id, marca_id, lead_id, tipo, estado, prioridad, responsable_id, fecha_inicio, fecha_entrega, entregado_en, importe, notas, archivado | `entregado_en` se rellena por trigger → métrica "entregas a tiempo". |
| `proyecto_enlaces` | proyecto_id, titulo, url | |
| `tareas` | titulo, descripción, proyecto_id, lead_id, responsable_id, estado, prioridad, fecha_limite, completada_en | "Completada" se deriva de `estado`; `completada_en` por trigger. |
| `actividad` | actor_id, entidad, entidad_id, accion, resumen, datos (jsonb) | Solo lectura para admin; solo escriben los triggers. |

Estados de proyecto: `pendiente, preparado, en_progreso, esperando, revision, entregado, cancelado`. Prioridad: `baja, normal, alta, urgente`. Estados de tarea: `pendiente, en_progreso, esperando, completada`. Tipos de proyecto: `video, campana, creativo, web, app, automatizacion, anuncio, tecnico, contenido, revision, otro`.

## 10. Mapa de navegación

```
Principal   Inicio (/inicio)
Trabajo     Proyectos (/proyectos) · Tareas (/tareas) · Calendario (/calendario)
Ventas      Leads (/leads) · Seguimientos (/hoy) · Importar (/importar)
Negocio     Finanzas (/finanzas, F3) · Gastos (/gastos, F3)
Información Documentos (/documentos, F4) · Analítica (/analitica)
Sistema     Configuración (/perfil)
```

- **Escritorio**: sidebar fija colapsable (iconos solos al plegar, estado recordado), buscador `⌘K` y botón `+ Añadir` en la parte superior.
- **Móvil**: barra inferior con 4 destinos + botón central `+`: Inicio · Tareas · **+** · Proyectos · Menú. "Menú" abre una hoja con todas las secciones y la búsqueda. Para comerciales: Seguimientos · Leads · **+** · Calendario · Menú.
- Solo aparecen en la navegación los módulos ya construidos.

## 11. Pantallas principales

- **Inicio**: saludo + fecha → fila de KPIs → dos columnas: *Hoy* (tareas, entregas y seguimientos CRM de hoy) y *Urgente* (vencido o con entrega en ≤3 días) → *Proyectos activos* → *Actividad reciente*. Los KPIs de facturación/cobro se activan en la Fase 3 con datos de facturas; hasta entonces se muestran solo métricas que ya tienen fuente real (valor en curso, entregado este mes, proyectos activos, tareas pendientes, leads activos).
- **Proyectos**: Lista (tabla densa en escritorio, tarjetas en móvil) | Kanban (Pendiente → En progreso → Esperando → Revisión → Entregado; "Preparado" se agrupa con Pendiente y "Cancelado" queda fuera del tablero). Filtros por cuenta, prioridad y búsqueda.
- **Ficha de proyecto**: cabecera con estado, prioridad, entrega, importe, cuenta/marca, tipo → pestañas Resumen · Tareas · Enlaces · Notas · Actividad (Archivos y Finanzas se añaden en F4/F3).
- **Tareas**: Hoy · Esta semana · Vencidas · Todas · Kanban. Alta rápida en línea (Enter), completar con un toque (optimista).
- **Command palette (`⌘K`)**: busca proyectos, tareas, leads y cuentas; acciones de crear y navegar.
- **Ventas**: el CRM actual con Lista | Pipeline, "Ganado/Perdido" y botón *Convertir en proyecto* en leads ganados (crea cuenta + proyecto enlazados al lead sin tocar su historial).

## 12. Estado

**Fase 1 — completada** (rama `claude/awesome-dijkstra-5ciena`):

- Migración `0008_company_os_base.sql` probada contra PostgreSQL 16 con un simulacro de Supabase Auth: migraciones 0001–0008 en limpio, re-ejecución idempotente y casos de RLS de admin y comercial (lectura, escritura, escalada de rol, borrado, duplicados).
- App probada de extremo a extremo con PostgREST 12 + login simulado: Inicio, Proyectos (lista, tablero con arrastrar y soltar persistido), ficha (tareas, enlaces, notas con autoguardado, cambio de estado → actividad), Tareas, ⌘K, alta rápida, conversión de lead ganado en proyecto, redirección de comerciales. Escritorio, móvil y modo oscuro; sin errores de consola ni HTTP.
- Pendiente de la Fase 1 que se deja para más adelante: rediseño visual de las pantallas del CRM heredadas (Leads, ficha de lead, Seguimientos, Calendario, Analítica, Importar) al nuevo lenguaje visual; hoy funcionan igual que antes dentro de la nueva shell.

**Fase 2 — completada** (misma rama). Migración `0009_company_os_operations.sql`.

- Cuentas (`/cuentas`, `/cuentas/[id]`) y marcas (`/marcas/[id]`, sin entrada propia en la navegación: se llega desde cuentas, proyectos y ⌘K).
- Subproyectos, migas cuenta → marca → campaña → pieza, `+ Añadir` y ⌘K contextuales, calendario unificado, `/actividad`, paneles nuevos en Inicio.
- Decisiones:
  - **Subproyectos de un solo nivel** (`proyecto_padre_id`), validados por trigger. Cubre "Campaña → Vídeo 1, 2, 3" sin árboles recursivos, que complicarían consultas, totales y la interfaz. El importe se pone donde se factura (campaña o pieza), no en ambos.
  - **Reuniones y eventos dentro de `eventos`** (tipo `seguimiento | reunion | evento`, lead opcional salvo en seguimientos) en vez de una tabla nueva. El calendario es una capa de lectura que combina eventos, tareas y entregas.
  - **`actividad.cuenta_id` / `proyecto_id`** indexados: feeds por cuenta, marca y proyecto sin recorrer JSON, y base para asociar facturas y cobros en la Fase 3.
  - **Las notas de cuentas y marcas** usan las columnas `notas` existentes: no hace falta tabla.
  - **Métricas de cuenta solo de proyectos** ("Valor de proyectos", "Valor en curso"). Facturado, cobrado y pendiente llegarán con Finanzas.
- Probado con PostgreSQL 16 + PostgREST 12 simulando Supabase: migraciones 0001–0009 en limpio y re-ejecutadas, 0009 sobre datos de 0008 (relleno de actividad), RLS de comercial en eventos nuevos, y un recorrido en navegador que cubre crear cuenta, marca y proyecto desde la cuenta, tarea desde un proyecto, cambiar de estado, completar, navegar cuenta ↔ proyecto, ⌘K, calendario, actividad, móvil, modo oscuro y los permisos de un comercial.

## 13. Roadmap

| Fase | Contenido | Migración |
|---|---|---|
| **0** | Esta auditoría. | — |
| **1** | Sidebar + nav móvil, sistema visual sobrio, Inicio, Proyectos (lista/kanban/ficha), Tareas, Command palette, `+ Añadir`, convertir lead en proyecto, Ganado/Perdido. Cuentas/marcas mínimas (selector con alta rápida). | 0008 |
| **2** | Ficha de cuenta (Fer): proyectos activos/terminados, marcas, historial. Calendario unificado (eventos CRM + tareas + entregas, con colores por tipo). Página de actividad global con filtros. | 0009 (si hace falta) |
| **3** | Facturas, líneas, cobros parciales, gastos y recurrentes, dashboard económico, KPIs de facturado/cobrado/pendiente en Inicio. | 0010 |
| **4** | Bucket privado `documentos` + políticas de Storage, módulo Documentos, adjuntos en proyectos/facturas/gastos, búsqueda. | 0011 |
| **5** | Analítica unificada: negocio, trabajo, origen (Fer vs. propios, por marca), servicios. | — |
| **6** | Automatizaciones sobre `actividad` (webhooks/Edge Functions), recordatorios, informes. | — |

### Orden de despliegue de cada fase

1. Ejecutar la(s) migración(es) nuevas en el SQL Editor de Supabase (son idempotentes).
2. Desplegar el código.
3. Comprobar login, lista de leads y la vista nueva.
