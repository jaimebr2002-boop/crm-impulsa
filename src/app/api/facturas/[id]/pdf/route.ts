import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { crearPdfFactura } from "@/lib/pdf/facturaPdf";
import { faltanDatosEmisor, faltanDatosReceptor } from "@/lib/facturacion";
import { BUCKET_DOCUMENTOS, nombreSeguro } from "@/lib/documentos";
import type { AjustesFacturacion, Cuenta, FacturaEstado } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const error = (status: number, mensaje: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: mensaje, ...extra }, { status });

/**
 * Genera el PDF de una factura, lo guarda en Storage y lo registra.
 *
 * Todo se hace con la sesión del usuario (cookies + clave anónima): RLS y las
 * políticas de Storage deciden. Un comercial no ve la factura → 404.
 *
 * Regenerar = sustituir: el PDF nuevo se sube a una ruta nueva dentro de la
 * carpeta del mismo documento, se actualiza el registro (mismo id, mismos
 * metadatos) y se borra el anterior. Nunca se acumulan versiones y nunca hay
 * un registro apuntando a un archivo inexistente.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServidor();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return error(401, "Tu sesión ha caducado. Vuelve a entrar.");

  const { data: factura, error: e1 } = await sb
    .from("facturas_estado")
    .select("*, cuenta:cuentas(*)")
    .eq("id", id)
    .maybeSingle<FacturaEstado & { cuenta: Cuenta | null }>();
  if (e1) return error(500, e1.message);
  if (!factura) return error(404, "Factura no encontrada.");
  if (factura.estado === "borrador" || !factura.numero) return error(409, "Emite la factura antes de generar el PDF.");

  const [{ data: lineas, error: e2 }, { data: ajustes, error: e3 }] = await Promise.all([
    sb.from("factura_lineas").select("concepto, descripcion, cantidad, precio_unitario, importe").eq("factura_id", factura.id).order("orden").order("id"),
    sb.from("ajustes_facturacion").select("*").eq("id", true).maybeSingle<AjustesFacturacion>(),
  ]);
  if (e2 || e3) return error(500, (e2 ?? e3)!.message);

  const faltanEmisor = faltanDatosEmisor(ajustes);
  const faltanReceptor = faltanDatosReceptor(factura.cuenta);
  if (faltanEmisor.length || faltanReceptor.length) {
    return error(
      422,
      faltanEmisor.length ? "Configura tus datos de facturación antes de generar el PDF." : "Faltan datos de facturación del cliente.",
      { faltanEmisor, faltanReceptor }
    );
  }

  const c = factura.cuenta!;
  const a = ajustes!;
  const bytes = await crearPdfFactura(
    {
      numero: factura.numero,
      estado: factura.estado === "cancelada" ? "cancelada" : "emitida",
      fecha_emision: factura.fecha_emision,
      fecha_operacion: factura.fecha_operacion,
      fecha_vencimiento: factura.fecha_vencimiento,
      ultimo_cobro: factura.ultimo_cobro,
      estado_cobro: factura.estado_cobro,
      texto_legal: factura.texto_legal,
      concepto_pago: factura.concepto_pago,
      iva_pct: factura.iva_pct,
      irpf_pct: factura.irpf_pct,
      base: factura.base,
      iva: factura.iva,
      irpf: factura.irpf,
      total: factura.total,
      lineas: lineas ?? [],
    },
    {
      nombre: a.nombre!,
      nif: a.nif!,
      direccion: a.direccion!,
      codigo_postal: a.codigo_postal!,
      ciudad: a.ciudad!,
      provincia: a.provincia,
      pais: a.pais,
      email: a.email,
      telefono: a.telefono,
      iban: a.iban,
      titular_iban: a.titular_iban,
      texto_legal: a.texto_legal,
    },
    {
      nombre: c.fiscal_nombre || c.nombre,
      nif: c.fiscal_nif,
      direccion: c.fiscal_direccion,
      codigo_postal: c.fiscal_codigo_postal,
      ciudad: c.fiscal_ciudad,
      provincia: c.fiscal_provincia,
      pais: c.fiscal_pais,
      email: c.email_facturacion,
    }
  );

  // Mismo documento si ya había PDF (su id es la carpeta); si no, uno nuevo.
  const anterior = factura.pdf_path;
  const documentoId = anterior ? anterior.split("/")[0] : crypto.randomUUID();
  const ruta = `${documentoId}/${nombreSeguro(`factura-${factura.numero}-${Date.now().toString(36)}.pdf`)}`;

  const storage = sb.storage.from(BUCKET_DOCUMENTOS);
  const { error: e4 } = await storage.upload(ruta, bytes, { contentType: "application/pdf", upsert: false });
  if (e4) return error(502, `No se pudo guardar el PDF en el almacenamiento (${e4.message}).`);

  const { error: e5 } = await sb.rpc("registrar_pdf_factura", {
    p_factura_id: factura.id,
    p_documento_id: documentoId,
    p_storage_path: ruta,
    p_tamano: bytes.byteLength,
  });
  if (e5) {
    await storage.remove([ruta]);
    return error(500, `No se pudo registrar el PDF (${e5.message}). No se ha guardado nada.`);
  }
  // El anterior ya no lo referencia nadie. Si no se puede borrar, queda como huérfano limpiable.
  if (anterior && anterior !== ruta) await storage.remove([anterior]);

  return NextResponse.json({ documentoId, regenerado: !!anterior, bytes: bytes.byteLength });
}
