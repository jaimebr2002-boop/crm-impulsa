# Documentos (Fase 4)

Sistema documental sencillo e integrado en el Company OS: contratos, briefs, guiones, creativos, informes, PDFs de factura y justificantes de gasto, a dos clics desde la cuenta, el proyecto, la factura o el gasto.

**Solo admin.** La restricción está en RLS, en las políticas de Storage y en las rutas (`SoloAdmin`), no solo en la interfaz.

Migración: `supabase/migrations/0011_company_os_documents.sql`. No es destructiva, se puede volver a ejecutar y va después de 0010. Solo re-crea dos vistas, `facturas_estado` y `proyectos_facturacion`, que no guardan datos.

## 1. Esquema

### `documentos` (metadatos; el binario nunca va a PostgreSQL)

| Campo | Notas |
|---|---|
| `id` | uuid. Es también la carpeta del archivo en Storage. |
| `nombre` | Nombre visible, por ejemplo «Brief Segurma». |
| `nombre_archivo` | Nombre original del archivo, por ejemplo `brief-segurma.pdf`. Se usa al descargar. |
| `storage_path` | Único. Formato `{id}/{archivo-saneado}`, validado con una restricción `check`. |
| `mime_type` | Solo los tipos permitidos (§4). |
| `tamano` | En bytes. Entre 0 y 50 MB. |
| `categoria` | `factura`, `justificante`, `contrato`, `propuesta`, `briefing`, `informe`, `guion`, `creativo`, `recurso` u `otro`. Es un `check`: para añadir una categoría basta con una migración pequeña. |
| `descripcion` | Opcional. |
| `cuenta_id`, `marca_id`, `proyecto_id`, `factura_id`, `gasto_id` | **Como máximo una** relación directa (`num_nonnulls(...) <= 1`). Todas son `on delete set null`. |
| `origen` | `subida` o `generado` (PDF de factura creado por la app). |
| `creado_por`, `created_at`, `updated_at` | Auditoría. |

**Por qué una sola relación directa.** El contexto se **deduce** en la vista `documentos_contexto`:

- proyecto → marca → cuenta;
- factura → cuenta;
- gasto → proyecto → cuenta.

La vista añade `ref_cuenta_id`, `ref_marca_id`, `ref_proyecto_id` y los nombres para mostrar y buscar. Así no se duplica la cuenta en cada fila, y si un proyecto cambia de marca o de cuenta los documentos le siguen.

**Qué muestra cada pantalla, sin duplicar filas:**

- **Documentos de Fer:** `where ref_cuenta_id = Fer`. Incluye los documentos directos, los de sus marcas, proyectos y facturas, y los de gastos de sus proyectos.
- **Archivos de un proyecto:** los del proyecto, los de sus subproyectos, los de sus gastos y los de las facturas que lo incluyen.

### Otras tablas y campos

- **`ajustes_facturacion`**, fila única: datos del emisor y preferencias.
  - Emisor: nombre o razón social (vale para persona física), NIF, dirección, CP, ciudad, provincia, país, email, teléfono, IBAN y texto al pie.
  - Preferencias: IVA y IRPF por defecto, y días de vencimiento.
- **`cuentas`** tiene datos fiscales opcionales: `fiscal_nombre`, `fiscal_nif`, `fiscal_direccion`, `fiscal_codigo_postal`, `fiscal_ciudad`, `fiscal_provincia`, `fiscal_pais` y `email_facturacion`.
- **`facturas`** tiene `pdf_huella` y `pdf_generado_en`. `pdf_path` ya existía.
- **`gastos.justificante_path`** se mantiene, pero ahora lo actualiza un trigger: es la ruta del justificante más reciente, para listar rápido sin hacer join.
- **`facturas_estado.pdf_estado`**: `sin_pdf`, `actualizado` o `desactualizado`.
- **`proyectos_facturacion`** añade `en_borrador` y `borradores` (§9).

## 2. Storage

- **Bucket:** `documentos`, **privado** (`public = false`). No existe ninguna URL pública.
- **Límites en el servidor**, configurados en el propio bucket:
  - `file_size_limit`: 50 MB, el máximo por archivo del plan gratuito de Supabase.
  - `allowed_mime_types`: la lista de §4.
