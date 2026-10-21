import { Route, Routes } from '@angular/router';
import { grupoDeSeccion } from './components/finanzas/grupos-finanzas';

const cargarFinanzas = () => import('./components/finanzas/finanzas.component').then(m => m.FinanzasComponent);
const cargarGestionUsuarios = () => import('./components/usuarios-admin/usuarios-admin.component').then(m => m.UsuariosAdminComponent);

const seccionesGestionUsuarios: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'padron' },
  {
    path: 'padron',
    title: 'Padrón de usuarios · Junta La Jones',
    loadComponent: () => import('./components/usuarios-admin/padron/padron-usuarios.component').then(m => m.PadronUsuariosComponent)
  },
  {
    path: 'lotes',
    title: 'Catastro de lotes · Junta La Jones',
    loadComponent: () => import('./components/usuarios-admin/catastro/catastro-lotes.component').then(m => m.CatastroLotesComponent)
  },
  { path: '**', redirectTo: 'padron' }
];

const rutaGestionUsuarios = (path: string): Route => ({
  path,
  title: 'Gestión de Usuarios · Junta La Jones',
  loadComponent: cargarGestionUsuarios,
  children: seccionesGestionUsuarios
});

/**
 * Secciones del panel administrativo. Los parámetros de ruta y de consulta llegan
 * como inputs de cada componente (withComponentInputBinding en app.config).
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard · Junta La Jones',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  rutaGestionUsuarios('usuarios'),
  // Mantiene accesibles los enlaces guardados con la ruta anterior.
  rutaGestionUsuarios('comuneros'),
  {
    path: 'asistencias',
    loadComponent: () => import('./components/asistencias-admin/asistencias-admin.component').then(m => m.AsistenciasAdminComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'asambleas' },
      {
        path: 'asambleas',
        title: 'Asambleas · Junta La Jones',
        loadComponent: () => import('./components/asambleas-admin/asambleas-admin.component').then(m => m.AsambleasAdminComponent)
      },
      {
        path: 'mingas',
        title: 'Mingas · Junta La Jones',
        loadComponent: () => import('./components/mingas-admin/mingas-admin.component').then(m => m.MingasAdminComponent)
      },
      { path: '**', redirectTo: 'asambleas' }
    ]
  },
  {
    path: 'turnos',
    title: 'Turnos de agua · Junta La Jones',
    loadComponent: () => import('./components/turnos-admin/turnos-admin.component').then(m => m.TurnosAdminComponent)
  },
  // Finanzas se divide en tres apartados del menú; cada uno usa el mismo componente con su grupo.
  { path: 'cobros', pathMatch: 'full', redirectTo: 'cobros/cobrar' },
  {
    path: 'cobros/:seccion',
    title: 'Cobros y pagos · Junta La Jones',
    data: { grupo: 'cobros' },
    loadComponent: cargarFinanzas
  },
  { path: 'ajustes', pathMatch: 'full', redirectTo: 'ajustes/tarifas' },
  {
    path: 'ajustes/:seccion',
    title: 'Ajustes · Junta La Jones',
    data: { grupo: 'ajustes' },
    loadComponent: cargarFinanzas
  },
  { path: 'historial', pathMatch: 'full', redirectTo: 'historial/pagos' },
  {
    path: 'historial/:seccion',
    title: 'Historial · Junta La Jones',
    data: { grupo: 'historial' },
    loadComponent: cargarFinanzas
  },
  // Enlaces antiguos (/admin/finanzas/egresos) llevan a su nuevo apartado conservando ?nuevo=…
  { path: 'finanzas', pathMatch: 'full', redirectTo: 'cobros/cobrar' },
  { path: 'finanzas/:seccion', redirectTo: ({ params }) => `/admin/${grupoDeSeccion(params['seccion']).id}/${params['seccion']}` },
  { path: '**', redirectTo: 'dashboard' }
];
