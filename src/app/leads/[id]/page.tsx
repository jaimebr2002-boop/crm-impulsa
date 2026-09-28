"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUsuario } from "@/context/UsuarioContext";
import { actualizarLead, eliminarLeads, obtenerLead } from "@/lib/data/leads";
import { crearInteraccion, listarInteracciones, type InteraccionConUsuario } from "@/lib/data/interacciones";
import { crearEvento, listarEventosPorLead, marcarEventoCompletado } from "@/lib/data/eventos";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { Evento, Lead, Usuario } from "@/lib/types";
import { CANAL_LABEL, ORIGEN_LABEL, SEGMENTO_LABEL, SEGMENTO_COLOR, formatEuros } from "@/lib/constants";
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/EmptyState";
import { EstadoLead } from "@/components/ventas/TablaLeads";
import { telHref, whatsappHref, esTelefonoFijoEspanol } from "@/lib/phone";
import { instagramHref } from "@/lib/instagram";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ReferralBanner } from "@/components/ReferralBanner";
import { Avatar } from "@/components/Avatar";
import { PhoneIndicator } from "@/components/PhoneIndicator";
import { LeadStatusSelector } from "@/components/LeadStatusSelector";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { EventCard } from "@/components/EventCard";
import { Modal } from "@/components/Modal";
import { InteractionForm } from "@/components/forms/InteractionForm";
import { EventForm } from "@/components/forms/EventForm";
import { LeadForm, type LeadFormValores } from "@/components/forms/LeadForm";
import { IconTelefono, IconWhatsapp } from "@/components/Icons";
import { ConvertirLead } from "@/components/trabajo/ConvertirLead";

