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

1. **Auth de producción** → *Authentication → Sign In / Providers* → sección *User Signups*: **desactivar "Allow new users to sign up"** y guardar (las cuentas se crean desde *Authentication → Users → Invite user*). Comprobación: `GET https://sfjzwieddvniimeetrud.supabase.co/auth/v1/settings` con la cabecera `apikey: <clave publicable>` debe devolver `"disable_signup": true`. (El 29-09-2026 devolvía `false`; la escalada a admin ya está cerrada por la corrección de `handle_new_user`, pero un desconocido aún podría crear una cuenta `comercial`.)
2. Acceso al panel de Supabase de producción y al proyecto de Vercel.
3. `psql` o `pg_dump` 17 en tu ordenador (o Supabase CLI) y la cadena de conexión de producción (*Connect → Session pooler*).
4. Estar en la rama validada, con el último Preview en verde y `tsc`, `lint` y `next build` limpios.

## 4. Backup (obligatorio, justo antes de migrar)

El plan Free no tiene copias descargables ni PITR, así que el backup lo haces tú:

```bash
# 0. Cadena de conexión: Supabase → proyecto CRM IMPULSA STUDIO → botón "Connect" →
#    "Session pooler" → copiar la URI y poner tu contraseña de la base de datos.
#    (Si no la recuerdas: Project Settings → Database → Reset database password.)
export DB_URL_PRODUCCION='postgresql://postgres.sfjzwieddvniimeetrud:TU_CONTRASEÑA@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
mkdir -p backup-crm && cd backup-crm

# 1. Esquema + datos de public y auth, formato restaurable (pg_dump 17: la base es Postgres 17)
pg_dump "$DB_URL_PRODUCCION" --schema=public --schema=auth --no-owner --no-privileges \
  -Fc -f crm-prod-$(date +%Y%m%d-%H%M).dump
# 2. La misma copia en SQL legible (por si hay que mirar o restaurar a mano)
pg_dump "$DB_URL_PRODUCCION" --schema=public --schema=auth --no-owner --no-privileges \
  -f crm-prod-$(date +%Y%m%d-%H%M).sql

# 3. CSV de las cuatro tablas del CRM
for t in usuarios leads interacciones eventos; do
  psql "$DB_URL_PRODUCCION" -c "\copy (select * from public.$t order by id) to '$t.csv' csv header"
done

# 4. Comprobaciones: el dump contiene los datos y los CSV tienen las filas esperadas
pg_restore -l crm-prod-*.dump | grep -E "TABLE DATA public (leads|interacciones|eventos|usuarios)"
wc -l *.csv    # usuarios 4, leads 72, interacciones 64, eventos 6 (cabecera incluida)
psql "$DB_URL_PRODUCCION" -f ../supabase/scripts/huella_datos.sql > huella-antes.txt
```

Guarda la carpeta `backup-crm` fuera del repo (contiene datos personales). Si no tienes `pg_dump` 17: `brew install postgresql@17` (macOS) o la Supabase CLI (`supabase db dump`).

Además:
- **CSV desde el panel** (alternativa si no tienes `psql`): Table Editor → cada tabla → Export → CSV.
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
| 7 | `0013_factura_devengo_y_pago.sql` | Fecha de operación/devengo, texto legal y concepto de pago por factura, titular del IBAN y concepto separado en líneas; amplía la huella de PDF | Aditiva |

`0013` es posterior al estado de producción verificado el 29-09-2026 (0007→0012). Antes de desplegar el código que usa sus campos, aplícala primero en staging y después en producción siguiendo backup, transacción y verificación descritos arriba.

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
| Migraciones 0007→0012 | ✓ | ✓, una a una, comprobando después de cada una | ✓ 29-09-2026, una a una; cada transacción verificaba conteos y huella antes de confirmar |
| Datos antiguos intactos (huella md5) | ✓ | ✓ (71 leads / 63 interacciones / 5 eventos / 3 usuarios) | ✓ mismas filas y huellas antes y después; `estado` y `updated_at` de los 71 leads sin cambios |
| Catálogo idéntico a local | — | ✓ 283 columnas, 128 restricciones, 34 funciones, 76 índices, 33 políticas, 34 triggers, 3 vistas | ✓ idéntico a staging en las 7 categorías |
| RLS admin / comercial / anónimo (en Postgres) | ✓ | ✓ | ✓ con los usuarios reales (admin 71 leads; comerciales 8 y 0; anónimo 0) |
| Código de `master` sobre la base migrada | — | ✓ | — |
| Storage: bucket privado, límites, políticas en SQL | ✓ simulado | ✓ | ✓ privado, 50 MB, 18 MIME, 4 políticas |
| Storage por HTTP (API real de Storage) | ✓ simulado | ✓ 22 casos (ver abajo) | — |
| PDF en Vercel (`/api/facturas/[id]/pdf`) | ✓ | ✓ 12 casos en el Preview real (ver abajo) | — |
| Preview de Vercel | — | ✓ build, middleware, 22 rutas con sesión real, usa staging | — |
| Navegador real contra el Preview (clics, ⌘K, drag & drop) | ✓ (Playwright) | ✗ no disponible desde el entorno | — |

