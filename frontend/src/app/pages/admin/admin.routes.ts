import { Route, Routes } from '@angular/router';
import { GRUPOS_FINANZAS, grupoDeSeccion } from './components/finanzas/grupos-finanzas';

const cargarFinanzas = () =>
  import('./components/finanzas/finanzas.component').then((m) => m.FinanzasComponent);
const cargarGestionUsuarios = () =>
  import('./components/usuarios-admin/usuarios-admin.component').then(
    (m) => m.UsuariosAdminComponent,
  );

const seccionesGestionUsuarios: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'padron' },
  {
    path: 'padron',
    title: 'Padrón de usuarios · Junta La Jones',
    loadComponent: () =>
      import('./components/usuarios-admin/padron/padron-usuarios.component').then(
        (m) => m.PadronUsuariosComponent,
      ),
  },
  {
    path: 'lotes',
    title: 'Catastro de lotes · Junta La Jones',
    loadComponent: () =>
      import('./components/usuarios-admin/catastro/catastro-lotes.component').then(
        (m) => m.CatastroLotesComponent,
      ),
  },
  { path: '**', redirectTo: 'padron' },
];

const seccionesGestionInterna: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auditoria' },
  {
    path: 'auditoria',
    title: 'Auditoría · Junta La Jones',
    loadComponent: () =>
      import('./components/gestion-admin/auditoria/auditoria.component').then(
        (m) => m.AuditoriaComponent,
      ),
  },
  {
    path: 'inventario',
    title: 'Inventario · Junta La Jones',
    loadComponent: () =>
      import('./components/gestion-admin/inventario/inventario.component').then(
        (m) => m.InventarioComponent,
      ),
  },
  {
    path: 'plan-anual',
    title: 'Plan anual · Junta La Jones',
    loadComponent: () =>
      import('./components/gestion-admin/plan-anual/plan-anual.component').then(
        (m) => m.PlanAnualComponent,
      ),
  },
  { path: '**', redirectTo: 'auditoria' },
];

/**
 * Cada sección de finanzas vive en un solo apartado (/admin/ajustes/facturacion). Una URL que la
 * pone en otro apartado (/admin/cobros/facturacion) o la nombra como antes (agua-anual) lleva a la
 * correcta, en lugar de caer en silencio en la primera sección de ese apartado.
 */
const redireccionesFinanzas: Routes = GRUPOS_FINANZAS.flatMap((grupo) => [
  ...GRUPOS_FINANZAS.filter((otro) => otro.id !== grupo.id).flatMap((otro) =>
    otro.secciones.map((seccion): Route => ({
      path: `${grupo.id}/${seccion.id}`,
      pathMatch: 'full',
      redirectTo: `${otro.id}/${seccion.id}`,
    })),
  ),
  { path: `${grupo.id}/agua-anual`, pathMatch: 'full', redirectTo: 'ajustes/facturacion' },
]);

const rutaGestionUsuarios = (path: string): Route => ({
  path,
  title: 'Gestión de Usuarios · Junta La Jones',
  loadComponent: cargarGestionUsuarios,
  children: seccionesGestionUsuarios,
});

/**
 * Secciones del panel administrativo. Los parámetros de ruta y de consulta llegan
 * como inputs de cada componente (withComponentInputBinding en app.config).
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Resumen general · Junta La Jones',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  rutaGestionUsuarios('usuarios'),
  {
    path: 'asistencias',
    loadComponent: () =>
      import('./components/asistencias-admin/asistencias-admin.component').then(
        (m) => m.AsistenciasAdminComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'asambleas' },
      {
        path: 'asambleas',
        title: 'Asambleas · Junta La Jones',
        loadComponent: () =>
          import('./components/asambleas-admin/asambleas-admin.component').then(
            (m) => m.AsambleasAdminComponent,
          ),
      },
      {
        path: 'mingas',
        title: 'Mingas · Junta La Jones',
        loadComponent: () =>
          import('./components/mingas-admin/mingas-admin.component').then(
            (m) => m.MingasAdminComponent,
          ),
      },
      { path: '**', redirectTo: 'asambleas' },
    ],
  },
  {
    path: 'turnos',
    title: 'Turnos de agua · Junta La Jones',
    loadComponent: () =>
      import('./components/turnos-admin/turnos-admin.component').then(
        (m) => m.TurnosAdminComponent,
      ),
  },
  {
    path: 'gestion',
    title: 'Gestión interna · Junta La Jones',
    loadComponent: () =>
      import('./components/gestion-admin/gestion-admin.component').then(
        (m) => m.GestionAdminComponent,
      ),
    children: seccionesGestionInterna,
  },
  {
    path: 'noticias',
    title: 'Noticias · Junta La Jones',
    loadComponent: () =>
      import('./components/noticias-admin/noticias-admin.component').then(
        (m) => m.NoticiasAdminComponent,
      ),
  },
  // Finanzas se divide en tres apartados del menú; cada uno usa el mismo componente con su grupo.
  ...redireccionesFinanzas,
  { path: 'cobros', pathMatch: 'full', redirectTo: 'cobros/cobrar' },
  {
    path: 'cobros/:seccion',
    title: 'Cobros y pagos · Junta La Jones',
    data: { grupo: 'cobros' },
    loadComponent: cargarFinanzas,
  },
  { path: 'ajustes', pathMatch: 'full', redirectTo: 'ajustes/tarifas' },
  {
    path: 'ajustes/:seccion',
    title: 'Tarifas y pago anual · Junta La Jones',
    data: { grupo: 'ajustes' },
    loadComponent: cargarFinanzas,
  },
  { path: 'historial', pathMatch: 'full', redirectTo: 'historial/pagos' },
  {
    path: 'historial/:seccion',
    title: 'Historial financiero · Junta La Jones',
    data: { grupo: 'historial' },
    loadComponent: cargarFinanzas,
  },
  // Enlaces antiguos (/admin/finanzas/egresos) llevan a su nuevo apartado conservando ?nuevo=…
  { path: 'finanzas', pathMatch: 'full', redirectTo: 'cobros/cobrar' },
  {
    path: 'finanzas/:seccion',
    redirectTo: ({ params }) =>
      `/admin/${grupoDeSeccion(params['seccion']).id}/${params['seccion']}`,
  },
  { path: '**', redirectTo: 'dashboard' },
];
