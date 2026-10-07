import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinanzasService } from '../../core/services/finanzas.service';

const CONCEPTO: Record<'ASAMBLEA' | 'MINGA', string> = { ASAMBLEA: 'MULTA_ASAMBLEA', MINGA: 'MULTA_MINGA' };

/**
 * Muestra la multa por inasistencia que aplicará el servidor: la tarifa vigente del concepto
 * MULTA_ASAMBLEA o MULTA_MINGA en Ajustes → Tarifas. No se escribe a mano en cada evento.
 */
@Component({
  selector: 'app-multa-configurada',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (cargando()) {
      <p class="multa-info"><span class="spinner spinner--sm" aria-hidden="true"></span> Consultando la multa configurada…</p>
    } @else if (valor() !== null) {
      <p class="multa-info" role="status">
        <i class="ri-price-tag-3-line" aria-hidden="true"></i>
        <span>Multa configurada: <strong class="money">\${{ valor()!.toFixed(2) }}</strong> por ausencia sin justificación.</span>
        <a routerLink="/admin/ajustes/tarifas" class="multa-info__link">Cambiar en Ajustes</a>
      </p>
    } @else {
      <p class="alert alert--warning" role="alert">
        <i class="ri-alert-line" aria-hidden="true"></i>
        <span>
          No hay una tarifa de multa {{ tipo() === 'ASAMBLEA' ? 'de asamblea' : 'de minga' }} configurada.
          Regístrela en <a routerLink="/admin/ajustes/tarifas">Ajustes → Tarifas</a> o desactive la multa.
        </span>
      </p>
    }
  `,
  styles: [
    `
      .multa-info {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0;
        font-size: 0.86rem;
        color: var(--text-muted);
      }
      .multa-info i {
        color: var(--color-primary);
      }
      .multa-info strong {
        color: var(--text-main);
      }
      .multa-info__link {
        margin-left: auto;
        font-weight: 600;
        color: var(--color-primary);
        text-decoration: none;
      }
      .alert a {
        color: inherit;
        font-weight: 700;
      }
    `
  ]
})
export class MultaConfiguradaComponent implements OnInit {
  private finanzas = inject(FinanzasService);

  readonly tipo = input.required<'ASAMBLEA' | 'MINGA'>();
  readonly cargando = signal(true);
  readonly valor = signal<number | null>(null);

  ngOnInit(): void {
    this.finanzas.getConceptos().subscribe({
      next: (res) => {
        const concepto = (res.data ?? []).find((c) => c.codigo === CONCEPTO[this.tipo()]);
        const valor = Number(concepto?.tarifa_actual);
        this.valor.set(concepto?.tarifa_actual != null && valor > 0 ? valor : null);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }
}
