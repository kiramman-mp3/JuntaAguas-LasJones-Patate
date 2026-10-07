/**
 * Carga diferida de jsPDF y jspdf-autotable (unos 400 kB). Se descargan la primera vez
 * que se genera un PDF y la promesa se reutiliza; si la carga falla, el siguiente intento la repite.
 */
type ModulosJsPdf = {
  jsPDF: typeof import('jspdf').jsPDF;
  autoTable: typeof import('jspdf-autotable').default;
};

let carga: Promise<ModulosJsPdf> | null = null;

export function cargarJsPdf(): Promise<ModulosJsPdf> {
  carga ??= Promise.all([import('jspdf'), import('jspdf-autotable')])
    .then(([{ jsPDF }, { default: autoTable }]) => ({ jsPDF, autoTable }))
    .catch((error) => {
      carga = null;
      throw error;
    });
  return carga;
}
