import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio.component';
import { LoginComponent } from './pages/login/login.component';
import { EventosComponent } from './pages/eventos/eventos.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: InicioComponent },
  { path: 'eventos', component: EventosComponent },
  { 
    path: 'mi-cuenta', 
    loadComponent: () => import('./pages/mi-cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
    canActivate: [authGuard]
  },
  { path: 'login', component: LoginComponent },
  { 
    path: 'admin', 
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard],
    data: { roles: ['ADMIN', 'SECRETARIO'] }
  },
  { path: '**', redirectTo: '' }
];
