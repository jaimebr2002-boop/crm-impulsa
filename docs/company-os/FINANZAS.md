# Finanzas (Fase 3)

Módulo financiero del Company OS: facturas con varias líneas y proyectos, cobros parciales, gastos, suscripciones y métricas. **Solo admin**: RLS en todas las tablas y vistas, y `SoloAdmin` en todas las rutas.

Migración: `supabase/migrations/0010_company_os_finance.sql`. No es destructiva, es idempotente y se ejecuta después de 0009.

## 1. Las cuatro métricas (no se mezclan)

| Métrica | Qué es | Fuente |
|---|---|---|
| **Valor de proyectos** | Suma de `proyectos.importe` (sin cancelados). Lo acordado, no lo facturado. Sin IVA. | `lib/metricas.ts` |
| **Facturado** | Suma del **total** de las facturas **emitidas** (IVA incluido, IRPF descontado) con fecha de emisión en el periodo. Se muestra también la base. | `calcularKpis` |
| **Cobrado** | Suma de los cobros con **fecha de cobro** en el periodo. | `calcularKpis` |
| **Pendiente** | Total − cobrado de cada factura emitida. Es una foto **a hoy**: no depende del periodo. | vista `facturas_estado` |

Además:

- **Gastos**: suma de los gastos reales con fecha en el periodo, con el importe pagado (IVA incluido).
- **Caja neta (aprox.)** = cobrado − gastos. Se llama así a propósito: es un indicador de caja y **no** el beneficio neto fiscal, que no se calcula.

En proyectos y en los desgloses de Analítica (por marca y por tipo) se usa la **base** (sin IVA), porque se compara con `proyectos.importe`, que tampoco lleva IVA.

Todas las reglas están en `src/lib/finanzas.ts`. Ninguna pantalla calcula dinero por su cuenta.

## 2. Modelo

```
cuentas 1─n facturas 1─n factura_lineas n─1 proyectos
                  │
                  └─1─n cobros
suscripciones 1─n gastos n─1 proyectos / cuentas (opcionales)
factura_series (contador por año)
```

| Tabla | Claves |
|---|---|
| `facturas` | `numero` (único si no es nulo), `cuenta_id` (restrict), `estado` borrador/emitida/cancelada, `fecha_emision`, `fecha_vencimiento`, `iva_pct` y `irpf_pct` (numeric 5,2), `base`/`iva`/`irpf`/`total` (numeric 12,2, calculados por trigger), `moneda`, `enviada_en`, `notas`, `pdf_path` (Fase 4). |
| `factura_lineas` | `factura_id` (cascade), `proyecto_id` opcional (set null), `descripcion`, `cantidad` > 0, `precio_unitario`, `importe` generado = round(cantidad × precio, 2), `orden`. |
| `cobros` | `factura_id` (restrict), `fecha`, `importe` > 0, `metodo` (transferencia, tarjeta, efectivo, bizum, domiciliación, otro), `referencia`, `notas`. |
| `gastos` | `concepto`, `fecha`, `importe` ≥ 0, `categoria`, `proveedor`, `cuenta_id`/`proyecto_id`/`suscripcion_id` opcionales, `deducible` (informativo), `justificante_path` (Fase 4). Único (`suscripcion_id`, `fecha`). |
| `suscripciones` | `nombre`, `importe`, `periodicidad` mensual/trimestral/anual, `proxima_renovacion`, `categoria`, `proveedor`, `activa`. |
| `factura_series` | `anio`, `ultimo`: contador de numeración. |

Todo el dinero es `numeric(12,2)`. No se usa float.

Vistas (`security_invoker = true`, por lo que heredan el RLS de las tablas):

- `facturas_estado`: factura + `cobrado`, `pendiente`, `estado_cobro` y `vencida`. Todas las lecturas de facturas pasan por aquí.
- `proyectos_facturacion`: por proyecto, `facturas`, `facturado` (base) y `cobrado` (reparto proporcional).

## 3. Reglas en base de datos

- **Totales.** Los calcula un trigger a partir de las líneas: base = Σ líneas; IVA = round(base × %, 2); IRPF = round(base × %, 2); total = base + IVA − IRPF. PostgreSQL redondea la mitad hacia arriba (alejándose de cero). El frontend replica ese redondeo en céntimos enteros solo para la vista previa (`calcularTotales`).
- **Numeración** `AAAA-NNN`. El número se asigna **al emitir**, no al crear el borrador. Lo hace `siguiente_numero_factura`, que bloquea la fila del año en `factura_series` (upsert con bloqueo): dos emisiones simultáneas no pueden coger el mismo número. Si alguien puso a mano un número que coincide, lo salta. Se admite número manual, con `UNIQUE`.
- **Estados.** `estado` guarda solo el ciclo de vida: borrador, emitida o cancelada. El estado de cobro (pendiente, parcial, cobrada, vencida) se **deriva** en `facturas_estado` y nunca se guarda, así que no se puede desincronizar.
- **Cobros.**
  - Solo se registran sobre facturas emitidas.
  - Un cobro nunca puede superar lo pendiente; para comprobarlo se bloquea la factura, lo que también protege frente a cobros simultáneos.
  - Una factura no puede quedar con un total menor que lo ya cobrado. Esa comprobación es un *constraint trigger* diferido: se evalúa al final de la transacción, para que sustituir todas las líneas de una factura no falle a medio camino.