- **Rutas:** `{documento_id}/{nombre-saneado}`. Por ejemplo, `3f2c…/brief-segurma.pdf` o `9a1b…/factura-2026-004-lz3k.pdf`.
  - Se usa un **identificador único y no la jerarquía cliente/proyecto**. Las relaciones pueden cambiar sin mover archivos, y las rutas no revelan nombres de clientes ni colisionan.
  - El id de la ruta coincide con el de la fila, lo que hace trivial detectar huérfanos.

### Políticas de `storage.objects`

Todas son `to authenticated` y todas exigen `bucket_id = 'documentos'` y `public.is_admin()`.

| Operación | Condición adicional |
|---|---|
| SELECT | — |
| INSERT | La ruta empieza por un uuid y la extensión está permitida: nada de `.exe`, `.js`, `.html` ni `.svg`. |
| UPDATE | — |
| DELETE | — |

`is_admin()` lee `usuarios.rol`, **nunca** `user_metadata`. Anónimos y comerciales no pueden listar, abrir, firmar URLs, subir, modificar ni borrar.

**Si Supabase no deja crear las políticas desde la migración** (en algunos proyectos `storage.objects` pertenece a otro rol), la migración no falla y avisa con un WARNING. En ese caso el bucket queda **cerrado para todos**, que es seguro por defecto. Crea las cuatro políticas en *Storage → Policies* con las expresiones de arriba; están literales en la sección 8 de la migración.

## 3. Signed URLs

Se generan en el momento, al abrir o descargar, y **nunca se guardan**.

| Uso | Caducidad | Detalles |
|---|---|---|
| Ver dentro de la app | 5 minutos | Iframe (PDF), `<img>`, `<video>` o texto. |
| Descargar | 60 segundos | `download=nombre_archivo`, así se descarga con el nombre original. |

Para crear una signed URL hace falta poder **ver** el objeto (política SELECT), así que un comercial no puede generarla ni con la ruta exacta. Una signed URL es un «portador»: quien la tenga puede usarla hasta que caduque. Por eso son cortas y no se persisten.

## 4. Validación de archivos

Hay tres capas.

1. **En el navegador** (`src/lib/documentos.ts`):
   - La extensión tiene que estar permitida.
   - Tamaño máximo de 50 MB.
   - La **firma real** del archivo tiene que coincidir con la extensión:
     - `%PDF-`;
     - cabeceras PNG, JPEG, GIF y WebP;
     - `ftyp` para MP4, MOV y HEIC;
     - `PK` para DOCX, XLSX, PPTX, ODT, ODS y ZIP;
     - sin bytes nulos para TXT, MD y CSV.

   Un `.pdf` que no es un PDF se rechaza. El MIME que se envía es el canónico de la extensión validada, no el que diga el navegador.
2. **En Storage:** tamaño y MIME del bucket, más la extensión en la política INSERT.
3. **En la base de datos:** `check` de MIME, tamaño y forma de la ruta.

**Admitidos:** PDF, JPG, PNG, WebP, GIF, HEIC, DOCX, XLSX, PPTX, ODT, ODS, TXT, MD, CSV, ZIP, MP4 y MOV.

**Fuera:**

- ejecutables y scripts;
- HTML y SVG, que podrían ejecutar código al abrirse;
- los formatos Office antiguos con macros (DOC, XLS, PPT).

## 5. Subir, reemplazar y eliminar sin inconsistencias

| Operación | Orden | Si algo falla |
|---|---|---|
| Subir | Validar → subir el archivo (XHR, con progreso) → crear la fila. | Si falla la fila, se borra el archivo y aparece «No se pudo guardar el documento… El archivo no se ha conservado». Nunca queda una fila sin archivo. |
| Reemplazar | Subir el archivo nuevo en una ruta nueva → actualizar la fila → borrar el anterior. | Si falla la fila, se borra el nuevo y se mantiene el anterior. |
| Eliminar | Borrar la fila → borrar el archivo. | Si el archivo no se puede borrar, queda como **huérfano sin fila** (invisible) y se avisa. |

El orden de Eliminar es deliberado. El fallo alternativo, una fila apuntando a un archivo inexistente, es peor que un objeto sobrante que se puede limpiar.

**Limpieza de huérfanos.** La función `documentos_objetos_huerfanos()`, solo para admin, lista los objetos del bucket sin fila que tienen más de 10 minutos, para no tocar subidas en curso. Se limpian desde *Configuración → Almacenamiento → Limpiar*.

