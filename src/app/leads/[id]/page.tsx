"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUsuario } from "@/context/UsuarioContext";
import { actualizarLead, obtenerLead } from "@/lib/data/leads";
import { crearInteraccion, listarInteracciones, type InteraccionConUsuario } from "@/lib/data/interacciones";
import { crearEvento, listarEventosPorLead, marcarEventoCompletado } from "@/lib/data/eventos";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { Evento, Lead, Usuario } from "@/lib/types";
import { CANAL_LABEL, ESTADO_LABEL, ESTADO_COLOR, ORIGEN_LABEL, SEGMENTO_LABEL, SEGMENTO_COLOR } from "@/lib/constants";
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

  const [modal, setModal] = useState<"llamada" | "nota" | "evento" | "editar" | null>(null);

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

  if (cargando) return <LoadingState texto="Cargando lead…" />;
  if (error) return <div className="p-6"><ErrorState mensaje={error} onReintentar={cargar} /></div>;
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

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:px-8">
      <button onClick={() => router.back()} className="mb-4 text-sm font-medium text-ink3">
        ← Volver
      </button>

      {/* Cabecera */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar nombre={lead.negocio || lead.nombre_contacto || "?"} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold text-ink">{lead.negocio || "Sin negocio"}</h1>
              <p className="mt-0.5 truncate text-base text-ink2">{lead.nombre_contacto || "Sin contacto"}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${ESTADO_COLOR[lead.estado] ?? ""}`}>
            {ESTADO_LABEL[lead.estado] ?? lead.estado}
          </span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <LeadStatusSelector value={lead.estado} onChange={cambiarEstado} />
        {esAdmin ? (
          <AssigneeSelector usuarios={usuarios} value={lead.asignado_a} onChange={cambiarAsignado} />
        ) : (
          <div>
            <span className="mb-1 block text-xs font-medium text-ink2">Responsable</span>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-3 text-base font-medium text-ink2">
              {asignado?.nombre ?? "Sin asignar"}
            </div>
          </div>
        )}
      </div>

      <div className="mb-5">
        <ReferralBanner referidoPor={lead.referido_por} />
      </div>

      {/* Teléfono */}
      {lead.telefono ? (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-medium text-ink">{lead.telefono}</p>
              <div className="mt-1"><PhoneIndicator telefono={lead.telefono} /></div>
            </div>
            <div className="flex gap-2">
              <a href={telHref(lead.telefono)} className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-brand-ink">
                <IconTelefono className="h-5 w-5" />
              </a>
              {!esFijo ? (
                <a
                  href={whatsappHref(lead.telefono)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white"
                >
                  <IconWhatsapp className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Acciones rápidas */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button onClick={() => setModal("llamada")} className="rounded-2xl bg-brand-gradient py-4 text-sm font-semibold text-brand-ink">
          Registrar llamada
        </button>
        <button onClick={() => setModal("nota")} className="rounded-2xl border border-line bg-surface py-4 text-sm font-semibold text-ink">
          + Añadir nota
        </button>
        <button onClick={() => setModal("evento")} className="col-span-2 rounded-2xl border border-line bg-surface py-4 text-sm font-semibold text-ink">
          + Crear seguimiento
        </button>
      </div>

      {/* Información */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Información</h2>
          <button onClick={() => setModal("editar")} className="text-sm font-medium text-brand-dark">
            Editar
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
          <Campo label="Nicho" valor={lead.nicho} />
          <Campo label="Ciudad" valor={lead.ciudad} />
          <Campo label="Canal" valor={lead.canal ? CANAL_LABEL[lead.canal] ?? lead.canal : null} />
          <Campo
            label="Instagram"
            valor={
              lead.instagram ? (
                <a href={instagramHref(lead.instagram)} target="_blank" rel="noreferrer" className="text-brand-dark">
                  {lead.instagram}
                </a>
              ) : null
            }
          />
          <Campo label="Origen" valor={lead.origen ? ORIGEN_LABEL[lead.origen] ?? lead.origen : null} />
          <Campo
            label="Segmento"
            valor={
              lead.segmento ? (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEGMENTO_COLOR[lead.segmento] ?? ""}`}>
                  {SEGMENTO_LABEL[lead.segmento] ?? lead.segmento}
                </span>
              ) : null
            }
          />
          <Campo label="Oferta" valor={lead.oferta} />
          <Campo label="Email" valor={lead.email} />
          <Campo label="Demo" valor={lead.enlace_demo} />
        </dl>
      </section>

      {/* Seguimientos */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-ink">Seguimientos</h2>
        {eventosOrdenados.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-center text-sm text-ink3">
            Sin seguimientos programados.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {eventosOrdenados.map((ev) => (
              <EventCard key={ev.id} evento={ev} onToggleCompletada={toggleEvento} />
            ))}
          </div>
        )}
      </section>

      {/* Historial */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">Historial</h2>
        <InteractionTimeline interacciones={interacciones} />
      </section>

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
        <Modal titulo="Editar lead" onClose={() => setModal(null)}>
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
