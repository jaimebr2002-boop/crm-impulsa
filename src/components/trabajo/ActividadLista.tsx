"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { ESTADO_LABEL } from "@/lib/constants";
import { aYMD, formatHaceCuanto, formatHora, hoyYMD, sumarDiasYMD, ymdADate } from "@/lib/dates";
import { ESTADO_PROYECTO_LABEL, ESTADO_TAREA_LABEL } from "@/lib/trabajo";
import { CATEGORIA_GASTO_LABEL, eur, METODO_COBRO_LABEL, periodicidadCorta } from "@/lib/finanzas";
import type { Actividad, CategoriaGasto, EstadoProyecto, EstadoTarea, MetodoCobro, Periodicidad } from "@/lib/types";

/** Una acción del historial convertida en frase. `verbo` va en 3.ª persona
 * ("completó") y `verboTu` en 2.ª ("completaste") para tus propias acciones. */
type Frase = {
  verbo: string;
  verboTu: string;
  objeto: string;
  href: string | null;
  complemento?: { texto: string; href?: string | null };
  punto: string;
};

const cita = (t: string | null | undefined) => (t ? `«${t}»` : "");
const texto = (v: unknown) => (typeof v === "string" ? v : null);
const importe = (v: unknown) => (typeof v === "number" || typeof v === "string" ? eur(v) : "");

