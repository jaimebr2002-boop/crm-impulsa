# Despliegue del Company OS

Procedimiento para pasar de "CRM antiguo en producción" a "Company OS en producción" sin perder datos.
Probado en staging el 28-09-2026 (ver §9). Si algo de aquí no cuadra con lo que ves, **para**.

## 1. Entornos

| | Supabase | Vercel | Datos |
|---|---|---|---|
| Producción | `sfjzwieddvniimeetrud` (CRM IMPULSA STUDIO, eu-west-1) | Production (rama `master`) | Reales. Nunca datos demo. |
| Staging | `effazidcqpliuxtakmnw` (crm-impulsa-staging, eu-west-1) | Preview (cualquier rama ≠ master) | Sintéticos + demo (Fer, Segurma…) |
| Local | Postgres 16 + PostgREST + Storage simulado | `next dev` | Semillas de prueba |

`next.config.mjs` decide el Supabase de cada build:
- **Production** → `.env.production` (o variables de Vercel).
- **Preview** → `.env.staging`, salvo que Vercel ya dé otro Supabase que no sea producción.
- El build **falla** si un Preview apunta a producción o producción a staging.

## 2. Variables de entorno

| Variable | Pública | Production | Preview | Notas |
|---|---|---|---|---|
| `NEXT_PUBLIC_SB_URL` | Sí | URL de producción | URL de staging | Va al navegador. |
| `NEXT_PUBLIC_SB_ANON_KEY` | Sí | `sb_publishable_…` de producción | `sb_publishable_…` de staging | Publicable por diseño; la seguridad es RLS. |
| `VERCEL_ENV` | — | la pone Vercel | la pone Vercel | La usa `next.config.mjs`. |

No hay ninguna variable secreta: la app **no usa service role** (el PDF se genera con la sesión del usuario).
`.env.production` y `.env.staging` están versionados y solo contienen claves publicables. Recomendado (§8): moverlas a *Vercel → Settings → Environment Variables* (Production y Preview por separado) y dejar los archivos solo como respaldo.

## 3. Prerrequisitos (una vez)

1. **Auth de producción** → *Authentication → Sign In / Providers*: **desactivar "Allow new users to sign up"** (las cuentas se crean desde el panel). Mientras 0008 no esté aplicada, `handle_new_user` toma el rol de los metadatos del registro: con el registro abierto, cualquiera podría darse de alta como admin.
2. Acceso al panel de Supabase de producción y al proyecto de Vercel.
3. `psql` o `pg_dump` 17 en tu ordenador (o Supabase CLI) y la cadena de conexión de producción (*Connect → Session pooler*).
4. Estar en la rama validada, con el último Preview en verde y `tsc`, `lint` y `next build` limpios.

## 4. Backup (obligatorio, justo antes de migrar)

El plan Free no tiene copias descargables ni PITR, así que el backup lo haces tú:

```bash
# Esquema + datos de public y auth (roles incluidos), formato restaurable
pg_dump "$DB_URL_PRODUCCION" --schema=public --schema=auth --no-owner --no-privileges \
  -Fc -f crm-prod-$(date +%Y%m%d-%H%M).dump
# Comprobación: debe listar leads, interacciones, eventos, usuarios
pg_restore -l crm-prod-*.dump | grep -E "TABLE DATA public (leads|interacciones|eventos|usuarios)"
```

Además:
- **CSV de respaldo** (Table Editor → Export) de `leads`, `interacciones`, `eventos` y `usuarios`.
- **Storage**: producción no tiene buckets (verificado); no hay nada que copiar.
- **Huella**: ejecuta `supabase/scripts/huella_datos.sql` en el SQL Editor y guarda el resultado (número de filas y md5 por tabla).

## 5. Migración de la base de datos

Orden estricto, en el SQL Editor de producción, **una migración cada vez**, pegando cada archivo entre `begin;` y `commit;` (ninguna contiene sentencias incompatibles con una transacción): si algo falla, no queda nada a medias.