**Borrar la entidad relacionada.** Si se borra un proyecto, cuenta, factura o gasto, los documentos **se conservan** sin esa relación (`set null`); no se pierden archivos.

**`remove()` y las políticas.** Storage no da error cuando una política impide borrar: devuelve una lista vacía. La app lo comprueba y no da la operación por buena.

## 6. PDF de factura

`POST /api/facturas/{id}/pdf` es un route handler de Node en el servidor.

1. Usa la **sesión del usuario**: cookies y clave anónima. No existe una clave `service_role` en la app. RLS y las políticas de Storage deciden; un comercial recibe 404.
2. Solo se genera para facturas **emitidas o canceladas**. En un borrador pide emitirla primero.
3. Exige los mínimos. Si faltan, responde 422 y la ficha lo explica con enlaces para completarlos.

   | Quién | Datos mínimos | Mensaje si faltan |
   |---|---|---|
   | Emisor | Nombre, NIF, dirección, CP y ciudad. | «Configura tus datos de facturación antes de generar el PDF.» |
   | Receptor | NIF/CIF, dirección, CP y ciudad de la cuenta. | «Faltan datos de facturación de Fer: …» |

4. Dibuja un A4 con **pdf-lib**: es un documento real, no una captura de HTML.
   - **Contenido:**
     - emisor y receptor;
     - número, fecha y vencimiento;
     - líneas, con descripciones largas partidas y paginación automática;
     - base, IVA al % guardado y retención de IRPF al % guardado (solo si es mayor que 0);
     - total;
     - forma de pago con IBAN y texto legal al pie.
   - **Estilo:** negro y grises, con el verde `#AAFF00` solo como una línea fina arriba. Se lee bien impreso en blanco y negro.
   - **Cifras:** muestra **exactamente** lo guardado en la factura, sin recalcular nada.
   - **Facturas canceladas:** «FACTURA ANULADA» y sin forma de pago.
5. Sube el PDF a Storage y llama a `registrar_pdf_factura`, que en **una transacción** hace esto:
   - crea o actualiza el documento (`categoria = factura`, `origen = generado`);
   - guarda `pdf_path`, `pdf_huella` y `pdf_generado_en`;
   - registra la actividad «Generaste» o «Regeneraste el PDF».

   Si el registro falla, se borra el PDF recién subido.

**Regenerar = sustituir.** Se reutiliza el mismo documento (mismo id y metadatos). El PDF nuevo va a una ruta nueva dentro de su carpeta y el anterior se borra. No se acumulan versiones. La ruta nueva evita que una caché sirva el PDF antiguo.

## 7. PDF desactualizado

`factura_huella(id)` es un md5 de todo lo que sale impreso y pertenece a la factura:

- número y estado;
- fechas;
- cuenta;
- porcentajes y totales;
- las líneas.

Al generar el PDF se guarda la huella. `facturas_estado.pdf_estado` compara la huella guardada con la actual.

- Si la factura cambia (líneas, IVA o cancelación), el PDF pasa a **`desactualizado`**.
  - La ficha muestra un aviso ámbar: «La factura ha cambiado después de generar el PDF: el PDF guardado ya no coincide. Regenéralo antes de enviarlo», con «Regenerar» como botón principal.
  - Inicio lo cuenta en «Papeleo pendiente» y la lista de facturas tiene el filtro «Sin PDF al día».
- No se regenera automáticamente: el PDF es un documento que se envía y conviene que regenerarlo sea una decisión visible.
- Las notas internas de la factura no salen en el PDF y no afectan a la huella.
- Cambiar después los datos del emisor o de la cuenta **no** invalida un PDF ya emitido: refleja los datos del momento en que se generó.

## 8. Integración