function describir(a: Actividad): Frase {
  const nombre = cita(a.titulo);
  const de = texto(a.datos?.de);
  const hacia = texto(a.datos?.a) ?? "";
  const proyectoId = a.proyecto_id ?? texto(a.datos?.proyecto_id);
  const proyectoNombre = texto(a.datos?.proyecto_nombre);
  const enProyecto =
    proyectoId && proyectoNombre ? { texto: `en ${cita(proyectoNombre)}`, href: `/proyectos/${proyectoId}` } : undefined;

  switch (a.entidad) {
    case "proyecto": {
      const href = a.accion === "eliminado" ? null : `/proyectos/${a.entidad_id}`;
      if (a.accion === "creado") {
        const lead = texto(a.datos?.lead_nombre);
        if (lead)
          return {
            verbo: `convirtió el lead ${cita(lead)} en el proyecto`,
            verboTu: `convertiste el lead ${cita(lead)} en el proyecto`,
            objeto: nombre,
            href,
            punto: "bg-emerald-500",
          };
        return { verbo: "creó el proyecto", verboTu: "creaste el proyecto", objeto: nombre, href, punto: "bg-brand" };
      }
      if (a.accion === "estado") {
        if (hacia === "entregado") return { verbo: "entregó", verboTu: "entregaste", objeto: nombre, href, punto: "bg-emerald-500" };
        const desde = de ? ` de ${ESTADO_PROYECTO_LABEL[de as EstadoProyecto] ?? de}` : "";
        const a2 = ESTADO_PROYECTO_LABEL[hacia as EstadoProyecto] ?? hacia;
        return {
          verbo: "movió",
          verboTu: "moviste",
          objeto: nombre,
          href,
          complemento: { texto: `${desde} a ${a2}`.trim() },
          punto: hacia === "cancelado" ? "bg-red-400" : "bg-blue-500",
        };
      }
      const acciones: Record<string, [string, string, string]> = {
        archivado: ["archivó el proyecto", "archivaste el proyecto", "bg-ink3"],
        restaurado: ["restauró el proyecto", "restauraste el proyecto", "bg-ink3"],
        eliminado: ["eliminó el proyecto", "eliminaste el proyecto", "bg-red-500"],
      };
      const [v, vt, p] = acciones[a.accion] ?? [a.accion, a.accion, "bg-ink3"];
      return { verbo: v, verboTu: vt, objeto: nombre, href, punto: p };
    }

    case "tarea": {
      const href = proyectoId ? `/proyectos/${proyectoId}?tab=tareas` : "/tareas?vista=todas";
      if (a.accion === "creado")
        return { verbo: "añadió la tarea", verboTu: "añadiste la tarea", objeto: nombre, href, complemento: enProyecto, punto: "bg-ink3" };
      if (a.accion === "completada")
        return { verbo: "completó", verboTu: "completaste", objeto: nombre, href, complemento: enProyecto, punto: "bg-emerald-500" };
      return {
        verbo: "movió la tarea",
        verboTu: "moviste la tarea",
        objeto: nombre,
        href,
        complemento: { texto: `a ${ESTADO_TAREA_LABEL[hacia as EstadoTarea] ?? hacia}` },
        punto: "bg-blue-500",
      };
    }

    case "lead": {
      const href = `/leads/${a.entidad_id}`;
      if (hacia === "cerrado") return { verbo: "ganó el lead", verboTu: "ganaste el lead", objeto: nombre, href, punto: "bg-emerald-500" };
      if (hacia === "descartado") return { verbo: "perdió el lead", verboTu: "perdiste el lead", objeto: nombre, href, punto: "bg-red-400" };
      return {
        verbo: "movió el lead",
        verboTu: "moviste el lead",
        objeto: nombre,
        href,
        complemento: { texto: `a ${ESTADO_LABEL[hacia] ?? hacia}` },
        punto: "bg-sky-500",
      };
    }

    case "cuenta": {
      const href = `/cuentas/${a.entidad_id}`;
      if (a.accion === "archivado") return { verbo: "archivó la cuenta", verboTu: "archivaste la cuenta", objeto: nombre, href, punto: "bg-ink3" };
      if (a.accion === "restaurado") return { verbo: "restauró la cuenta", verboTu: "restauraste la cuenta", objeto: nombre, href, punto: "bg-ink3" };
      return { verbo: "creó la cuenta", verboTu: "creaste la cuenta", objeto: nombre, href, punto: "bg-violet-500" };
    }

    case "marca": {
      const cuenta = texto(a.datos?.cuenta_nombre);
      return {
        verbo: "creó la marca",
        verboTu: "creaste la marca",
        objeto: nombre,
        href: `/marcas/${a.entidad_id}`,
        complemento: cuenta ? { texto: `en ${cuenta}`, href: a.cuenta_id ? `/cuentas/${a.cuenta_id}` : null } : undefined,
        punto: "bg-violet-500",
      };
    }

    case "evento": {
      const reunion = a.datos?.tipo === "reunion";
      const cuando = texto(a.datos?.fecha_hora);
      return {
        verbo: reunion ? "programó la reunión" : "programó el evento",
        verboTu: reunion ? "programaste la reunión" : "programaste el evento",
        objeto: nombre,
        href: "/calendario",
        complemento: cuando ? { texto: `para el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(cuando))} a las ${formatHora(cuando)}` } : undefined,
        punto: "bg-pink-500",
      };
    }

    case "factura": {
      const href = `/finanzas/facturas/${a.entidad_id}`;
      const cuenta = texto(a.datos?.cuenta_nombre);
      const total = importe(a.datos?.total);
      const detalle = [cuenta && `a ${cuenta}`, total].filter(Boolean).join(" · ");
      const acciones: Record<string, [string, string, string]> = {
        emitida: ["emitió la factura", "emitiste la factura", "bg-emerald-500"],
        enviada: ["envió la factura", "enviaste la factura", "bg-sky-500"],
        cobrada: ["terminó de cobrar la factura", "terminaste de cobrar la factura", "bg-emerald-500"],
        cancelada: ["canceló la factura", "cancelaste la factura", "bg-red-400"],
      };
      const [v, vt, p] = acciones[a.accion] ?? [a.accion, a.accion, "bg-ink3"];
      return {
        verbo: v,
        verboTu: vt,
        objeto: nombre,
        href,
        complemento: a.accion === "emitida" && detalle ? { texto: detalle } : undefined,
        punto: p,
      };
    }

    case "cobro": {
      const facturaId = texto(a.datos?.factura_id);
      const href = facturaId ? `/finanzas/facturas/${facturaId}` : null;
      const cuanto = importe(a.datos?.importe);
      const metodo = texto(a.datos?.metodo);
      if (a.accion === "eliminado")
        return {
          verbo: `eliminó un cobro de ${cuanto} de la factura`,
          verboTu: `eliminaste un cobro de ${cuanto} de la factura`,
          objeto: nombre,
          href,
          punto: "bg-red-400",
        };
      return {
        verbo: `cobró ${cuanto} de la factura`,
        verboTu: `cobraste ${cuanto} de la factura`,
        objeto: nombre,
        href,
        complemento: metodo ? { texto: `por ${(METODO_COBRO_LABEL[metodo as MetodoCobro] ?? metodo).toLowerCase()}` } : undefined,
        punto: "bg-emerald-500",
      };
    }

    case "gasto": {
      const cuanto = importe(a.datos?.importe);
      const categoria = texto(a.datos?.categoria);
      const renovacion = !!a.datos?.suscripcion_id;
      return {
        verbo: renovacion ? "registró la renovación de" : "registró el gasto",
        verboTu: renovacion ? "registraste la renovación de" : "registraste el gasto",
        objeto: nombre,
        href: renovacion ? "/finanzas/suscripciones" : "/finanzas/gastos",
        complemento: {
          texto: [cuanto, !renovacion && categoria ? CATEGORIA_GASTO_LABEL[categoria as CategoriaGasto] ?? categoria : null]
            .filter(Boolean)
            .join(" · "),
        },
        punto: "bg-amber-500",
      };
    }

    case "suscripcion": {
      const href = "/finanzas/suscripciones";
      if (a.accion === "pausada") return { verbo: "pausó la suscripción", verboTu: "pausaste la suscripción", objeto: nombre, href, punto: "bg-ink3" };
      if (a.accion === "reactivada")
        return { verbo: "reactivó la suscripción", verboTu: "reactivaste la suscripción", objeto: nombre, href, punto: "bg-ink3" };
      const periodicidad = texto(a.datos?.periodicidad);
      return {
        verbo: "añadió la suscripción",
        verboTu: "añadiste la suscripción",
        objeto: nombre,
        href,
        complemento: { texto: `${importe(a.datos?.importe)}${periodicidad ? periodicidadCorta(periodicidad as Periodicidad) : ""}` },
        punto: "bg-orange-400",
      };
    }
  }
  return { verbo: a.accion, verboTu: a.accion, objeto: nombre, href: null, punto: "bg-ink3" };
}