export default function LeadDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { usuarioActual, esAdmin } = useUsuario();

  const [lead, setLead] = useState<Lead | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [interacciones, setInteracciones] = useState<InteraccionConUsuario[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"llamada" | "nota" | "evento" | "editar" | "eliminar" | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!params.id) return;
    setCargando(true);
    setError(null);
    try {
      const [l, u, i, e] = await Promise.all([
        obtenerLead(params.id),
        listarUsuarios(),
        listarInteracciones(params.id),
        listarEventosPorLead(params.id),
      ]);
      setLead(l);
      setUsuarios(u);
      setInteracciones(i);
      setEventos(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar el lead.");
    } finally {
      setCargando(false);
    }
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <LoadingState />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje="No se ha podido cargar el lead." onReintentar={cargar} /></div>;
  if (!lead) return <div className="p-6"><ErrorState mensaje="Este lead no existe o ha sido eliminado." /></div>;

  const asignado = usuarios.find((u) => u.id === lead.asignado_a) ?? null;
  const esFijo = esTelefonoFijoEspanol(lead.telefono);

  async function cambiarEstado(nuevoEstado: string) {
    const actualizado = await actualizarLead(lead!.id, { estado: nuevoEstado });
    setLead(actualizado);
  }

  async function cambiarAsignado(usuarioId: string) {
    const actualizado = await actualizarLead(lead!.id, { asignado_a: usuarioId });
    setLead(actualizado);
  }

  async function guardarEdicion(valores: LeadFormValores) {
    const actualizado = await actualizarLead(lead!.id, valores);
    setLead(actualizado);
    setModal(null);
  }

  async function cambiarArchivado(archivado: boolean) {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const actualizado = await actualizarLead(lead!.id, { archivado });
      setLead(actualizado);
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se ha podido actualizar el lead.");
    } finally {
      setProcesando(false);
    }
  }

  async function eliminar() {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const borrados = await eliminarLeads([lead!.id]);
      if (borrados === 0) throw new Error("No tienes permiso para eliminar este lead.");
      router.replace("/leads");
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se ha podido eliminar el lead.");
      setProcesando(false);
      setModal(null);
    }
  }

  async function toggleEvento(id: string, completada: boolean) {
    const actualizado = await marcarEventoCompletado(id, completada);
    setEventos((prev) => prev.map((e) => (e.id === id ? actualizado : e)));
  }

  async function guardarInteraccion(
    interaccion: { canal: string; resultado: string | null; nota: string | null },
    seguimiento: { titulo: string; fecha_hora: string; usuario_id: string } | null
  ) {
    await crearInteraccion({
      lead_id: lead!.id,
      usuario_id: usuarioActual?.id ?? null,
      canal: interaccion.canal,
      resultado: interaccion.resultado,
      nota: interaccion.nota,
    });
    if (seguimiento) {
      await crearEvento({
        lead_id: lead!.id,
        titulo: seguimiento.titulo,
        fecha_hora: seguimiento.fecha_hora,
        usuario_id: seguimiento.usuario_id || null,
      });
    }
    setModal(null);
    await cargar();
  }

  async function guardarEvento(valores: { titulo: string; fecha_hora: string; usuario_id: string }) {
    await crearEvento({
      lead_id: lead!.id,
      titulo: valores.titulo,
      fecha_hora: valores.fecha_hora,
      usuario_id: valores.usuario_id || null,
    });
    setModal(null);
    await cargar();
  }

  const eventosOrdenados = [...eventos].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

  const nombre = lead.negocio || lead.nombre_contacto || "Sin negocio";
  const pendientes = eventosOrdenados.filter((e) => !e.completada);
  const hechos = eventosOrdenados.filter((e) => e.completada);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <nav aria-label="Migas" className="mb-3 flex items-center gap-1.5 text-sm text-ink3">
        <Link href="/leads" className="hover:text-ink">
          Ventas
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink2">{nombre}</span>
      </nav>

      {/* Cabecera: quién es, en qué estado está, cuánto vale y cómo contactar */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar nombre={nombre} size="lg" />
          <div className="min-w-0">
            <h1 className="t-page truncate">{nombre}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink2">
              {lead.negocio && lead.nombre_contacto ? <span>{lead.nombre_contacto}</span> : null}
              <EstadoLead estado={lead.estado} />
              {lead.valor != null ? <span className="font-medium tabular-nums text-ink">{formatEuros(lead.valor)}</span> : null}
              {asignado ? <span className="text-ink3">· {asignado.nombre}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.telefono ? (
            <a href={telHref(lead.telefono)} className="btn-secondary" aria-label={`Llamar a ${lead.telefono}`}>
              <IconTelefono className="h-4 w-4" />
              Llamar
            </a>
          ) : null}
          {lead.telefono && !esFijo ? (
            <a href={whatsappHref(lead.telefono)} target="_blank" rel="noreferrer" className="btn-secondary">
              <IconWhatsapp className="h-4 w-4" />
              WhatsApp
            </a>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="btn-secondary">
              Email
            </a>
          ) : null}
          <button onClick={() => setModal("llamada")} className="btn-primary">
            Registrar llamada
          </button>
        </div>
      </div>

      {lead.archivado ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-medium">Lead archivado · no aparece en listas ni en el pipeline.</span>
          <button onClick={() => cambiarArchivado(false)} disabled={procesando} className="shrink-0 font-semibold underline disabled:opacity-60">
            Restaurar
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {esAdmin ? <ConvertirLead lead={lead} /> : null}
          <ReferralBanner referidoPor={lead.referido_por} />

          <Panel titulo="Seguimientos" contador={pendientes.length} accion={{ texto: "Nuevo", onClick: () => setModal("evento") }}>
            {eventosOrdenados.length === 0 ? (
              <EmptyState
                compacto
                titulo="Sin seguimientos programados"
                accion={
                  <button onClick={() => setModal("evento")} className="btn-secondary">
                    Programar seguimiento
                  </button>
                }
              />
            ) : (
              <div className="divide-y divide-line">
                {[...pendientes, ...hechos].map((ev) => (
                  <EventCard key={ev.id} evento={ev} onToggleCompletada={toggleEvento} />
                ))}
              </div>
            )}
          </Panel>

          <Panel titulo="Historial" contador={interacciones.length} accion={{ texto: "Añadir nota", onClick: () => setModal("nota") }}>
            <div className="px-4 py-1">
              <InteractionTimeline interacciones={interacciones} />
            </div>
          </Panel>
        </div>

        {/* Propiedades */}
        <aside className="order-first flex flex-col gap-4 lg:order-last">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <LeadStatusSelector value={lead.estado} onChange={cambiarEstado} />
            {esAdmin ? (
              <AssigneeSelector usuarios={usuarios} value={lead.asignado_a} onChange={cambiarAsignado} />
            ) : (
              <div>
                <span className="field-label">Responsable</span>
                <p className="text-sm font-medium text-ink">{asignado?.nombre ?? "Sin asignar"}</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="t-eyebrow">Datos</h2>
              <button onClick={() => setModal("editar")} className="btn-ghost -my-1 px-2 py-1 text-xs">
                Editar
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-1">
              <Campo label="Teléfono" valor={lead.telefono ? <span className="inline-flex items-center gap-1.5">{lead.telefono} <PhoneIndicator telefono={lead.telefono} /></span> : null} />
              <Campo label="Email" valor={lead.email} />
              <Campo label={lead.estado === "cerrado" ? "Valor ganado" : "Valor estimado"} valor={lead.valor != null ? formatEuros(lead.valor) : null} />
              <Campo label="Nicho" valor={lead.nicho} />
              <Campo label="Ciudad" valor={lead.ciudad} />
              <Campo label="Canal" valor={lead.canal ? CANAL_LABEL[lead.canal] ?? lead.canal : null} />
              <Campo label="Origen" valor={lead.origen ? ORIGEN_LABEL[lead.origen] ?? lead.origen : null} />
              <Campo
                label="Segmento"
                valor={lead.segmento ? <span className={`chip ${SEGMENTO_COLOR[lead.segmento] ?? ""}`}>{SEGMENTO_LABEL[lead.segmento] ?? lead.segmento}</span> : null}
              />
              <Campo
                label="Instagram"
                valor={
                  lead.instagram ? (
                    <a href={instagramHref(lead.instagram)} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                      {lead.instagram}
                    </a>
                  ) : null
                }
              />
              <Campo label="Oferta" valor={lead.oferta} />
              <Campo
                label="Demo"
                valor={
                  lead.enlace_demo ? (
                    <a href={lead.enlace_demo} target="_blank" rel="noreferrer" className="break-all text-ink underline decoration-line underline-offset-2">
                      {lead.enlace_demo}
                    </a>
                  ) : null
                }
              />
            </dl>
          </div>
          <div className="flex flex-wrap gap-2 px-1">
            {errorAccion ? <p className="field-error w-full">{errorAccion}</p> : null}
            {!lead.archivado ? (
              <button onClick={() => cambiarArchivado(true)} disabled={procesando} className="btn-ghost">
                Archivar
              </button>
            ) : null}
            {esAdmin ? (
              <button onClick={() => setModal("eliminar")} disabled={procesando} className="btn-ghost text-red-600 dark:text-red-400">
                Eliminar
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      {modal === "eliminar" ? (
        <Modal titulo="Eliminar lead" onClose={() => setModal(null)}>
          <p className="text-sm text-ink2">
            Se borrará <strong className="text-ink">{lead.negocio || lead.nombre_contacto || "este lead"}</strong> junto con todo su
            historial y seguimientos. No se puede deshacer. Si solo quieres quitarlo de en medio, archívalo.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">
              Cancelar
            </button>
            <button onClick={eliminar} disabled={procesando} className="btn-danger">
              {procesando ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      ) : null}

      {modal === "llamada" ? (
        <Modal titulo="Registrar llamada" onClose={() => setModal(null)}>
          <InteractionForm
            variante="llamada"
            usuarios={usuarios}
            usuarioResponsablePorDefecto={lead.asignado_a}
            onSubmit={guardarInteraccion}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      ) : null}

      {modal === "nota" ? (
        <Modal titulo="Añadir nota" onClose={() => setModal(null)}>
          <InteractionForm
            variante="nota"
            usuarios={usuarios}
            usuarioResponsablePorDefecto={lead.asignado_a}
            onSubmit={guardarInteraccion}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      ) : null}

      {modal === "evento" ? (
        <Modal titulo="Crear seguimiento" onClose={() => setModal(null)}>
          <EventForm
            usuarios={usuarios}
            usuarioResponsablePorDefecto={lead.asignado_a}
            onSubmit={guardarEvento}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      ) : null}

      {modal === "editar" && usuarioActual ? (
        <Modal titulo="Editar lead" onClose={() => setModal(null)} ancho="max-w-lg">
          <LeadForm
            usuarios={usuarios}
            usuarioActualId={usuarioActual.id}
            puedeAsignar={esAdmin}
            valoresIniciales={lead}
            draftKey={`lead-editar-${lead.id}`}
            onSubmit={guardarEdicion}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink3">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{valor || <span className="text-ink3">—</span>}</dd>
    </div>
  );
}
