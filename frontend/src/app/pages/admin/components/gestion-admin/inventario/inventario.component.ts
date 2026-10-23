import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BienInventario,
  EstadoFisico,
  GestionService,
  NuevoBien,
} from '../../../../../core/services/gestion.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { mensajeError } from '../../../../../core/utils/errores';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

const ESTADOS: { valor: EstadoFisico; etiqueta: string }[] = [
  { valor: 'NUEVO', etiqueta: 'Nuevo' },
  { valor: 'BUENO', etiqueta: 'Bueno' },
  { valor: 'REGULAR', etiqueta: 'Regular' },
  { valor: 'MALO', etiqueta: 'Malo' },
  { valor: 'DADO_DE_BAJA', etiqueta: 'Dado de baja' },
];

const formularioVacio = (): NuevoBien => ({
  nombre: '',
  codigo: '',
  cantidad: 1,
  valor_unitario: 0,
  estado_fisico: 'BUENO',
  ubicacion: '',
  fecha_adquisicion: '',
  descripcion: '',
});

/** Inventario de bienes de la Junta (herramientas, equipos, materiales) con su valor total. */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, EmptyStateComponent, SkeletonComponent, ModalComponent],
  template: `
    <section class="fin-panel" aria-labelledby="inventario-titulo">
      <div class="fin-panel__head">
        <div>
          <h3 class="fin-panel__title" id="inventario-titulo">
            <i class="ri-archive-line" aria-hidden="true"></i> Inventario de bienes
          </h3>
          <p class="fin-panel__desc">
            {{ bienes().length }} {{ bienes().length === 1 ? 'bien' : 'bienes' }} · valor total
            <strong class="money">\${{ valorTotal().toFixed(2) }}</strong>
          </p>
        </div>
        <button type="button" class="btn btn--primary btn--sm pressable" (click)="abrir()">
          <i class="ri-add-line" aria-hidden="true"></i> Registrar bien
        </button>
      </div>

      @if (error()) {
        <app-empty-state
          tono="error"
          icono="ri-wifi-off-line"
          titulo="No se pudo cargar el inventario"
          [mensaje]="error()"
        >
          <button type="button" class="btn btn--outline btn--sm" (click)="cargar()">
            Reintentar
          </button>
        </app-empty-state>
      } @else if (cargando() && !bienes().length) {
        <app-skeleton [filas]="5" mensaje="Cargando inventario…" />
      } @else if (!bienes().length) {
        <app-empty-state
          icono="ri-archive-line"
          titulo="Inventario vacío"
          mensaje="Registre las herramientas y equipos de la Junta."
        />
      } @else {
        <div class="table-scroll">
          <table class="fin-table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Bien</th>
                <th scope="col" class="num">Cantidad</th>
                <th scope="col" class="num">Valor unitario</th>
                <th scope="col" class="num">Total</th>
                <th scope="col">Estado</th>
                <th scope="col">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              @for (b of bienes(); track b.id) {
                <tr>
                  <td class="money">{{ b.codigo || '—' }}</td>
                  <td>
                    {{ b.nombre }}
                    @if (b.descripcion) {
                      <br /><span class="fin-table__muted">{{ b.descripcion }}</span>
                    }
                    @if (b.fecha_adquisicion) {
                      <br /><span class="fin-table__muted"
                        >Adquirido el {{ b.fecha_adquisicion | fechaLocal }}</span
                      >
                    }
                  </td>
                  <td class="num">{{ b.cantidad }}</td>
                  <td class="num">
                    <span class="money">\${{ b.valor_unitario.toFixed(2) }}</span>
                  </td>
                  <td class="num">
                    <span class="money">\${{ (b.cantidad * b.valor_unitario).toFixed(2) }}</span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [class.badge--success]="
                        b.estado_fisico === 'NUEVO' || b.estado_fisico === 'BUENO'
                      "
                      [class.badge--warning]="b.estado_fisico === 'REGULAR'"
                      [class.badge--danger]="
                        b.estado_fisico === 'MALO' || b.estado_fisico === 'DADO_DE_BAJA'
                      "
                      >{{ etiquetaEstado(b.estado_fisico) }}</span
                    >
                  </td>
                  <td>{{ b.ubicacion || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (formularioAbierto()) {
      <app-modal
        titulo="Registrar bien"
        icono="ri-archive-line"
        [bloqueado]="guardando()"
        (cerrar)="formularioAbierto.set(false)"
      >
        <form (ngSubmit)="guardar()">
          <div class="modal__body form-stack">
            <div class="grid-2">
              <div class="form-group">
                <label for="bien-nombre">Nombre *</label>
                <input
                  id="bien-nombre"
                  name="nombre"
                  class="input"
                  maxlength="150"
                  required
                  [(ngModel)]="form.nombre"
                />
              </div>
              <div class="form-group">
                <label for="bien-codigo">Código <span class="text-muted">(opcional)</span></label>
                <input
                  id="bien-codigo"
                  name="codigo"
                  class="input"
                  maxlength="50"
                  placeholder="INV-011"
                  [(ngModel)]="form.codigo"
                />
              </div>
              <div class="form-group">
                <label for="bien-cantidad">Cantidad *</label>
                <input
                  id="bien-cantidad"
                  name="cantidad"
                  class="input"
                  type="number"
                  min="1"
                  step="1"
                  [(ngModel)]="form.cantidad"
                />
              </div>
              <div class="form-group">
                <label for="bien-valor">Valor unitario ($) *</label>
                <input
                  id="bien-valor"
                  name="valor"
                  class="input"
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="form.valor_unitario"
                />
              </div>
              <div class="form-group">
                <label for="bien-estado">Estado físico *</label>
                <select
                  id="bien-estado"
                  name="estado"
                  class="input"
                  [(ngModel)]="form.estado_fisico"
                >
                  @for (e of estados; track e.valor) {
                    <option [ngValue]="e.valor">{{ e.etiqueta }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label for="bien-fecha">Fecha de adquisición</label>
                <input
                  id="bien-fecha"
                  name="fecha"
                  class="input"
                  type="date"
                  [max]="hoy"
                  [(ngModel)]="form.fecha_adquisicion"
                />
              </div>
            </div>
            <div class="form-group">
              <label for="bien-ubicacion">Ubicación</label>
              <input
                id="bien-ubicacion"
                name="ubicacion"
                class="input"
                maxlength="150"
                placeholder="Bodega de la casa comunal"
                [(ngModel)]="form.ubicacion"
              />
            </div>
            <div class="form-group">
              <label for="bien-descripcion">Descripción</label>
              <textarea
                id="bien-descripcion"
                name="descripcion"
                class="input"
                rows="2"
                [(ngModel)]="form.descripcion"
              ></textarea>
            </div>
          </div>
          <div class="modal__footer">
            <button
              type="button"
              class="btn btn--outline"
              [disabled]="guardando()"
              (click)="formularioAbierto.set(false)"
            >
              Cancelar
            </button>
            <button type="submit" class="btn btn--primary" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Registrar' }}
            </button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class InventarioComponent {
  private gestion = inject(GestionService);
  private notify = inject(NotificationService);

  readonly estados = ESTADOS;
  readonly hoy = hoyEnEcuador();
  readonly bienes = signal<BienInventario[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly formularioAbierto = signal(false);
  readonly guardando = signal(false);
  form: NuevoBien = formularioVacio();

  readonly valorTotal = computed(
    () =>
      Math.round(this.bienes().reduce((s, b) => s + b.cantidad * b.valor_unitario, 0) * 100) / 100,
  );

  constructor() {
    this.cargar();
  }

  etiquetaEstado(estado: EstadoFisico | null): string {
    return ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? '—';
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.gestion.getInventario().subscribe({
      next: (res) => {
        this.bienes.set(
          res.data.map((b) => ({
            ...b,
            cantidad: Number(b.cantidad),
            valor_unitario: Number(b.valor_unitario),
          })),
        );
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err, 'Revise su conexión e intente nuevamente.'));
      },
    });
  }

  abrir(): void {
    this.form = formularioVacio();
    this.formularioAbierto.set(true);
  }

  guardar(): void {
    const f = this.form;
    if (f.nombre.trim().length < 2) return this.notify.warning('Indique el nombre del bien.');
    if (!(Number(f.cantidad) >= 1)) return this.notify.warning('La cantidad debe ser al menos 1.');
    if (!(Number(f.valor_unitario) >= 0))
      return this.notify.warning('El valor unitario no puede ser negativo.');
    this.guardando.set(true);
    this.gestion
      .registrarBien({
        ...f,
        nombre: f.nombre.trim(),
        cantidad: Number(f.cantidad),
        valor_unitario: Number(f.valor_unitario),
      })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.formularioAbierto.set(false);
          this.notify.success(res.message || 'Bien registrado.');
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.notify.error(mensajeError(err, 'No se pudo registrar el bien.'));
        },
      });
  }
}
