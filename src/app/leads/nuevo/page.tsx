"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUsuario } from "@/context/UsuarioContext";
import { listarUsuarios } from "@/lib/data/usuarios";
import { crearLead } from "@/lib/data/leads";
import type { LeadInsert, Usuario } from "@/lib/types";
import { LeadForm } from "@/components/forms/LeadForm";
import { QuickLeadForm } from "@/components/forms/QuickLeadForm";
import { LoadingState } from "@/components/LoadingState";

export default function NuevoLeadPage() {
  const router = useRouter();
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modo, setModo] = useState<"rapida" | "completa">("rapida");

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  async function guardar(valores: LeadInsert) {
    const lead = await crearLead(valores);
    router.push(`/leads/${lead.id}`);
  }

  if (cargandoUsuario || !usuarioActual) {
    return <LoadingState />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-6 md:px-8">
      <nav aria-label="Migas" className="mb-3 text-sm text-ink3">
        <Link href="/leads" className="hover:text-ink">
          Ventas
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink2">Nuevo lead</span>
      </nav>
      <h1 className="t-page mb-4">Nuevo lead</h1>

      <div className="mb-5 inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
        <button
          onClick={() => setModo("rapida")}
          aria-pressed={modo === "rapida"}
          className={`rounded-md px-2.5 py-1 font-medium ${modo === "rapida" ? "bg-mute text-ink" : "text-ink3 hover:text-ink"}`}
        >
          Alta rápida
        </button>
        <button
          onClick={() => setModo("completa")}
          aria-pressed={modo === "completa"}
          className={`rounded-md px-2.5 py-1 font-medium ${modo === "completa" ? "bg-mute text-ink" : "text-ink3 hover:text-ink"}`}
        >
          Alta completa
        </button>
      </div>

      {modo === "rapida" ? (
        <QuickLeadForm
          usuarios={usuarios}
          usuarioActualId={usuarioActual.id}
          puedeAsignar={esAdmin}
          draftKey="lead-nuevo-rapida"
          onSubmit={guardar}
          onCancelar={() => router.back()}
        />
      ) : (
        <LeadForm
          usuarios={usuarios}
          usuarioActualId={usuarioActual.id}
          puedeAsignar={esAdmin}
          valoresIniciales={{ asignado_a: usuarioActual.id }}
          draftKey="lead-nuevo-completa"
          onSubmit={guardar}
          onCancelar={() => router.back()}
        />
      )}
    </div>
  );
}
