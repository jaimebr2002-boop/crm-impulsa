# Impulsa CRM

CRM interno de Impulsa Studio para gestionar los leads de Jaime, Laura y Reyes: pipeline automático, referidos personales y la campaña histórica de reactivación. Pensado para usarse sobre todo desde el móvil, durante llamadas.

- Autenticación real con Supabase Auth (email + contraseña). No hay selector de usuario ni identificación por `localStorage`.
- Jaime tiene rol `admin`: ve todos los leads y puede filtrar por responsable (Todos / Jaime / Laura / Reyes).
- Laura y Reyes tienen rol `comercial`: solo ven y trabajan sus propios leads. Esta separación la garantiza **Row Level Security (RLS) en Supabase**, no un filtro de la interfaz — no se puede saltar manipulando la URL, el frontend o las peticiones.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Supabase Auth + RLS), vía `@supabase/ssr`
- Despliegue en Vercel

## 1. Requisitos

- Node.js 18+
- Un proyecto de Supabase (gratuito es suficiente)

## 2. Configurar Supabase

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Abre el **SQL Editor** del proyecto y ejecuta, en este orden:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — esquema base (tablas, índices, triggers).
   - [`supabase/migrations/0002_auth_roles_rls.sql`](supabase/migrations/0002_auth_roles_rls.sql) — vincula `usuarios` a Supabase Auth, añade roles y las políticas RLS reales.
   - [`supabase/migrations/0003_hardening.sql`](supabase/migrations/0003_hardening.sql) — endurecimiento de funciones (`search_path`, permisos de ejecución).
3. Crea las cuentas de Auth para Jaime (`admin`), Laura y Reyes (`comercial`) — por API (`auth.admin.inviteUserByEmail`, recomendado) o desde el dashboard (**Authentication → Users → Invite user**), pasando `user_metadata: { nombre, rol }`. Un trigger (`handle_new_user`) crea automáticamente su fila en `usuarios` con esos datos.
4. En **Authentication → URL Configuration**, configura el **Site URL** y añade a **Redirect URLs** el dominio de producción (p. ej. `https://tu-app.vercel.app/**`) — si no, los enlaces de invitación/recuperación de contraseña redirigen a `localhost`.
5. En **Project Settings → API**, copia la **Project URL** y la **anon/publishable key**.

## 3. Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores del paso anterior:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SB_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SB_ANON_KEY=tu-anon-key
```

## 4. Ejecutar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Redirige a `/login`; cada persona entra con su email y contraseña.

## 5. Importar los leads históricos de reactivación

Desde **Perfil → Importar leads históricos**, pega los datos en CSV o TSV (con cabecera) o sube un archivo CSV/TSV/HTML. Cabeceras reconocidas: `negocio`, `contacto`/`nombre_contacto`, `telefono`, `email`, `enlace_demo`/`demo`, `segmento`, `nota`, `ciudad`, `nicho`. Cada fila crea un lead con `origen = reactivacion_web`, conservando el `segmento` y guardando la nota cualitativa como la primera interacción. Jaime puede elegir a quién se asignan; Laura y Reyes solo pueden importar para sí mismos (la política RLS de `leads` lo exige).

## 6. Cerrar sesión / cambiar de cuenta

Perfil → **Cerrar sesión**. Cada persona tiene su propia cuenta; no existe un selector de usuario.

## 7. Build de producción

```bash
npm run build
npm run start
```

## 8. Desplegar en Vercel

1. Sube este proyecto a un repositorio Git.
2. Impórtalo en [vercel.com/new](https://vercel.com/new).
3. Añade las mismas variables de entorno (`NEXT_PUBLIC_SB_URL`, `NEXT_PUBLIC_SB_ANON_KEY`) en la configuración del proyecto de Vercel.
4. Despliega.

## Seguridad

- La separación de datos entre Jaime, Laura y Reyes está implementada con **Row Level Security en PostgreSQL**, usando `auth.uid()` y el rol guardado en `usuarios`. Nunca confíes solo en filtros de React: aunque el frontend se manipule, la base de datos rechaza cualquier lectura o escritura fuera de lo permitido.
- La función `public.is_admin()` (SECURITY DEFINER) evita la recursión típica de RLS al consultar el propio rol del usuario.
- Nunca se usa la `service_role key` en el navegador ni en código cliente. Las operaciones administrativas (crear usuarios) se hacen server-side, fuera de la app desplegada.
- Los teléfonos españoles que empiezan por 8 o 9 se marcan automáticamente como fijos y no se ofrece WhatsApp para ellos.
- El campo `proximo_contacto` de `leads` se conserva por compatibilidad con el esquema original, pero el calendario real vive en la tabla `eventos` (un lead puede tener varios seguimientos futuros).
- La aplicación no inventa ni completa datos automáticamente: solo guarda lo que se introduce manualmente o llega por importación.
