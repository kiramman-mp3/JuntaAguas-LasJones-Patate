import { Routes } from '@angular/router';

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
  {
    path: 'comuneros',
    loadComponent: () => import('./components/comuneros-admin/comuneros-admin.component').then(m => m.ComunerosAdminComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'padron' },
      {
        path: 'padron',
        title: 'Padrón de comuneros · Junta La Jones',
        loadComponent: () => import('./components/comuneros-admin/padron/padron-comuneros.component').then(m => m.PadronComunerosComponent)
      },
      {
        path: 'lotes',
        title: 'Catastro de lotes · Junta La Jones',
        loadComponent: () => import('./components/comuneros-admin/catastro/catastro-lotes.component').then(m => m.CatastroLotesComponent)
      },
      { path: '**', redirectTo: 'padron' }
    ]
  },
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
  { path: 'finanzas', pathMatch: 'full', redirectTo: 'finanzas/cobrar' },
  {
    path: 'finanzas/:seccion',
    title: 'Finanzas · Junta La Jones',
    loadComponent: () => import('./components/finanzas/finanzas.component').then(m => m.FinanzasComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