**Cómo se probó staging por HTTP (29-09-2026).** El entorno de trabajo no tiene red hacia `*.supabase.co` / `*.vercel.app`, así que las peticiones HTTP reales se lanzaron desde el Postgres de **staging** con la extensión `http` (solo en staging): login real en Supabase Auth, llamadas a la API de Storage y al Preview de Vercel con la cookie de sesión que escribe `@supabase/ssr`. `scripts/verificar-staging.mjs` hace lo mismo desde Node para repetirlo desde un ordenador con red.

Storage (22/22): admin sube, descarga, signed URL de 60 s (200 sin sesión), signed URL de 1 s caducada (400 `exp`), sin URL pública, subir encima sin upsert (409), reemplazar con PUT, HTML y MIME ejecutable rechazados (415), `.exe` con MIME PDF y ruta sin `{uuid}` rechazados por la política (403), > 50 MB rechazado (413), comercial no lista/sube/descarga/firma/borra, anónimo no descarga/sube/lista, admin borra.
Nota: Storage sirve **desde la caché de Cloudflare** la misma URL con el mismo token durante un rato (`cf-cache-status: HIT`) aunque el objeto se haya reemplazado o borrado. Sin fuga entre usuarios (un comercial recibe 404 sobre la misma URL) y sin efecto en la app: abre siempre con signed URLs únicas y cada PDF regenerado usa una ruta nueva.

PDF en Vercel (12/12): sin sesión 401, comercial 404, admin 200 (~1,5 s desde `iad1`), `pdf_path` + huella + `pdf_estado = actualizado`, 1 fila en `documentos` (`generado`), objeto `application/pdf` en Storage, se abre por signed URL, se descarga como `attachment`, regenerar crea ruta nueva y borra el objeto anterior (sigue 1 documento), modificar la factura → `desactualizado`, actividad «pdf» (generado y regenerado). Sin datos fiscales el endpoint responde 422 con la lista de lo que falta (comportamiento esperado).

**Backup de producción (29-09-2026).** Externo: `pg_dump` + CSV hechos por el propietario, fuera del repo. Interno: esquema `backup_pre_company_os` con copia de `usuarios`, `leads`, `interacciones`, `eventos`, `auth.users` y `auth.identities` (huellas verificadas; sin permisos para `anon`/`authenticated`). Borrarlo cuando el Company OS lleve un tiempo estable: `drop schema backup_pre_company_os cascade;`.

## 10. Problemas conocidos

- **Estados legacy** en producción ("Contactado", "Cerrado", "En negociación", "WhatsApp", "Frío", "No tocar"…). La app los tolera: "Contactado" se lee como Contactado; el resto aparece tal cual en "Otros estados". "Cerrado" **no** se da por Ganado (los 18 son "No tocar": podrían ser perdidos). Para arreglarlos de verdad, `normalizar_leads_legacy.sql` con decisión sobre "Cerrado", "En negociación", "No tocar", "No la vieron".
- **Registro público de Auth**: estaba activo en producción. El 29-09-2026 se aplicó en producción solo la corrección de `handle_new_user` (idéntica a 0008: toda cuenta nueva nace `comercial`), así que ya no hay escalada a admin. Sigue siendo necesario desactivar "Allow new users to sign up".
- **Comercial en rutas de admin**: la página se sirve (200) y el cliente redirige a Seguimientos; los datos los protege RLS (0 filas).
- **Previews y producción**: antes de `next.config.mjs`, todos los Preview usaban el Supabase de producción porque `.env.production` está versionado. Ya no, pero los deployments antiguos siguen apuntando allí: están protegidos por Vercel Authentication; si quieres, bórralos.
- **Rol de un usuario**: con 0008, `update usuarios set rol = 'admin' where email = '…'` funciona desde el SQL Editor (antes lo bloqueaba el trigger de 0006).
- **Logs de Vercel**: la retención en Hobby es de 1 hora.
- **Región**: funciones en `iad1` y base de datos en `eu-west-1` → más latencia (ver §6.3).