function etiquetaDia(ymd: string): string {
  const hoy = hoyYMD();
  if (ymd === hoy) return "Hoy";
  if (ymd === sumarDiasYMD(hoy, -1)) return "Ayer";
  const t = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(ymdADate(ymd));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ActividadLista({
  items,
  vacio = "Sin actividad todavía.",
  agruparPorDia = false,
}: {
  items: Actividad[];
  vacio?: string;
  agruparPorDia?: boolean;
}) {
  const { usuariosPorId } = useApp();
  const { usuarioActual } = useUsuario();

  if (items.length === 0) return <p className="px-1 py-6 text-center text-sm text-ink3">{vacio}</p>;

  let diaAnterior = "";
  return (
    <ol className="flex flex-col">
      {items.map((a) => {
        const f = describir(a);
        const esYo = !!a.actor_id && a.actor_id === usuarioActual?.id;
        const actor = a.actor_id ? usuariosPorId[a.actor_id]?.nombre ?? "Alguien" : "El sistema";
        const verbo = esYo ? f.verboTu.charAt(0).toUpperCase() + f.verboTu.slice(1) : f.verbo;
        const dia = aYMD(new Date(a.created_at));
        const cabecera = agruparPorDia && dia !== diaAnterior ? etiquetaDia(dia) : null;
        diaAnterior = dia;
        return (
          <Fragment key={a.id}>
            {cabecera ? (
              <li className="pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-ink3 first:pt-1">{cabecera}</li>
            ) : null}
            <li className="flex items-start gap-3 py-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${f.punto}`} />
              <p className="min-w-0 flex-1 text-sm leading-snug text-ink2">
                {!esYo ? <span className="font-medium text-ink">{actor} </span> : null}
                {verbo}{" "}
                {f.href ? (
                  <Link href={f.href} className="font-medium text-ink hover:underline">
                    {f.objeto}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{f.objeto}</span>
                )}
                {f.complemento ? (
                  <>
                    {" "}
                    {f.complemento.href ? (
                      <Link href={f.complemento.href} className="hover:text-ink hover:underline">
                        {f.complemento.texto}
                      </Link>
                    ) : (
                      f.complemento.texto
                    )}
                  </>
                ) : null}
              </p>
              <time className="shrink-0 pt-px text-xs text-ink3" dateTime={a.created_at} title={new Date(a.created_at).toLocaleString("es-ES")}>
                {agruparPorDia ? formatHora(a.created_at) : formatHaceCuanto(a.created_at)}
              </time>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