| Paso | Archivo | Qué hace | Riesgo |
|---|---|---|---|
| 0 | *(opcional)* `supabase/scripts/normalizar_leads_legacy.sql` | Normaliza "Contactado"/"Cerrado"/"WhatsApp"/"Frío"… | Cambia valores: solo con aprobación. Hacer **antes** de la huella "antes". |
| 1 | `0007_valor_archivado.sql` | `leads.valor`, `leads.archivado`, borrar solo admin | Aditiva |
| 2 | `0008_company_os_base.sql` | Cuentas, marcas, proyectos, tareas, actividad; `handle_new_user` seguro | Aditiva |
| 3 | `0009_company_os_operations.sql` | Subproyectos; eventos genéricos (`lead_id` pasa a opcional) | Aditiva |
| 4 | `0010_company_os_finance.sql` | Facturas, cobros, gastos, suscripciones | Aditiva |
| 5 | `0011_company_os_documents.sql` | Documentos, bucket privado `documentos` y sus políticas | Aditiva |
| 6 | `0012_hardening_funciones.sql` | Permisos de `is_admin()`, `search_path` | Aditiva |

Después de **cada** paso:
- Sin error rojo. Si 0011 muestra el aviso *"No se pudieron crear las políticas de storage.objects"*, el bucket queda cerrado (seguro) y hay que crear las 4 políticas a mano (ver DOCUMENTOS.md). En staging se crearon sin aviso.
- `huella_datos.sql` → mismas filas y mismas huellas que antes.

Al terminar:
- `supabase/scripts/verificar_rls.sql` → admin ve todo; el comercial solo lo suyo y 0 en cuentas/proyectos/finanzas/documentos/actividad/storage; el anónimo, 0 en todo.
- *Advisors → Security*: no debe haber tablas sin RLS. Avisos esperados y aceptados: `registrar_pdf_factura` ejecutable por autenticados (comprueba `is_admin()` dentro), *leaked password protection* (ajuste de Auth).
- *Storage → documentos*: **Public = off**, límite 50 MB.

El código de `master` (el que está en producción) sigue funcionando con la base migrada (probado en staging), así que la base va **antes** que el código y no hay ventana de corte.

## 6. Despliegue del código

1. Merge de la rama validada en `master` (PR) → Vercel despliega Production.
2. Verificar en el deployment: build en verde; el bundle usa el Supabase de producción (el build falla si no).
3. Opcional y recomendado: en Vercel → *Settings → Functions → Region*: `dub1` (Dublín) o `cdg1`, junto a Supabase `eu-west-1`. Hoy es `iad1` (EE. UU.).

## 7. Smoke test de producción (sin datos falsos)

Solo lectura, o acciones reales que harías igualmente. **No** ejecutar las baterías E2E ni `scripts/verificar-staging.mjs` contra producción.

- [ ] Login admin → Inicio carga, sin errores en consola.
- [ ] Ventas: los 71 leads aparecen (Lista); Pipeline sin leads perdidos (estados antiguos → columna "Otros estados" si no se normalizaron).
- [ ] Abrir un lead: historial y seguimientos intactos.
- [ ] Seguimientos (Vencidos / Hoy / Próximos).
- [ ] Proyectos, Tareas, Cuentas, Calendario, Finanzas, Documentos, Actividad, Analítica, Configuración: cargan (vacíos al principio).
- [ ] ⌘K encuentra un lead real.
- [ ] Crear tu primera cuenta real (p. ej. Fer) y un proyecto real → aparecen en Actividad.
- [ ] Primera factura real → emitir → **Generar PDF** → se abre y se descarga.
- [ ] Subir un documento real → abrir → descargar.
- [ ] Login con un comercial: solo ve sus leads; `/finanzas`, `/cuentas`, `/documentos` redirigen a Seguimientos.
- [ ] Vercel → Logs (retención 1 h en Hobby: mirar en el momento) y Supabase → Logs (API, Auth, Storage): sin 5xx.

