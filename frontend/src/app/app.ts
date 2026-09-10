import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'Junta de Agua La Jones';

  constructor(public authService: AuthService, private router: Router) {}

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
