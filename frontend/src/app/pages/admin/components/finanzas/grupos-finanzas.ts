export type SeccionFinanzas = 'cobrar' | 'pagos' | 'egresos' | 'historial' | 'facturacion' | 'tarifas';
export type GrupoFinanzas = 'cobros' | 'ajustes' | 'historial';

export interface Seccion {
  id: SeccionFinanzas;
  etiqueta: string;
  icono: string;
}

export interface GrupoSecciones {
  id: GrupoFinanzas;
  etiqueta: string;
  descripcion: string;
  icono: string;
  /** Muestra los indicadores de caja (no aportan en la configuración de tarifas). */
  indicadores: boolean;
  secciones: Seccion[];
}


/**
 * Tres apartados del menú lateral, cada uno con su URL (/admin/cobros/egresos):
 * Cobros y pagos (caja y egresos), Ajustes (tarifas y facturación mensual de agua)
 * e Historial (recibos e ingresos/egresos por año). `?nuevo=egreso` abre el formulario de egreso.
 */
export const GRUPOS_FINANZAS: GrupoSecciones[] = [
  {
    id: 'cobros', etiqueta: 'Cobros y pagos', icono: 'ri-hand-coin-line', indicadores: true,
    descripcion: 'Cobro en caja a los comuneros y registro de los egresos de la Junta.',
    secciones: [
      { id: 'cobrar', etiqueta: 'Cobrar', icono: 'ri-hand-coin-line' },
      { id: 'egresos', etiqueta: 'Egresos', icono: 'ri-shopping-bag-3-line' }
    ]
  },
  {
    id: 'ajustes', etiqueta: 'Ajustes', icono: 'ri-settings-3-line', indicadores: false,
    descripcion: 'Tarifas de agua, multas y demás conceptos, y emisión mensual de las cuotas de agua.',
    secciones: [
      { id: 'tarifas', etiqueta: 'Tarifas', icono: 'ri-price-tag-3-line' },
      { id: 'facturacion', etiqueta: 'Facturación', icono: 'ri-calendar-2-line' }
    ]
  },
  {
    id: 'historial', etiqueta: 'Historial', icono: 'ri-history-line', indicadores: true,
    descripcion: 'Todos los recibos de cobro y los ingresos y egresos de la Junta por año.',
    secciones: [
      { id: 'pagos', etiqueta: 'Recibos', icono: 'ri-file-list-3-line' },
      { id: 'historial', etiqueta: 'Ingresos y egresos', icono: 'ri-git-branch-line' }
    ]
  }
];

/** Apartado al que pertenece una sección (para redirigir las URL antiguas /admin/finanzas/…). */
export function grupoDeSeccion(seccion: string | undefined): GrupoSecciones {
  return GRUPOS_FINANZAS.find((g) => g.secciones.some((s) => s.id === seccion)) ?? GRUPOS_FINANZAS[0];
}
