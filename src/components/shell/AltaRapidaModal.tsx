"use client";

import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { crearCuenta, crearMarca } from "@/lib/data/cuentas";
import { crearEvento } from "@/lib/data/eventos";
import { crearProyecto } from "@/lib/data/proyectos";
import { crearTarea } from "@/lib/data/tareas";
import { Modal } from "../Modal";
import { ProyectoForm } from "../forms/ProyectoForm";
import { TareaForm } from "../forms/TareaForm";
import { CuentaForm } from "../forms/CuentaForm";
import { MarcaForm } from "../forms/MarcaForm";
import { EventoGenericoForm } from "../forms/EventoGenericoForm";
import { FacturaForm } from "../forms/FacturaForm";
import { CobroForm } from "../forms/CobroForm";
import { GastoForm } from "../forms/GastoForm";
import { SuscripcionForm } from "../forms/SuscripcionForm";
import { crearGasto, crearSuscripcion } from "@/lib/data/finanzas";
import { eur } from "@/lib/finanzas";
import { SubirDocumentoForm } from "../documentos/SubirDocumentoForm";

/** Alta rápida global: se abre desde "+ Añadir", la paleta o cualquier
 * pantalla con `abrirAlta(...)`. */
export function AltaRapidaModal() {
  const { altaRapida: alta, cerrarAlta, notificarCambio, avisar } = useApp();
  const { usuarioActual } = useUsuario();
  if (!alta) return null;

  const hecho = (texto: string, enlace?: { href: string; texto: string }) => {
    cerrarAlta();
    notificarCambio();
    avisar(texto, enlace ? { enlace } : undefined);
  };

  switch (alta.tipo) {
    case "proyecto":
      return (
        <Modal titulo={alta.valores?.proyecto_padre_id ? "Nuevo subproyecto" : "Nuevo proyecto"} onClose={cerrarAlta} ancho="max-w-lg">
          <ProyectoForm
            valoresIniciales={alta.valores}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const p = await crearProyecto(v);
              hecho(`Proyecto «${p.nombre}» creado`, { href: `/proyectos/${p.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "tarea":
      return (
        <Modal titulo="Nueva tarea" onClose={cerrarAlta} ancho="max-w-lg">
          <TareaForm
            valoresIniciales={alta.valores}
            ocultarProyecto={!!alta.valores?.proyecto_id}
            cuentaId={alta.cuentaId}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              await crearTarea(v);
              hecho("Tarea creada");
            }}
          />
        </Modal>
      );
    case "cuenta":
      return (
        <Modal titulo="Nueva cuenta" onClose={cerrarAlta}>
          <CuentaForm
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const c = await crearCuenta(v);
              hecho(`Cuenta «${c.nombre}» creada`, { href: `/cuentas/${c.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "marca":
      return (
        <Modal titulo="Nueva marca" onClose={cerrarAlta}>
          <MarcaForm
            inicial={alta.cuentaId ? { cuenta_id: alta.cuentaId } : undefined}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const m = await crearMarca(v);
              hecho(`Marca «${m.nombre}» creada`, { href: `/marcas/${m.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "factura":
      return (
        <Modal titulo="Nueva factura" onClose={cerrarAlta} ancho="max-w-3xl">
          <FacturaForm
            cuentaInicial={alta.cuentaId}
            proyectosIniciales={alta.proyectoIds}
            onCancelar={cerrarAlta}
            onGuardada={(id, estado) =>
              hecho(estado === "borrador" ? "Borrador guardado" : "Factura creada", { href: `/finanzas/facturas/${id}`, texto: "Abrir" })
            }
          />
        </Modal>
      );
    case "cobro":
      return (
        <Modal titulo="Registrar cobro" onClose={cerrarAlta}>
          <CobroForm
            facturaId={alta.facturaId}
            onCancelar={cerrarAlta}
            onGuardado={(f) => hecho(`Cobro registrado en ${f.numero}`, { href: `/finanzas/facturas/${f.id}`, texto: "Ver factura" })}
          />
        </Modal>
      );
    case "gasto":
      return (
        <Modal titulo="Nuevo gasto" onClose={cerrarAlta}>
          <GastoForm
            inicial={alta.valores}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const g = await crearGasto(v);
              hecho(`Gasto de ${eur(g.importe)} registrado`, { href: "/finanzas/gastos", texto: "Ver gastos" });
            }}
          />
        </Modal>
      );
    case "documento":
      return (
        <Modal titulo={alta.categoria === "justificante" ? "Adjuntar justificante" : "Subir documento"} onClose={cerrarAlta}>
          <SubirDocumentoForm
            archivoInicial={alta.archivo}
            relacionInicial={alta.relacion ?? null}
            categoriaInicial={alta.categoria}
            relacionFija={alta.relacionFija}
            onCancelar={cerrarAlta}
            onGuardado={(d) => hecho(`«${d.nombre}» subido`, { href: `/documentos?ver=${d.id}`, texto: "Ver" })}
          />
        </Modal>
      );
    case "suscripcion":
      return (
        <Modal titulo="Nueva suscripción" onClose={cerrarAlta}>
          <SuscripcionForm
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const s = await crearSuscripcion(v);
              hecho(`Suscripción «${s.nombre}» creada`, { href: "/finanzas/suscripciones", texto: "Ver" });
            }}
          />
        </Modal>
      );
    case "evento":
      return (
        <Modal titulo="Nueva reunión o evento" onClose={cerrarAlta} ancho="max-w-lg">
          <EventoGenericoForm
            inicial={alta.valores}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              // Asignada a quien la crea: aparece en su Hoy y en su campana.
              await crearEvento({ ...v, usuario_id: usuarioActual?.id ?? null });
              hecho("Añadido al calendario", { href: "/calendario", texto: "Ver" });
            }}
          />
        </Modal>
      );
  }
}
