import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ModalA11yDirective } from '../../../../core/directives/modal-a11y.directive';
import { NotificationService } from '../../../../core/services/notification.service';
import { DialogService } from '../../../../core/services/dialog.service';
import * as L from 'leaflet';


@Component({
  selector: 'app-comuneros-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalA11yDirective],
  templateUrl: './comuneros-admin.component.html',
  styleUrls: []
})
export class ComunerosAdminComponent implements OnInit {
  modalMapaLoteVisible: boolean = false;
  loteSeleccionadoMapa: any = null;

  abrirGoogleMaps(lat: any, lng: any) {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}&t=k`, '_blank');
    }
  }

  cerrarModalMapa() {
    this.modalMapaLoteVisible = false;
    this.loteSeleccionadoMapa = null;
  }

  verMapaLote(lote: any) {
    this.loteSeleccionadoMapa = lote;
    this.modalMapaLoteVisible = true;
  }

  actualizarCoordenadasLote(event: any) {
    if (this.formLote) {
      this.formLote.latitud_aproximada = event.lat;
      this.formLote.longitud_aproximada = event.lng;
    }
  }

  @Output() comunerosChanged = new EventEmitter<void>();

// --- VISTA 1: NÓMINA & LOTES ---
  subTabUsuarios: 'COMUNEROS' | 'LOTES' = 'COMUNEROS';

  // COMUNEROS
  usuarios: any[] = [];
  usuariosPaginaActual: number = 1;
  usuariosTotalPaginas: number = 1;
  usuariosTotalRegistros: number = 0;
  usuariosBusqueda: string = '';
  usuariosEstadoFiltro: string = '';

  // Formulario de Comunero (Crear/Editar)
  modalUsuarioVisible: boolean = false;
  modoEdicionUsuario: boolean = false;

  // Modal Lotes del Comunero
  modalLotesComuneroVisible: boolean = false;
  comuneroSeleccionadoParaLotes: any = null;
  lotesDelComunero: any[] = [];

  formUsuario = {
    id: null as number | null,
    cedula: '',
    nombres: '',
    apellidos: '',
    direccion: '',
    telefono: '',
    celular: '',
    email: '',
    fecha_nacimiento: '',
    estado: 'ACTIVO',
    crearCuenta: false,
    rol_id: 2, // 2 = USUARIO por defecto (asumiendo que 1 es ADMIN)
    nuevaContrasena: ''
  };

  // LOTES
  lotes: any[] = [];
  sectores: any[] = [];
  lotesBusqueda: string = '';
  lotesSectorFiltro: number | null = null;

  // Formulario Lote
  modalLoteVisible: boolean = false;
  sugiriendoCodigoLote = false;
  guardandoLote = false;
  errorLote = '';
  private solicitudCodigoLote = 0;
  formLote = {
    sector_id: null as number | null,
    codigo: '',
    superficie_m2: null as number | null,
    latitud_aproximada: '',
    longitud_aproximada: '',
    radio_error_m: 5,
    referencia_ubicacion: '',
    observacion: ''
  };

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  
  private detalleMap: L.Map | null = null;
  private detalleMarker: L.Marker | null = null;

  // Asignar Lote
  modalVincularVisible: boolean = false;
  comuneroSeleccionadoParaLote: any = null;
  formVincular = {
    lote_id: null as number | null,
    tipo_relacion: 'PROPIETARIO',
    porcentaje: 100.00
  };

  // Detalle de Lote
  modalDetalleLoteVisible: boolean = false;
  loteSeleccionadoParaDetalle: any = null;

  

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private notify: NotificationService,
    private dialog: DialogService
  ) {}

  ngOnInit() {
    this.cargarUsuarios();
    this.cargarLotes();
    this.cargarSectores();
  }

  cargarSectores() {
    this.adminService.getSectores().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.sectores = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Error cargando sectores', err)
    });
  }

// --- LOGICA DE USUARIOS ---
  cargarUsuarios() {
    this.adminService.getPersonas(this.usuariosPaginaActual, 25, this.usuariosBusqueda, this.usuariosEstadoFiltro).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.usuarios = res.data;
          
          if (res.pagination) {
            this.usuariosTotalRegistros = res.pagination.total;
            this.usuariosTotalPaginas = Math.max(1, Math.ceil(res.pagination.total / res.pagination.limit));
          }
          this.cdr.detectChanges();
        }
      },
      error: () => this.notify.error('Error al cargar comuneros.')
    });
  }

  cambiarPaginaUsuarios(nuevaPagina: number) {
    if (nuevaPagina >= 1 && nuevaPagina <= this.usuariosTotalPaginas) {
      this.usuariosPaginaActual = nuevaPagina;
      this.cargarUsuarios();
    }
  }

  aplicarFiltroUsuarios() {
    this.usuariosPaginaActual = 1; // Reset a primera pagina
    this.cargarUsuarios();
  }

  abrirModalNuevoUsuario() {
    this.modoEdicionUsuario = false;
    this.formUsuario = {
      id: null,
      nombres: '',
      apellidos: '',
      cedula: '',
      direccion: '',
      telefono: '',
      celular: '',
      email: '',
      fecha_nacimiento: '',
      estado: 'ACTIVO',
      crearCuenta: true,
      rol_id: 2, // 2 = USUARIO (Comunero)
      nuevaContrasena: ''
    };
    this.modalUsuarioVisible = true;
  }

  abrirModalEditarUsuario(u: any) {
    this.modoEdicionUsuario = true;
    this.formUsuario = {
      id: u.id,
      nombres: u.nombres || '',
      apellidos: u.apellidos || '',
      cedula: u.cedula,
      direccion: u.direccion || '',
      telefono: u.telefono,
      celular: u.celular,
      email: u.email,
      fecha_nacimiento: u.fecha_nacimiento,
      estado: u.estado,
      crearCuenta: false,
      rol_id: 2,
      nuevaContrasena: ''
    };
    this.modalUsuarioVisible = true;
  }

  cerrarModalUsuario() {
    this.modalUsuarioVisible = false;
  }

  guardarUsuario() {
    if (!this.formUsuario.cedula || !this.formUsuario.nombres || !this.formUsuario.apellidos) {
      this.notify.warning('Cédula, Nombres y Apellidos son obligatorios.');
      return;
    }

    if (this.modoEdicionUsuario && this.formUsuario.id) {
      this.adminService.updatePersona(this.formUsuario.id, this.formUsuario).subscribe({
        next: (res) => {
          this.notify.success('Comunero actualizado exitosamente.');
          this.cerrarModalUsuario();
          this.cargarUsuarios();
        },
        error: (err) => this.notify.error(err.error?.message || 'Error al actualizar comunero.')
      });
    } else {
      this.adminService.createPersona(this.formUsuario).subscribe({
        next: (res) => {
          this.notify.success('Comunero registrado exitosamente.');
          this.cerrarModalUsuario();
          this.cargarUsuarios();
        },
        error: (err) => this.notify.error(err.error?.message || 'Error al registrar comunero.')
      });
    }
  }

  // ============== LOTES ==============

  cambiarSubTabUsuarios(tab: 'COMUNEROS' | 'LOTES') {
    this.subTabUsuarios = tab;
    if (tab === 'LOTES') {
      this.cargarLotes();
    }
  }

  cargarLotes() {
    this.adminService.getLotes(this.lotesSectorFiltro || undefined, this.lotesBusqueda).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.lotes = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Error cargando lotes', err)
    });
  }

  aplicarFiltroLotes() {
    this.cargarLotes();
  }

  
  

  abrirModalNuevoLote() {
    this.solicitudCodigoLote++;
    this.errorLote = '';
    this.sugiriendoCodigoLote = false;
    this.formLote = { sector_id: null, codigo: '', superficie_m2: null, latitud_aproximada: '', longitud_aproximada: '', radio_error_m: 5, referencia_ubicacion: '', observacion: '' };
    this.modalLoteVisible = true;
    setTimeout(() => {
      this.initMap();
    }, 200);
  }

  cerrarModalLote() {
    if (this.guardandoLote) return;
    this.solicitudCodigoLote++;
    this.sugiriendoCodigoLote = false;
    this.modalLoteVisible = false;
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }

  private initMap() {
    const mapElement = document.getElementById('loteMap');
    if (!mapElement) return;

    // Centro aproximado en Patate, Tungurahua
    this.map = L.map('loteMap').setView([-1.3121, -78.5085], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      this.formLote.latitud_aproximada = lat.toFixed(6);
      this.formLote.longitud_aproximada = lng.toFixed(6);

      if (this.marker) {
        this.marker.setLatLng(e.latlng);
      } else {
        this.marker = L.marker(e.latlng).addTo(this.map!);
      }
      this.cdr.detectChanges();
    });
  }

  cambiarSectorLote() {
    this.solicitudCodigoLote++;
    this.sugiriendoCodigoLote = false;
    this.errorLote = '';
  }

  normalizarCodigoLote(codigo: string) {
    this.formLote.codigo = codigo.trim().toUpperCase();
    this.errorLote = '';
  }

  sugerirCodigoLote() {
    if (!this.formLote.sector_id || this.sugiriendoCodigoLote || this.guardandoLote) return;
    const solicitud = ++this.solicitudCodigoLote;
    this.sugiriendoCodigoLote = true;
    this.errorLote = '';
    this.adminService.sugerirCodigoLote(this.formLote.sector_id).subscribe({
      next: res => {
        if (solicitud !== this.solicitudCodigoLote || !this.modalLoteVisible) return;
        this.formLote.codigo = res.data.codigo;
        this.sugiriendoCodigoLote = false;
        this.cdr.detectChanges();
      },
      error: err => {
        if (solicitud !== this.solicitudCodigoLote || !this.modalLoteVisible) return;
        this.errorLote = err.error?.message || 'No se pudo sugerir un código. Intente nuevamente.';
        this.sugiriendoCodigoLote = false;
        this.cdr.detectChanges();
      }
    });
  }

  guardarLote() {
    if (this.guardandoLote || this.sugiriendoCodigoLote) return;
    this.errorLote = '';
    if (!this.formLote.sector_id || !this.formLote.codigo) {
      this.errorLote = 'El sector y el código son obligatorios.';
      return;
    }
    this.formLote.codigo = this.formLote.codigo.trim().toUpperCase();
    if (!/^[A-Z]{3}-\d{3,8}$/.test(this.formLote.codigo)) {
      this.errorLote = 'Use tres letras y de tres a ocho dígitos, por ejemplo LJA-001.';
      return;
    }
    this.guardandoLote = true;
    this.adminService.createLote(this.formLote).subscribe({
      next: (res) => {
        this.guardandoLote = false;
        this.notify.success('Lote creado exitosamente.');
        this.cerrarModalLote();
        this.cargarLotes();
      },
      error: (err) => {
        this.guardandoLote = false;
        this.errorLote = err.error?.message || 'Error al crear lote.';
        this.cdr.detectChanges();
      }
    });
  }

  // ============== VINCULAR LOTE ==============

  abrirModalVincular(comunero: any) {
    this.comuneroSeleccionadoParaLote = comunero;
    this.formVincular = { lote_id: null, tipo_relacion: 'PROPIETARIO', porcentaje: 100.00 };
    this.adminService.getLotes().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.lotes = res.data; 
        }
        this.modalVincularVisible = true;
        this.cdr.detectChanges();
      },
      error: () => this.notify.error('Error al cargar lotes para vinculación.')
    });
  }

  cerrarModalVincular() {
    this.modalVincularVisible = false;
    this.comuneroSeleccionadoParaLote = null;
  }

  guardarVinculo() {
    if (!this.formVincular.lote_id) {
      this.notify.warning('Por favor selecciona un lote.');
      return;
    }
    const payload = {
      persona_id: this.comuneroSeleccionadoParaLote.id,
      tipo_relacion: this.formVincular.tipo_relacion,
      porcentaje: this.formVincular.porcentaje
    };

    this.adminService.vincularPersonaLote(this.formVincular.lote_id, payload).subscribe({
      next: (res) => {
        this.notify.success('Lote vinculado exitosamente.');
        this.cerrarModalVincular();
      },
      error: (err) => this.notify.error(err.error?.message || 'Error al vincular el lote.')
    });
  }

  // ============== LOTES DEL COMUNERO ==============
  abrirModalLotesComunero(comunero: any) {
    this.comuneroSeleccionadoParaLotes = comunero;
    this.lotesDelComunero = [];
    this.modalLotesComuneroVisible = true;

    this.adminService.getLotes(undefined, undefined, comunero.id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.lotesDelComunero = res.data;
        }
        this.cdr.detectChanges();
      },
      error: () => this.notify.error('Error al cargar los lotes del comunero.')
    });
  }

  cerrarModalLotesComunero() {
    this.modalLotesComuneroVisible = false;
    this.comuneroSeleccionadoParaLotes = null;
    this.lotesDelComunero = [];
  }

  // ============== DETALLE LOTE ==============
  
  abrirModalDetalleLote(lote: any) {
    this.loteSeleccionadoParaDetalle = { ...lote };
    
    // Convertir el string separado por comas en un arreglo para mostrarlo como lista
    this.loteSeleccionadoParaDetalle.propietariosList = lote.propietarios 
      ? lote.propietarios.split(', ') 
      : [];

    this.modalDetalleLoteVisible = true;
    
    // Si el lote tiene coordenadas, inicializamos el mapa
    if (lote.latitud_aproximada && lote.longitud_aproximada) {
      setTimeout(() => {
        this.initDetalleMap(parseFloat(lote.latitud_aproximada), parseFloat(lote.longitud_aproximada), lote.radio_error_m);
      }, 200);
    }
  }

  cerrarModalDetalleLote() {
    this.modalDetalleLoteVisible = false;
    this.loteSeleccionadoParaDetalle = null;
    if (this.detalleMap) {
      this.detalleMap.remove();
      this.detalleMap = null;
      this.detalleMarker = null;
    }
  }

  private initDetalleMap(lat: number, lng: number, errorRadius: number = 5) {
    const mapElement = document.getElementById('detalleMap');
    if (!mapElement) return;

    this.detalleMap = L.map('detalleMap').setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.detalleMap);

    this.detalleMarker = L.marker([lat, lng]).addTo(this.detalleMap);
    
    // Add a circle to represent the margin of error
    if (errorRadius > 0) {
      L.circle([lat, lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2,
        radius: errorRadius
      }).addTo(this.detalleMap);
    }
  }

  
}
