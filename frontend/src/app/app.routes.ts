import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio.component';
import { ConsultaComponent } from './pages/consulta/consulta.component';
import { LoginComponent } from './pages/login/login.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
  { path: '', component: InicioComponent },
  { path: 'consulta', component: ConsultaComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' }
];
