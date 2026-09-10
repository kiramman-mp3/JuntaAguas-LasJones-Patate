import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import * as L from 'leaflet';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Para solucionar problema de iconos de Leaflet en Angular
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

interface UsuarioAdmin {
  id: number;
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  loteId: number | null;
  superficie: number;
  latitud: number;
  longitud: number;
  radioError: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

interface EventoAdmin {
  id: number;
  tipo: 'ASAMBLEA' | 'MINGA';
  titulo: string;
  fecha: string;
  asistentes: number;
  totalComuneros: number;
  multaAbsencia: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  tabActiva: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS' = 'USUARIOS';
  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';
  subTabFinanzas: 'INGRESOS' | 'EGRESOS' = 'INGRESOS';
  modalMapaVisible: boolean = false;
  loteSeleccionadoMapa: UsuarioAdmin | null = null;
  
  // Asistencia
  modalAsistenciaVisible: boolean = false;
  eventoSeleccionado: EventoAdmin | null = null;
  usuariosAsistencia: any[] = [];
  filtroAsistencia: string = '';

  // KPIs Financieros
  kpis = {
    recaudadoMes: 0,
    pendientesCobro: 0,
    egresosMes: 0,
    balanceAlDia: 0
  };

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

  // Mocks de Eventos / Asistencias inicializados en vacío
  eventos: EventoAdmin[] = [];
  modalEventoVisible: boolean = false;
  formEvento = {
    tipo: 'ASAMBLEA',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '18:00',
    lugar: 'Casa Comunal Junta La Jones',
    genera_multa_ausencia: true,
    valor_multa: 10.00
  };

  // Turnos de agua
  turnos: any[] = [];
  modalTurnoVisible: boolean = false;
  nuevoTurno = {
    persona_id: null as number | null,
    dia_semana: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    tipo: 'REGULAR',
    observacion: ''
  };

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarSectores();
    this.cargarDatosBackend();
    this.cargarUsuarios();
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