- **Borrado.** Solo se pueden borrar borradores; las facturas emitidas se cancelan. Una factura con cobros no puede volver a borrador. Los cobros tienen `on delete restrict`.
- **RPC `guardar_factura(p_id, p_factura, p_lineas)`.** Guarda la cabecera y todas las líneas en una sola transacción. Una factura nueva se crea como borrador y se emite después, para que la actividad registre los totales finales.
- **RPC `registrar_renovacion(p_suscripcion_id)`.** Crea el gasto real del periodo y avanza `proxima_renovacion`. El índice único (`suscripcion_id`, `fecha`) impide registrar el mismo periodo dos veces. Si el día no existe en el mes siguiente, se ajusta a fin de mes (31 → 30 o 28).

## 4. Permisos

- **RLS.** Las políticas de las seis tablas usan `public.is_admin()`, que lee `usuarios.rol` y no `user_metadata`. Un comercial o un usuario anónimo recibe 0 filas en tablas y vistas, y se le rechazan las escrituras y los RPC (`revoke execute ... from anon`, más la comprobación `is_admin()` dentro de cada RPC).
- **Rutas.** `/finanzas/**` está envuelto en `SoloAdmin`. El menú, `+ Añadir`, la paleta y los filtros de calendario ocultan lo financiero a quien no es admin.
- **Actividad.** Las filas de actividad de finanzas viven en `actividad`, que ya era solo admin.

## 5. Pantallas

- **Resumen financiero (`/finanzas`).**
  - Periodo mes, trimestre o año, con flechas.
  - KPIs: Facturado (con la base), Cobrado, Pendiente de cobro (con lo vencido), Gastos, Caja neta (aprox.) y Ticket medio.
  - Gráfica de 12 meses con facturado, cobrado y gastos.
  - Facturas pendientes, próximos 30 días (vencimientos y renovaciones) y facturado por cuenta.
- **Facturas.**
  - `/finanzas/facturas`: filtros todas, pendientes, vencidas, cobradas y borradores, con buscador y totales.
  - `/finanzas/facturas/[id]`: cabecera, KPIs, líneas, bloque fiscal, cobros y actividad. Acciones: registrar cobro, emitir, editar, marcar enviada, cancelar y eliminar borrador.
- **Gastos (`/finanzas/gastos`).** Periodo; filtros por categoría y por tipo (puntual o de suscripción); totales por categoría; editar y eliminar.
- **Suscripciones (`/finanzas/suscripciones`).** Coste fijo mensual y anual (estimados); precio, frecuencia, próxima renovación y coste anual; «Registrar periodo», pausar y reactivar.
- **Cuenta.** KPIs de Facturado, Cobrado y Pendiente, más una pestaña Finanzas con lo que falta por facturar (por proyecto, «Facturar» y «Facturar todos»), sus facturas y sus cobros.
- **Proyecto.** Bloque Facturación con valor, facturado, cobrado y estado (sin facturar, parcial o facturado), las facturas que lo incluyen y el botón «Facturar».
- **Inicio.** Facturado este mes, cobrado este mes, pendiente de cobro y facturado este año, más el panel «Pendiente de cobro».
- **Calendario.** Tipos «Factura» (vencimientos) y «Renovación», que se pueden ocultar.
- **Actividad.** Frases para factura emitida, enviada, cobrada y cancelada; cobro registrado y eliminado; gasto y renovación registrados; suscripción añadida, pausada y reactivada. Hay un filtro «Finanzas».
- **`+ Añadir` y ⌘K.**
  - Factura, Gasto y Cobro en general.
  - Factura dentro de una cuenta.
  - «Añadir a factura» y Gasto dentro de un proyecto.
  - Registrar cobro dentro de una factura.
  - La búsqueda encuentra facturas (por número), gastos y suscripciones.
- **Analítica.** Sección Finanzas con los KPIs, la gráfica mensual y los desgloses por cuenta, marca y tipo de proyecto.

## 6. Fuera de alcance (a propósito)

- PDF de factura: queda preparado el campo `pdf_path` para la Fase 4.
- Justificantes de gasto: queda preparado `justificante_path`, sin blobs en PostgreSQL.
- Tampoco se incluye:
  - portal de cliente o acceso de Fer;
  - pagos online o Stripe;
  - conciliación o conexión bancaria;
  - impuestos, modelos AEAT o VeriFactu;
  - OCR;
  - presupuestos;
  - factura electrónica;
  - contabilidad de doble partida.
