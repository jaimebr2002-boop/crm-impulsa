// Supabase (PostgREST) devuelve como máximo 1000 filas por petición. Para
// listas que pueden superar ese tamaño se piden páginas consecutivas hasta
// que una llega incompleta.
const TAM_PAGINA = 1000;

type RespuestaPagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function traerTodo<T>(pedirPagina: (desde: number, hasta: number) => RespuestaPagina<T>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await pedirPagina(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA) return filas;
  }
}

/** Limpia un término de búsqueda para usarlo dentro de un filtro `or()` de
 * PostgREST: las comas y paréntesis romperían la sintaxis, y `%`/`*` son
 * comodines de ILIKE que el usuario no pretende escribir. */
export function terminoBusquedaSeguro(termino: string): string {
  return termino
    .replace(/[,()*%\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
