import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio.component';
import { LoginComponent } from './pages/login/login.component';
import { EventosComponent } from './pages/eventos/eventos.component';
import { NoEncontradoComponent } from './pages/no-encontrado/no-encontrado.component';
import { authGuard } from './core/guards/auth.guard';
import { ROLES } from './core/auth/session';

export const routes: Routes = [
  { path: '', component: InicioComponent },
  { path: 'eventos', component: EventosComponent },
  {
    path: 'noticias',
    title: 'Noticias · Junta La Jones',
    loadComponent: () =>
      import('./pages/noticias/noticias.component').then((m) => m.NoticiasComponent),
  },
  // "todas" va antes de ":id" para que no se lea como el identificador de una noticia.
  {
    path: 'noticias/todas',
    title: 'Todas las noticias · Junta La Jones',
    loadComponent: () =>
      import('./pages/noticias/noticias-archivo.component').then((m) => m.NoticiasArchivoComponent),
  },
  {
    path: 'noticias/:id',
    title: 'Noticia · Junta La Jones',
    loadComponent: () =>
      import('./pages/noticias/noticia-detalle.component').then((m) => m.NoticiaDetalleComponent),
  },
  {
    path: 'informacion',
    loadComponent: () =>
      import('./pages/informacion/informacion.component').then((m) => m.InformacionComponent),
  },
  {
    path: 'mi-cuenta',
    loadComponent: () =>
      import('./pages/mi-cuenta/mi-cuenta.component').then((m) => m.MiCuentaComponent),
    canActivate: [authGuard],
  },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    data: { roles: [ROLES.ADMIN] },
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', component: NoEncontradoComponent },
];
