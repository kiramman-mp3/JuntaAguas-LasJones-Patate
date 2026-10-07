import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { WhatsAppSesionService } from '../../core/services/whatsapp-sesion.service';
import { WhatsAppPanelComponent } from '../../shared/whatsapp-panel/whatsapp-panel.component';

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  corta: string;
  icono: string;
}

/**
 * Contenedor del panel administrativo: menú lateral (barra de pestañas inferior en móvil).
 * Cada sección es una ruta hija (/admin/dashboard, /admin/cobros/cobrar…), así que
 * el menú se navega con teclado, el botón Atrás funciona y cada vista tiene su URL.
 * Finanzas son tres apartados propios: Cobros y pagos, Ajustes e Historial.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WhatsAppPanelComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  readonly whatsapp = inject(WhatsAppSesionService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly menu: ItemMenu[] = [
    { ruta: '/admin/dashboard', etiqueta: 'Dashboard', corta: 'Inicio', icono: 'ri-dashboard-line' },
    { ruta: '/admin/comuneros', etiqueta: 'Comuneros y lotes', corta: 'Comuneros', icono: 'ri-team-line' },
    { ruta: '/admin/asistencias', etiqueta: 'Asistencias', corta: 'Eventos', icono: 'ri-calendar-check-line' },
    { ruta: '/admin/turnos', etiqueta: 'Turnos de agua', corta: 'Turnos', icono: 'ri-drop-line' }
  ];

  readonly menuFinanzas: ItemMenu[] = [
    { ruta: '/admin/cobros', etiqueta: 'Cobros y pagos', corta: 'Cobros', icono: 'ri-hand-coin-line' },
    { ruta: '/admin/ajustes', etiqueta: 'Ajustes', corta: 'Ajustes', icono: 'ri-settings-3-line' },
    { ruta: '/admin/historial', etiqueta: 'Historial', corta: 'Historial', icono: 'ri-history-line' }
  ];

  /** Panel de apartados financieros de la barra inferior (móvil). */
  readonly finanzasAbierto = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );
  readonly enFinanzas = computed(() => this.menuFinanzas.some((i) => this.url().startsWith(i.ruta)));

  @HostListener('document:mousedown', ['$event'])
  alTocarFuera(evento: MouseEvent): void {
    if (!this.finanzasAbierto()) return;
    const dentro = (evento.target as HTMLElement).closest('.tab-more');
    if (!dentro || !this.host.nativeElement.contains(dentro)) this.finanzasAbierto.set(false);
  }

  @HostListener('document:keydown.escape')
  alEscapar(): void {
    this.finanzasAbierto.set(false);
  }
}
