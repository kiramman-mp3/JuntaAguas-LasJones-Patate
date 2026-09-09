import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminComponent } from './pages/admin/admin.component';
import { EventosComponent } from './pages/eventos/eventos.component';
import { MiCuentaComponent } from './pages/mi-cuenta/mi-cuenta.component';

export const routes: Routes = [
  { path: '', component: InicioComponent },
  { path: 'eventos', component: EventosComponent },
  { path: 'mi-cuenta', component: MiCuentaComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' }
];
