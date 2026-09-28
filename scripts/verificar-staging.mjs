// Verificación contra infraestructura REAL (staging): Supabase Auth, Storage y
// PostgREST, y la ruta /api/facturas/[id]/pdf del Preview de Vercel.
// Solo usa la clave publicable y usuarios de prueba: nunca service role.
//
// Uso (desde la raíz del repo, con red a *.supabase.co y *.vercel.app):
//   SB_URL=https://<ref-staging>.supabase.co SB_KEY=sb_publishable_… PW='<contraseña de prueba>' \
//   PREVIEW=https://<deploy>.vercel.app SHARE=<token _vercel_share> FACTURA=<uuid de factura emitida> \
//   node scripts/verificar-staging.mjs
// Usuarios esperados en staging: jaime@impulsa.test (admin), laura@impulsa.test (comercial).
// Nunca contra producción: crea y borra archivos y genera PDFs.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";

if (/sfjzwieddvniimeetrud/.test(process.env.SB_URL ?? "")) throw new Error("Este script no se ejecuta contra producción.");
const URL_SB = process.env.SB_URL, KEY = process.env.SB_KEY, PW = process.env.PW;
const PREVIEW = process.env.PREVIEW, SHARE = process.env.SHARE, FACTURA = process.env.FACTURA;
const res = [];
const check = (ok, t, extra = "") => { res.push({ ok: !!ok, t, extra }); console.log(ok ? "✓" : "✗", t, extra); };
const cli = () => createClient(URL_SB, KEY, { auth: { persistSession: false } });
async function login(email) { const c = cli(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(email + ": " + error.message); return c; }

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const admin = await login("jaime@impulsa.test");
check(true, "login real admin (Supabase Auth)");
const laura = await login("laura@impulsa.test");
check(true, "login real comercial");
const anon = cli();

const B = "documentos";
const { data: bucket } = await admin.storage.getBucket(B);
check(bucket && bucket.public === false, "bucket documentos existe y es privado", JSON.stringify({ public: bucket?.public, limite: bucket?.file_size_limit }));

// Subida / descarga / signed URL / reemplazo / borrado (admin)
const ruta = `${randomUUID()}/prueba-real.pdf`;
let r = await admin.storage.from(B).upload(ruta, pdf, { contentType: "application/pdf" });
check(!r.error, "admin sube PDF", r.error?.message ?? "");
r = await admin.storage.from(B).download(ruta);
check(!r.error && (await r.data.arrayBuffer()).byteLength === pdf.length, "admin descarga el mismo archivo");
const s = await admin.storage.from(B).createSignedUrl(ruta, 60);
const f1 = await fetch(s.data?.signedUrl ?? "http://x");
check(!s.error && f1.status === 200, "signed URL (60 s) funciona", `HTTP ${f1.status}`);
const s2 = await admin.storage.from(B).createSignedUrl(ruta, 1);
await new Promise((ok) => setTimeout(ok, 4000));
const f2 = await fetch(s2.data?.signedUrl ?? "http://x");
check(f2.status >= 400, "signed URL caducada (1 s) ya no sirve", `HTTP ${f2.status}`);
const pub = admin.storage.from(B).getPublicUrl(ruta).data.publicUrl;
const f3 = await fetch(pub);
check(f3.status >= 400, "no hay URL pública", `HTTP ${f3.status}`);
const f4 = await fetch(`${URL_SB}/storage/v1/object/${B}/${ruta}`);
check(f4.status >= 400, "sin token no se descarga", `HTTP ${f4.status}`);
r = await admin.storage.from(B).upload(ruta, Buffer.concat([pdf, Buffer.from("%v2\n")]), { contentType: "application/pdf", upsert: true });
check(!r.error, "admin reemplaza (upsert)", r.error?.message ?? "");
r = await admin.storage.from(B).upload(ruta, pdf, { contentType: "application/pdf" });
check(!!r.error, "subir encima sin upsert se rechaza", r.error?.message ?? "");

// MIME / extensión / ruta / tamaño
r = await admin.storage.from(B).upload(`${randomUUID()}/pagina.html`, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" });
check(!!r.error, "HTML rechazado", r.error?.message ?? "");
r = await admin.storage.from(B).upload(`${randomUUID()}/malo.pdf`, Buffer.from("x"), { contentType: "text/html" });
check(!!r.error, "MIME no permitido con extensión .pdf rechazado", r.error?.message ?? "");
r = await admin.storage.from(B).upload(`${randomUUID()}/programa.exe`, pdf, { contentType: "application/pdf" });
check(!!r.error, ".exe rechazado aunque diga ser PDF", r.error?.message ?? "");
r = await admin.storage.from(B).upload(`sin-uuid/doc.pdf`, pdf, { contentType: "application/pdf" });
check(!!r.error, "ruta sin carpeta {uuid} rechazada", r.error?.message ?? "");
const grande = Buffer.alloc(52428800 + 1024, 0x20);
grande.write("%PDF-1.4\n");
r = await admin.storage.from(B).upload(`${randomUUID()}/grande.pdf`, grande, { contentType: "application/pdf" });
check(!!r.error, "archivo > 50 MB rechazado", r.error?.message ?? "");

// Comercial y anónimo: nada
const l1 = await laura.storage.from(B).list(ruta.split("/")[0]);
check(!l1.error && (l1.data ?? []).length === 0, "comercial no puede listar", `${(l1.data ?? []).length} objetos`);
r = await laura.storage.from(B).upload(`${randomUUID()}/laura.pdf`, pdf, { contentType: "application/pdf" });
check(!!r.error, "comercial no puede subir", r.error?.message ?? "");
r = await laura.storage.from(B).download(ruta);
check(!!r.error, "comercial no puede descargar", r.error?.message ?? "");
const ls = await laura.storage.from(B).createSignedUrl(ruta, 60);
check(!!ls.error, "comercial no puede generar signed URL", ls.error?.message ?? "");
const lr = await laura.storage.from(B).remove([ruta]);
const sigue = await admin.storage.from(B).download(ruta);
check(!sigue.error, "comercial no puede borrar (el objeto sigue)", lr.error?.message ?? `${(lr.data ?? []).length} borrados`);
r = await anon.storage.from(B).download(ruta);
check(!!r.error, "anónimo no puede descargar", r.error?.message ?? "");
r = await anon.storage.from(B).upload(`${randomUUID()}/anon.pdf`, pdf, { contentType: "application/pdf" });
check(!!r.error, "anónimo no puede subir", r.error?.message ?? "");
const al = await anon.storage.from(B).list();
check((al.data ?? []).length === 0, "anónimo no lista nada");
// Datos por API REST (PostgREST real) con cada rol
for (const [nombre, c, esperado] of [["comercial", laura, 0], ["anónimo", anon, 0]]) {
  for (const t of ["cuentas", "facturas", "gastos", "documentos", "actividad", "proyectos"]) {
    const q = await c.from(t).select("id", { count: "exact", head: true });
    check((q.count ?? 0) === esperado, `${nombre}: ${t} → 0 filas por API`, `count=${q.count} ${q.error?.message ?? ""}`);
  }
}
const qa = await admin.from("facturas").select("id", { count: "exact", head: true });
check((qa.count ?? 0) > 0, "admin: facturas visibles por API", `count=${qa.count}`);

// Borrado
r = await admin.storage.from(B).remove([ruta]);
const tras = await admin.storage.from(B).download(ruta);
check(!r.error && !!tras.error, "admin borra y ya no existe");

// ===== PDF real: Preview de Vercel → Storage → registro =====
if (PREVIEW && FACTURA) {
  const jar = new Map();
  const ssr = createServerClient(URL_SB, KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: "jaime@impulsa.test", password: PW });
  check(!error, "sesión SSR (cookies) creada");
  // Cookie de acceso al Preview protegido.
  const acceso = await fetch(`${PREVIEW}/?_vercel_share=${SHARE}`, { redirect: "manual" });
  const vc = (acceso.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
  const cookie = [...vc, ...[...jar].map(([n, v]) => `${n}=${v}`)].join("; ");
  const cookieLaura = await (async () => {
    const j = new Map();
    const c = createServerClient(URL_SB, KEY, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => j.set(name, value)) } });
    await c.auth.signInWithPassword({ email: "laura@impulsa.test", password: PW });
    return [...vc, ...[...j].map(([n, v]) => `${n}=${v}`)].join("; ");
  })();

  const sinSesion = await fetch(`${PREVIEW}/api/facturas/${FACTURA}/pdf`, { method: "POST", headers: { cookie: vc.join("; ") } });
  check(sinSesion.status === 401 || sinSesion.status === 403, "PDF sin sesión rechazado", `HTTP ${sinSesion.status}`);
  const comercial = await fetch(`${PREVIEW}/api/facturas/${FACTURA}/pdf`, { method: "POST", headers: { cookie: cookieLaura } });
  check(comercial.status === 403 || comercial.status === 404, "PDF como comercial rechazado", `HTTP ${comercial.status}`);

  const t0 = Date.now();
  const g1 = await fetch(`${PREVIEW}/api/facturas/${FACTURA}/pdf`, { method: "POST", headers: { cookie } });
  const j1 = await g1.json().catch(() => ({}));
  check(g1.ok, "PDF generado en Vercel (servidor)", `HTTP ${g1.status} ${Date.now() - t0} ms ${JSON.stringify(j1).slice(0, 200)}`);
  const { data: fa } = await admin.from("facturas_estado").select("numero,pdf_path,pdf_huella,pdf_estado").eq("id", FACTURA).single();
  check(fa?.pdf_path && fa?.pdf_estado === "actualizado", "factura: pdf_path + huella, estado actualizado", JSON.stringify(fa));
  const { data: doc } = await admin.from("documentos").select("id,storage_path,origen,categoria,tamano,mime_type").eq("factura_id", FACTURA);
  check(doc?.length === 1 && doc[0].storage_path === fa?.pdf_path && doc[0].origen === "generado", "registro en documentos", JSON.stringify(doc));
  const dl = await admin.storage.from(B).download(fa?.pdf_path ?? "x");
  const bytes = dl.data ? Buffer.from(await dl.data.arrayBuffer()) : Buffer.alloc(0);
  check(bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length > 1000, "el PDF existe en Storage real y es un PDF", `${bytes.length} bytes`);
  if (bytes.length) (await import("node:fs")).writeFileSync("factura-real.pdf", bytes);
  const sd = await admin.storage.from(B).createSignedUrl(fa?.pdf_path ?? "x", 60, { download: true });
  const fd = await fetch(sd.data?.signedUrl ?? "http://x");
  check(fd.status === 200 && (fd.headers.get("content-disposition") ?? "").includes("attachment"), "descarga por signed URL (attachment)", fd.headers.get("content-disposition") ?? "");
  // Regenerar: nueva ruta, el anterior se borra, sigue habiendo 1 documento.
  const g2 = await fetch(`${PREVIEW}/api/facturas/${FACTURA}/pdf`, { method: "POST", headers: { cookie } });
  const { data: fb } = await admin.from("facturas_estado").select("pdf_path,pdf_estado").eq("id", FACTURA).single();
  const { data: doc2 } = await admin.from("documentos").select("id").eq("factura_id", FACTURA);
  const viejo = await admin.storage.from(B).download(fa?.pdf_path ?? "x");
  check(g2.ok && fb?.pdf_path && fb.pdf_path !== fa?.pdf_path && doc2?.length === 1 && !!viejo.error, "regenerar: nueva ruta, 1 documento, el viejo se borra de Storage", `HTTP ${g2.status}`);
}

console.log(JSON.stringify({ total: res.length, fallos: res.filter((x) => !x.ok).map((x) => x.t) }));
