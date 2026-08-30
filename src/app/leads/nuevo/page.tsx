"use client";

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
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Nuevo lead</h1>
      <p className="mb-5 text-sm text-slate-500">No se inventan datos: solo se guarda lo que introduzcas.</p>

      <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setModo("rapida")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            modo === "rapida" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"
          }`}
        >
          Alta rápida
        </button>
        <button
          onClick={() => setModo("completa")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            modo === "completa" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"
          }`}
        >
          Alta completa
        </button>
      </div>

      {modo === "rapida" ? (
        <QuickLeadForm
          usuarios={usuarios}
          usuarioActualId={usuarioActual.id}
          puedeAsignar={esAdmin}
          onSubmit={guardar}
          onCancelar={() => router.back()}
        />
      ) : (
        <LeadForm
          usuarios={usuarios}
          usuarioActualId={usuarioActual.id}
          puedeAsignar={esAdmin}
          valoresIniciales={{ asignado_a: usuarioActual.id }}
          onSubmit={guardar}
          onCancelar={() => router.back()}
        />
      )}
    </div>
  );
}