| Dónde | Qué |
|---|---|
| `/documentos` (Información) | Lista densa con icono de tipo, nombre, categoría, relacionado con, fecha, tamaño y acciones (ver, descargar, reemplazar, eliminar). Búsqueda en el servidor; filtros de categoría, cuenta, proyecto, tipo de archivo y fecha. Se pueden soltar archivos sobre la lista. `?ver={id}` abre el visor. |
| Cuenta (Fer) | Pestaña **Documentos** con filtros Facturas, Proyectos, Contratos y Otros. **Datos de facturación** plegados en la pestaña Finanzas, con aviso de lo que falta para el PDF. |
| Proyecto | Pestaña **Archivos** con filtros Briefs, Guiones, Creativos, Informes, Facturas y Otros. Se sube con botón o arrastrando. |
| Factura | Panel **PDF** (generar, ver, descargar, regenerar y aviso de desactualizado) y panel **Documentos** para adjuntar albaranes, contratos… |
| Gastos | Clip verde para «Justificante ✓» (ver) o gris para «Sin justificante» (adjuntar). Filtro «Sin justificante». En el modal del gasto se puede adjuntar, ver, reemplazar y eliminar. |
| Inicio | Una línea discreta «Papeleo pendiente»: gastos del año sin justificante, facturas emitidas sin PDF y PDFs desactualizados. Solo aparece si hay algo. |
| ⌘K | Busca documentos por nombre, archivo, categoría, cuenta, marca, proyecto, factura o gasto. Con «Segurma» encuentra la marca, sus proyectos, tareas, facturas (por líneas o por cuenta) y documentos. Son dos rondas de consultas pequeñas con límite; nunca se descargan listas enteras. |
| `+ Añadir` | Global: Documento. En una cuenta: Documento. En un proyecto: Archivo. En una factura: Generar PDF y Adjuntar documento. Los gastos tienen su justificante en la propia fila. |
| Actividad | «Subiste «X» al proyecto…», «Adjuntaste un justificante al gasto…», «Eliminaste el documento…», «Generaste / Regeneraste el PDF de la factura…». Abrir, descargar y reemplazar **no** generan actividad. Filtro «Documentos». |
| Configuración | Perfil, Datos de facturación, Preferencias (IVA, IRPF, vencimiento; moneda EUR) y Almacenamiento (limpiar huérfanos). |

## 9. Corrección de Fase 3: «Por facturar» y borradores

**Facturado sigue siendo solo lo emitido.** `proyectos_facturacion.en_borrador` suma las líneas en borradores, que **no** cuentan como facturado. `repartoFacturacion()` en `src/lib/finanzas.ts` calcula:

```
por preparar = valor − facturado (emitido) − en borrador
```

Ejemplo, App Pato con un valor de 1.000 €:

| Concepto | Importe |
|---|---|
| Emitido | 400 € |
| En borrador | 600 € |
| Por preparar | 0 € |

La cuenta muestra «En borrador» con un enlace al borrador en lugar de «Facturar». El formulario de factura avisa si el proyecto «ya está en un borrador». Al editar un borrador, sus propias líneas no cuentan como «otro borrador».

## 10. Qué se ha probado y dónde

**En local:**

- PostgreSQL 16 con una réplica del esquema `storage` y las políticas reales de la migración.
- PostgREST.
- Un servidor que simula la API de Storage de Supabase:
  - subir, firmar, servir, borrar;
  - límites del bucket;
  - ejecuta cada operación en PostgreSQL con el rol y el JWT del usuario, así que las políticas se aplican de verdad.
- El PDF generado por la ruta real de Next.js, revisado con `pdftotext` y renderizado a imagen.

**Pendiente de validar contra Supabase real:**

- Que la migración crea el bucket y las políticas en tu proyecto; si no, aparece el WARNING de §2.
- Las respuestas exactas de Storage: códigos de error y mensajes, `remove()` con políticas, cabeceras de las signed URLs y descarga con nombre.
- La caché del CDN de Storage.
- Que la ruta `/api/facturas/[id]/pdf` en Vercel se ejecuta en el runtime Node y lee bien la sesión desde las cookies.

## 11. Límites y fuera de alcance

- Límite de 50 MB por archivo. Con un plan de pago se puede subir en el bucket y en `TAMANO_MAXIMO`.
- Se sube un archivo cada vez (si se sueltan varios, se abre el primero).
- No hay vista en cuadrícula: la lista es más densa y es la vista principal.
- No hay campo «archivado»: los documentos se eliminan (fila y archivo). Si hace falta, se puede añadir sin tocar lo demás.
- No incluido:
  - OCR;
  - lectura automática de tickets;
  - clasificación con IA;
  - Drive, Dropbox u OneDrive;
  - portal de cliente;
  - firmas;
  - VeriFactu;
  - factura electrónica;
  - enlaces públicos;
  - permisos por documento;
  - versionado;
  - editor online.
