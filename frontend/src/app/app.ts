import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/toast-container/toast-container.component';
import { DialogContainerComponent } from './shared/dialog-container/dialog-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, DialogContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'Junta de Agua La Jones';
  menuAbierto = false;

  constructor(
    public authService: AuthService,
    public router: Router,
    public themeService: ThemeService
  ) {}

  get esRutaAdmin(): boolean {
    return this.router.url.startsWith('/admin');
  }

  get temaOscuro(): boolean {
    return this.themeService.theme() === 'dark';
  }

  alternarTema() {
    this.themeService.toggle();
  }

  alternarMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu() {
    this.menuAbierto = false;
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