  cargarDatosBackend() {
    // Cargar balance financiero en tiempo real desde la API
    this.adminService.getBalance().subscribe({
      next: (res) => {
        if (res && res.balance) {
          this.kpis.recaudadoMes = Number(res.balance.totalIngresos) || this.kpis.recaudadoMes;
          this.kpis.egresosMes = Number(res.balance.totalEgresos) || this.kpis.egresosMes;
          this.kpis.pendientesCobro = Number(res.balance.totalPendientes) || this.kpis.pendientesCobro;
          this.kpis.balanceAlDia = Number(res.balance.balanceAlDia) || this.kpis.balanceAlDia;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    // Cargar otros datos (eventos, turnos, etc.) que não están paginados
    this.adminService.getEventos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.eventos = res.data.map((e: any) => ({
            id: e.id,
            tipo: e.tipo,
            titulo: e.titulo,
            fecha: new Date(e.fecha).toLocaleDateString(),
            asistentes: Number(e.asistentes) || 0,
            totalComuneros: Number(e.totalComuneros) || 0,
            multaAbsencia: Number(e.valor_multa)
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    // Cargar turnos desde la API
    this.adminService.getTurnos().subscribe({
      next: (res) => {
        if (res && res.data) {
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          this.turnos = res.data.map((t: any) => ({
            lote: t.lote_codigo || 'N/A',
            usuario: t.comunero_nombre,
            dia: diasSemana[t.dia_semana] || 'Desconocido',
            horaInicio: t.hora_inicio,
            horaFin: t.hora_fin,
            sector: t.sector_nombre || 'N/A',
            observacion: t.observacion || 'Ninguna'
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cambiarTab(tab: 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS') {
    this.tabActiva = tab;
  }

  // --- LOGICA DE USUARIOS ---
  cargarUsuarios() {
    this.adminService.getPersonas(this.usuariosPaginaActual, 25, this.usuariosBusqueda, this.usuariosEstadoFiltro).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.usuarios = res.data;
          
          if (res.pagination) {
            this.usuariosTotalRegistros = res.pagination.total;
            this.usuariosTotalPaginas = Math.ceil(res.pagination.total / res.pagination.limit);
          }
          this.cdr.detectChanges();
        }
      },
      error: () => alert('Error al cargar comuneros.')
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
      rol_id: 3, // Default COMUNERO
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
      alert('Cédula, Nombres y Apellidos son obligatorios.');
      return;
    }

    if (this.modoEdicionUsuario && this.formUsuario.id) {
      this.adminService.updatePersona(this.formUsuario.id, this.formUsuario).subscribe({
        next: (res) => {
          alert('Comunero actualizado exitosamente.');
          this.cerrarModalUsuario();
          this.cargarUsuarios();
        },
        error: (err) => alert(err.error?.message || 'Error al actualizar comunero.')
      });
    } else {
      this.adminService.createPersona(this.formUsuario).subscribe({
        next: (res) => {
          alert('Comunero registrado exitosamente.');
          this.cerrarModalUsuario();
          this.cargarUsuarios();
        },
        error: (err) => alert(err.error?.message || 'Error al registrar comunero.')
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
    this.formLote = { sector_id: null, codigo: '', superficie_m2: null, latitud_aproximada: '', longitud_aproximada: '', radio_error_m: 5, referencia_ubicacion: '', observacion: '' };
    this.modalLoteVisible = true;
    setTimeout(() => {
      this.initMap();
    }, 200);
  }

  cerrarModalLote() {
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

  guardarLote() {
    if (!this.formLote.sector_id || !this.formLote.codigo) {
      alert('El sector y el código son obligatorios.');
      return;
    }
    this.adminService.createLote(this.formLote).subscribe({
      next: (res) => {
        alert('Lote creado exitosamente.');
        this.cerrarModalLote();
        this.cargarLotes();
      },
      error: (err) => alert(err.error?.message || 'Error al crear lote.')
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
      error: () => alert('Error al cargar lotes para vinculación.')
    });
  }

  cerrarModalVincular() {
    this.modalVincularVisible = false;
    this.comuneroSeleccionadoParaLote = null;
  }

  guardarVinculo() {
    if (!this.formVincular.lote_id) {
      alert('Por favor selecciona un lote.');
      return;
    }
    const payload = {
      persona_id: this.comuneroSeleccionadoParaLote.id,
      tipo_relacion: this.formVincular.tipo_relacion,
      porcentaje: this.formVincular.porcentaje
    };

    this.adminService.vincularPersonaLote(this.formVincular.lote_id, payload).subscribe({
      next: (res) => {
        alert('Lote vinculado exitosamente.');
        this.cerrarModalVincular();
      },
      error: (err) => alert(err.error?.message || 'Error al vincular el lote.')
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
      error: () => alert('Error al cargar los lotes del comunero.')
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

  // ============== EVENTOS ==============

  cambiarSubTabEventos(subTab: 'ASAMBLEA' | 'MINGA') {
    this.subTabEventos = subTab;
  }

  cambiarSubTabFinanzas(subTab: 'INGRESOS' | 'EGRESOS') {
    this.subTabFinanzas = subTab;
  }

  get eventosFiltrados() {
    return this.eventos.filter(e => e.tipo === this.subTabEventos);
  }

  verLoteEnMapa(u: UsuarioAdmin) {
    this.loteSeleccionadoMapa = u;
    this.modalMapaVisible = true;
  }

  cerrarModalMapa() {
    this.modalMapaVisible = false;
    this.loteSeleccionadoMapa = null;
  }

  abrirGoogleMaps(lat: number, lng: number) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  // Lógica Asistencia
  abrirModalAsistencia(evento: EventoAdmin) {
    this.eventoSeleccionado = evento;
    this.usuariosAsistencia = this.usuarios.map(u => ({
      id: u.id,
      nombres: u.nombres,
      cedula: u.cedula,
      presente: false
    }));
    this.modalAsistenciaVisible = true;
  }

  // Lógica de Crear Evento
  abrirModalNuevoEvento() {
    this.formEvento = {
      tipo: this.subTabEventos, // Se adapta al tab actual (ASAMBLEA o MINGA)
      titulo: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: '18:00',
      lugar: 'Casa Comunal Junta La Jones',
      genera_multa_ausencia: true,
      valor_multa: 10.00
    };
    this.modalEventoVisible = true;
  }

  cerrarModalEvento() {
    this.modalEventoVisible = false;
  }

  guardarEvento() {
    this.adminService.createEvento(this.formEvento).subscribe({
      next: (res) => {
        alert(`${this.formEvento.tipo === 'ASAMBLEA' ? 'Asamblea' : 'Minga'} creada exitosamente.`);
        this.cerrarModalEvento();
        // Si tuviéramos un cargarEventos real que actualice la lista this.eventos, lo llamaríamos aquí.
      },
      error: (err) => {
        alert(err.error?.message || 'Error al crear el evento');
      }
    });
  }

  generarReporteEventosPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Reporte de ${this.subTabEventos === 'ASAMBLEA' ? 'Asambleas' : 'Mingas'}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);
    
    const columns = ['Tipo', 'Título', 'Fecha', 'Multa ($)', 'Asistentes'];
    const rows = this.eventosFiltrados.map(e => [
      e.tipo,
      e.titulo,
      e.fecha,
      e.multaAbsencia.toFixed(2),
      `${e.asistentes} / ${e.totalComuneros}`
    ]);
    
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175] } // Var color-primary
    });
    
    doc.save(`reporte_${this.subTabEventos.toLowerCase()}_${new Date().getTime()}.pdf`);
  }

  cerrarModalAsistencia() {
    this.modalAsistenciaVisible = false;
    this.eventoSeleccionado = null;
  }

  marcarTodosAsistencia() {
    this.usuariosAsistencia.forEach(u => u.presente = true);
  }

  get usuariosAsistenciaFiltrados() {
    if (!this.filtroAsistencia) return this.usuariosAsistencia;
    const term = this.filtroAsistencia.toLowerCase();
    return this.usuariosAsistencia.filter(u => u.nombres.toLowerCase().includes(term) || u.cedula.includes(term));
  }

  guardarAsistencia() {
    if (!this.eventoSeleccionado) return;
    
    const payload = this.usuariosAsistencia.map(u => ({
      persona_id: u.id,
      estado: u.presente ? 'PRESENTE' : 'AUSENTE',
      motivo_justificacion: null
    }));

    this.adminService.registrarAsistencias(this.eventoSeleccionado.id, payload).subscribe({
      next: () => {
        alert(`Asistencia guardada con éxito en el backend. Presentes: ${payload.filter(p => p.estado === 'PRESENTE').length}`);
        this.cerrarModalAsistencia();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Hubo un error al guardar las asistencias.');
        console.error(err);
      }
    });
  }

  // Lógica Turnos
  abrirModalTurno() {
    this.nuevoTurno = { persona_id: null, dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00', tipo: 'REGULAR', observacion: '' };
    this.modalTurnoVisible = true;
  }

  cerrarModalTurno() {
    this.modalTurnoVisible = false;
  }

  guardarTurno() {
    if (!this.nuevoTurno.persona_id) {
      alert('Debe seleccionar un comunero.');
      return;
    }
    
    const comunero = this.usuarios.find(u => Number(u.id) === Number(this.nuevoTurno.persona_id));
    if (!comunero || !comunero.loteId) {
      alert('El comunero seleccionado no tiene un lote asociado.');
      return;
    }

    const payload = {
      ...this.nuevoTurno,
      lote_id: comunero.loteId
    };

    this.adminService.asignarTurno(payload).subscribe({
      next: () => {
        alert('Turno de agua asignado con éxito.');
        this.cerrarModalTurno();
        // Recargar turnos
        this.adminService.getTurnos().subscribe(res => {
          if (res && res.data) {
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            this.turnos = res.data.map((t: any) => ({
              lote: t.lote_codigo || 'N/A',
              usuario: t.comunero_nombre,
              dia: diasSemana[t.dia_semana] || 'Desconocido',
              horaInicio: t.hora_inicio,
              horaFin: t.hora_fin,
              sector: t.sector_nombre || 'N/A'
            }));
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        alert(err.error?.message || 'Error al asignar el turno.');
      }
    });
  }

  // Lógica Finanzas
  comuneroBusqueda: string = '';
  obligacionesComunero: any[] = [];
  obligacionSeleccionada: any = null;

  buscarObligaciones() {
    if (!this.comuneroBusqueda) {
      this.obligacionesComunero = [];
      return;
    }
    const term = this.comuneroBusqueda.toLowerCase();
    const comunero = this.usuarios.find(u => u.cedula === term || u.nombres.toLowerCase().includes(term));
    if (comunero) {
      this.adminService.getObligaciones(comunero.id).subscribe({
        next: (res) => {
          this.obligacionesComunero = res.data.filter((o: any) => o.estado === 'PENDIENTE');
          if (this.obligacionesComunero.length > 0) {
            this.obligacionSeleccionada = this.obligacionesComunero[0]; // Selecciona la primera por defecto
          }
          this.cdr.detectChanges();
        },
        error: () => alert('Error al buscar obligaciones.')
      });
    } else {
      alert('Comunero no encontrado.');
      this.obligacionesComunero = [];
      this.cdr.detectChanges();
    }
  }

  cobrarObligacion() {
    if (!this.obligacionSeleccionada) return;
    
    // Regla de Negocio: Se cobra la totalidad del valor. No se permiten abonos.
    const payload = {
      persona_id: this.obligacionSeleccionada.persona_id,
      metodo: 'EFECTIVO',
      obligacionesIds: [this.obligacionSeleccionada.id],
      observaciones: 'Pago completo procesado desde panel administrativo.'
    };

    this.adminService.registrarPago(payload).subscribe({
      next: () => {
        alert('Pago registrado exitosamente.');
        this.cargarDatosBackend(); // Recargar balance
        this.buscarObligaciones(); // Recargar lista del usuario
      },
      error: (err) => alert(err.error?.message || 'Error al procesar pago.')
    });
  }
}
