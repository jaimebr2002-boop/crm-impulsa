# Impulsa CRM

CRM interno de Impulsa Studio para gestionar los leads de Jaime, Laura y Reyes: pipeline automático, referidos personales y la campaña histórica de reactivación. Pensado para usarse sobre todo desde el móvil, durante llamadas.

- Jaime ve todos los leads y el calendario global.
- Laura y Reyes solo ven y trabajan sus propios leads asignados.
- No hay contraseñas ni login: cada persona elige su nombre una vez y el dispositivo lo recuerda.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + cliente JS, sin Supabase Auth)
- Despliegue en Vercel

## 1. Requisitos

- Node.js 18+
- Un proyecto de Supabase (gratuito es suficiente)

## 2. Configurar Supabase

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Abre el **SQL Editor** del proyecto y ejecuta, en este orden:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — crea las tablas, índices, triggers y políticas RLS.
   - [`supabase/seed.sql`](supabase/seed.sql) — crea los usuarios Jaime, Laura y Reyes.
3. En **Project Settings → API**, copia la **Project URL** y la **anon public key**.

## 3. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores del paso anterior:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

## 4. Ejecutar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La primera vez pedirá elegir usuario (Jaime, Laura o Reyes); esa elección se guarda en el navegador del dispositivo.

## 5. Importar los leads históricos de reactivación

Desde **Perfil → Importar leads históricos**, pega los datos en CSV o TSV (con cabecera) de la campaña de reactivación, o sube un archivo. Cabeceras reconocidas: `negocio`, `contacto`/`nombre_contacto`, `telefono`, `email`, `enlace_demo`/`demo`, `segmento`, `nota`, `ciudad`, `nicho`. Tras previsualizar y confirmar, cada fila crea un lead con `origen = reactivacion_web`, conservando el `segmento` y guardando la nota cualitativa como la primera interacción del lead.

## 6. Cambiar de usuario en un dispositivo

Perfil → **Cambiar de usuario**. Vuelve a mostrar la pantalla de selección inicial.

## 7. Build de producción

```bash
npm run build
npm run start
```

## 8. Desplegar en Vercel

1. Sube este proyecto a un repositorio Git.
2. Impórtalo en [vercel.com/new](https://vercel.com/new).
3. Añade las mismas variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en la configuración del proyecto de Vercel.
4. Despliega. No hace falta configuración adicional.

## Notas

- No existe autenticación tradicional: la identificación es local por dispositivo (localStorage) y sirve para filtrar la vista y rellenar el usuario responsable, no como medida de seguridad. La app está pensada para un equipo de confianza de 3 personas.
- Los teléfonos españoles que empiezan por 8 o 9 se marcan automáticamente como fijos y no se ofrece WhatsApp para ellos.
- El campo `proximo_contacto` de `leads` se conserva por compatibilidad con el esquema original, pero el calendario real vive en la tabla `eventos` (un lead puede tener varios seguimientos futuros).
- La aplicación no inventa ni completa datos automáticamente: solo guarda lo que se introduce manualmente o llega por importación.