## 8. Rollback

**No hay rollback SQL automático.** Las migraciones son aditivas: deshacerlas borraría datos nuevos. Qué hacer según lo que falle:

| Situación | Acción |
|---|---|
| El código nuevo falla y la base ya migró | Vercel → Deployments → el último de `master` anterior → **Instant Rollback**. El código antiguo funciona con la base migrada (probado). |
| Una migración falla a mitad | Al ir entre `begin;`/`commit;`, si da error **no se aplica nada de ese archivo** (si el editor lo dejó en transacción abierta, ejecutar `rollback;`). No seguir con las siguientes. Anotar el error, no reintentar a ciegas, corregir en staging y crear una migración correctiva nueva (`0013…`), nunca editar una ya aplicada. |
| Datos del CRM alterados (la huella no coincide) | Parar. Restaurar solo las tablas afectadas desde el `.dump` (`pg_restore --data-only -t leads …` en una tabla temporal y comparar) o desde los CSV. |
| Políticas de Storage no creadas o dudosas | Dejar el bucket **privado y sin políticas** (nadie puede leer ni escribir). Documentos y PDFs no funcionan, pero nada se expone. Crear las políticas desde Storage → Policies. |
| Hay que desactivar el Company OS entero | Rollback del código (arriba). Las tablas nuevas quedan vacías o con datos sin usar; el CRM antiguo no las lee. |

## 9. Estado de la validación (28-09-2026)

| | Local | Staging (Supabase real) | Producción |
|---|---|---|---|
| Migraciones 0007→0012 | ✓ | ✓, una a una, comprobando después de cada una | **No aplicadas** |
| Datos antiguos intactos (huella md5) | ✓ | ✓ (71 leads / 63 interacciones / 5 eventos / 3 usuarios) | — |
| Catálogo idéntico a local | — | ✓ 283 columnas, 128 restricciones, 34 funciones, 76 índices, 33 políticas, 34 triggers, 3 vistas | — |
| RLS admin / comercial / anónimo (en Postgres) | ✓ | ✓ | — |
| Código de `master` sobre la base migrada | — | ✓ | — |
| Storage: bucket privado, límites, políticas en SQL | ✓ simulado | ✓ | — |
| Storage por HTTP (subida, signed URL, MIME, 50 MB, comercial) | ✓ simulado | **Pendiente**: `scripts/verificar-staging.mjs` | — |
| PDF en Vercel (`/api/facturas/[id]/pdf`) | ✓ | **Pendiente** (mismo script) | — |
| Preview de Vercel | — | ✓ build, middleware (redirige a /login), usa staging | — |

Para completar lo pendiente, con red hacia `*.supabase.co` y `*.vercel.app`:
`node scripts/verificar-staging.mjs` (instrucciones dentro del archivo).

## 10. Problemas conocidos

- **Estados legacy** en producción ("Contactado", "Cerrado", "En negociación", "WhatsApp", "Frío", "No tocar"…). La app los tolera: los inequívocos se leen como su estado y el resto aparece en "Otros estados". Para arreglarlos de verdad, usar `normalizar_leads_legacy.sql` (con decisión sobre "En negociación", "No tocar", "No la vieron").
- **Previews y producción**: antes de `next.config.mjs`, todos los Preview usaban el Supabase de producción porque `.env.production` está versionado. Ya no, pero los deployments antiguos siguen apuntando allí: están protegidos por Vercel Authentication; si quieres, bórralos.
- **Rol de un usuario**: con 0008, `update usuarios set rol = 'admin' where email = '…'` funciona desde el SQL Editor (antes lo bloqueaba el trigger de 0006).
- **Logs de Vercel**: la retención en Hobby es de 1 hora.
- **Región**: funciones en `iad1` y base de datos en `eu-west-1` → más latencia (ver §6.3).
