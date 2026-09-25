import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { ActasService } from '../../core/services/actas.service';
import { ConsultaService } from '../../core/services/consulta.service';
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
  subtipo_asamblea?: string;
  titulo: string;
  fecha: string;
  hora_inicio?: string;
  lugar?: string;
  estado?: string;
  asistentes: number;
  totalComuneros: number;
  multaAbsencia: number;
  convocatoria_firmada_url?: string;
  convocatoria_firmada_nombre?: string;
  acta_firmada_url?: string;
  acta_firmada_nombre?: string;
  lista_asistencia_url?: string;
  lista_asistencia_firmada_url?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  tabActiva: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS' = 'DASHBOARD';
  subTabEventos: 'ASAMBLEA' | 'MINGA' = 'ASAMBLEA';
  subTabFinanzas: 'INGRESOS' | 'HISTORIAL' | 'EGRESOS' = 'INGRESOS';
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
  resumenMensual: any[] = [];

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
  eventosBusqueda: string = '';
  eventosEstadoFiltro: string = '';
  modalEventoVisible: boolean = false;
  formEvento = {
    tipo: 'ASAMBLEA',
    subtipo_asamblea: 'ORDINARIA' as 'ORDINARIA' | 'EXTRAORDINARIA',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '18:00',
    lugar: 'Casa Comunal Junta La Jones',
    puntos_orden_dia: [] as string[],
    genera_multa_ausencia: true,
    valor_multa: 10.00
  };


  // Turnos de agua
  turnos: any[] = [];
  turnosBusqueda: string = '';
  turnosDiaFiltro: string = '';
  turnosTipoFiltro: string = '';
  vistaTurnosModo: 'TABLA' | 'CALENDARIO' = 'TABLA';
  modalTurnoVisible: boolean = false;
  modalEditarTurnoVisible: boolean = false;
  modalDetalleTurnoVisible: boolean = false;
  turnoSeleccionadoParaDetalle: any = null;
  turnoEnEdicion: any = null;
  lotesDisponiblesTurno: any[] = [];
  busquedaComuneroTurnoModal: string = '';
  usuariosTurnoModal: any[] = [];
  nuevoTurno = {
    persona_id: null as number | null,
    lote_id: null as number | null,
    dia_semana: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    tipo: 'REGULAR',
    costo: 5.00,
    observacion: ''
  };

  get usuariosTurnoModalFiltrados() {
    if (!this.busquedaComuneroTurnoModal.trim()) {
      return this.usuariosTurnoModal;
    }
    const term = this.busquedaComuneroTurnoModal.toLowerCase().trim();
    return this.usuariosTurnoModal.filter(u =>
      (u.nombres && u.nombres.toLowerCase().includes(term)) ||
      (u.apellidos && u.apellidos.toLowerCase().includes(term)) ||
      (u.cedula && u.cedula.toLowerCase().includes(term))
    );
  }

  get comuneroSeleccionadoTurno() {
    if (!this.nuevoTurno.persona_id) return null;
    return this.usuariosTurnoModal.find(u => Number(u.id) === Number(this.nuevoTurno.persona_id)) || null;
  }

  get turnosFiltrados() {
    let filtrados = this.turnos;

    if (this.turnosBusqueda.trim()) {
      const termino = this.turnosBusqueda.toLowerCase();
      filtrados = filtrados.filter(t =>
        t.usuario.toLowerCase().includes(termino) ||
        t.lote.toLowerCase().includes(termino) ||
        t.sector.toLowerCase().includes(termino)
      );
    }

    if (this.turnosDiaFiltro) {
      filtrados = filtrados.filter(t => t.dia === this.turnosDiaFiltro);
    }

    if (this.turnosTipoFiltro) {
      filtrados = filtrados.filter(t => t.tipo === this.turnosTipoFiltro);
    }

    return filtrados;
  }

  getTurnosPorDia(diaNum: number) {
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const diaNombre = diasNombres[diaNum];
    return this.turnosFiltrados.filter(t => Number(t.dia_semana) === diaNum || t.dia === diaNombre);
  }

  constructor(
    private adminService: AdminService,
    private consultaService: ConsultaService,
    private actasService: ActasService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarSectores();
    this.cargarDatosBackend();
    this.cargarUsuarios();
    this.cargarHistorialPagos();
    this.cargarHistorialEgresos();
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

  cargarEventos() {
    this.adminService.getEventos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.eventos = res.data.map((e: any) => ({
            id: e.id,
            tipo: e.tipo,
            titulo: e.titulo,
            subtipo_asamblea: e.subtipo_asamblea || 'ORDINARIA',
            fecha: e.fecha ? (typeof e.fecha === 'string' ? e.fecha.split('T')[0] : new Date(e.fecha).toISOString().split('T')[0]) : '',
            hora_inicio: e.hora_inicio,
            lugar: e.lugar,
            estado: e.estado,
            asistentes: Number(e.asistentes) || 0,
            totalComuneros: Number(e.totalComuneros) || 0,
            multaAbsencia: Number(e.valor_multa) || 0,
            convocatoria_firmada_url: e.convocatoria_firmada_url,
            convocatoria_firmada_nombre: e.convocatoria_firmada_nombre,
            acta_firmada_url: e.acta_firmada_url,
            acta_firmada_nombre: e.acta_firmada_nombre,
            lista_asistencia_url: e.lista_asistencia_url,
            lista_asistencia_firmada_url: e.lista_asistencia_firmada_url
          }));
          this.aplicarFiltroEventos();
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  descargarConvocatoriaPdfParaFirmar(e: any) {
    this.generarConvocatoriaPdf(e);
  }

  descargarActaPdfParaFirmar(e: any) {
    this.consultaService.getEventoDetalle(e.id).subscribe({
      next: (res) => {
        if (res.status === 'OK') {
          this.actasService.generarActaPDF(res.evento, res.puntos || [], res.asistenciaStats);
        }
      },
      error: () => alert('Error al cargar datos del acta.')
    });
  }

  subirDocumentoFirmado(e: any, tipo: 'CONVOCATORIA' | 'ACTA' | 'MINGA' | 'OTRO', fileInput: HTMLInputElement) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.consultaService.subirDocumentoEvento(e.id, tipo, file.name, base64).subscribe({
        next: (res) => {
          if (res.status === 'OK') {
            // Actualizar la URL en el objeto del evento inmediatamente (sin esperar recarga)
            const serverUrl = res.url ? `http://localhost:3000${res.url}` : null;
            if (serverUrl) {
              if (tipo === 'CONVOCATORIA') {
                e.convocatoria_firmada_url = serverUrl;
                e.convocatoria_firmada_nombre = file.name;
              } else if (tipo === 'ACTA') {
                e.acta_firmada_url = serverUrl;
                e.acta_firmada_nombre = file.name;
              } else {
                // MINGA u OTRO → lista de asistencia firmada
                e.lista_asistencia_firmada_url = serverUrl;
              }
              // Abrir el documento recién subido en una nueva pestaña
              window.open(serverUrl, '_blank');
            }
            // Limpiar el input de archivo para permitir volver a subir
            fileInput.value = '';
            this.cdr.detectChanges();
            this.cargarEventos();
          }
        },
        error: (err) => alert('Error al subir el documento firmado.')
      });
    };
    reader.readAsDataURL(file);
  }

  descargarDocumentoGuardado(url?: string, filename?: string) {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    window.open(fullUrl, '_blank');
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
        if (res && res.resumenMensual) {
          this.resumenMensual = res.resumenMensual;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    // Cargar otros datos (eventos, turnos, etc.) que não estão paginados
    this.cargarEventos();

    // Cargar turnos desde la API
    this.adminService.getTurnos().subscribe({
      next: (res) => {
        if (res && res.data) {
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          this.turnos = res.data.map((t: any) => ({
            id: t.id,
            lote: t.lote_codigo || 'N/A',
            usuario: t.comunero_nombre,
            dia: diasSemana[t.dia_semana] || 'Desconocido',
            dia_semana: t.dia_semana,
            horaInicio: t.hora_inicio,
            horaFin: t.hora_fin,
            sector: t.sector_nombre || 'N/A',
            tipo: t.tipo || 'REGULAR',
            observacion: t.observacion || ''
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cambiarTab(tab: 'DASHBOARD' | 'USUARIOS' | 'ASISTENCIAS' | 'TURNOS' | 'FINANZAS' | 'ACTAS') {
    this.tabActiva = tab;
    if (tab === 'DASHBOARD' || tab === 'FINANZAS') {
      this.cargarComunerosFinanzas();
      this.cargarHistorialPagos();
    }
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

  cambiarSubTabFinanzas(subTab: 'INGRESOS' | 'HISTORIAL' | 'EGRESOS') {
    this.subTabFinanzas = subTab;
    if (subTab === 'HISTORIAL') {
      this.cargarHistorialPagos();
    }
  }

  get eventosFiltrados() {
    let filtrados = this.eventos.filter(e => e.tipo === this.subTabEventos);
    
    // REQUERIMIENTO: Mostrar solo eventos próximos, no pasados
    filtrados = filtrados.filter(e => !this.esEventoPasado(e.fecha));

    if (this.eventosBusqueda.trim()) {
      const termino = this.eventosBusqueda.toLowerCase();
      filtrados = filtrados.filter(e => e.titulo.toLowerCase().includes(termino));
    }
    
    return filtrados;
  }

  aplicarFiltroEventos() {
    // La reactividad angular actualiza eventosFiltrados automáticamente,
    // pero podemos forzar detección de cambios si es necesario.
    this.cdr.detectChanges();
  }

  esEventoPasado(fechaStr: string): boolean {
    if (!fechaStr) return false;
    
    // Tratamos de parsear la fecha. En el backend se guarda como fecha o string ISO
    // Si viene en formato local (DD/MM/YYYY) hay que tener cuidado, 
    // pero this.eventos se mapeó como new Date(e.fecha).toLocaleDateString()
    // Es más seguro comparar con el objeto date o convertir a un formato estándar.
    // Como lo guardamos como local string, parsearlo puede ser complicado según el locale.
    // Vamos a parsear desde las partes asumiendo un formato estándar local o ISO.
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    // Intentar convertir la cadena de fecha local a un objeto Date
    // Si la cadena es "MM/DD/YYYY" o "DD/MM/YYYY" depende del locale del sistema.
    // La forma más segura en TS sin librerías: 
    const partes = fechaStr.split(/[\/\-]/);
    let fechaObj: Date;
    if (partes.length === 3) {
       // heurística simple: si el último tiene 4 digitos es año
       if (partes[2].length === 4) {
         // Puede ser DD/MM/YYYY o MM/DD/YYYY. Asumiremos que Date.parse o new Date de MM/DD/YYYY funciona en general
         // O mejor, construimos manualmente si sabemos que es DD/MM/YYYY (común en latam)
         const dia = parseInt(partes[0], 10);
         const mes = parseInt(partes[1], 10) - 1;
         const anio = parseInt(partes[2], 10);
         // Si dia > 12 definitivamente es DD/MM. Si es ambiguo, new Date(anio, mes, dia) usará el formato DD/MM
         // De hecho, toLocaleDateString() comúnmente en español es D/M/YYYY
         fechaObj = new Date(anio, mes, dia);
       } else {
         fechaObj = new Date(fechaStr);
       }
    } else {
      fechaObj = new Date(fechaStr);
    }
    
    fechaObj.setHours(0,0,0,0);
    return fechaObj < hoy;
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
    // Cargar TODOS los comuneros (limit alto) para la asistencia, no solo la página actual
    this.adminService.getPersonas(1, 9999, '', 'ACTIVO').subscribe({
      next: (res) => {
        if (res && res.data) {
          this.usuariosAsistencia = res.data.map((u: any) => ({
            id: u.id,
            nombres: `${u.apellidos} ${u.nombres}`,
            cedula: u.cedula,
            presente: false
          }));

          // Cargar asistencias previas guardadas en BD
          this.adminService.getAsistencias(evento.id).subscribe({
            next: (asistRes) => {
              if (asistRes && asistRes.data && asistRes.data.length > 0) {
                const presentes = new Set(
                  asistRes.data
                    .filter((a: any) => a.estado === 'PRESENTE')
                    .map((a: any) => a.persona_id)
                );
                this.usuariosAsistencia.forEach(u => {
                  if (presentes.has(u.id)) {
                    u.presente = true;
                  }
                });
              }
              this.modalAsistenciaVisible = true;
              this.cdr.detectChanges();
            },
            error: () => {
              // Si falla obtener asistencias previas, igual abrir el modal limpio
              this.modalAsistenciaVisible = true;
              this.cdr.detectChanges();
            }
          });
        }
      },
      error: () => alert('Error al cargar comuneros para asistencia.')
    });
  }

  // Lógica de Crear Evento
  abrirModalNuevoEvento() {
    this.formEvento = {
      tipo: this.subTabEventos, // Se adapta al tab actual (ASAMBLEA o MINGA)
      subtipo_asamblea: 'ORDINARIA',
      titulo: this.subTabEventos === 'ASAMBLEA' ? 'ASAMBLEA GENERAL DE USUARIOS' : 'MINGA COMUNITARIA',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: '18:00',
      lugar: 'Casa Comunal Junta La Jones',
      puntos_orden_dia: [
        'Constatación del cuórum',
        'Lectura del acta anterior',
        'Informe del Presidente y Tesorero',
        'Varios'
      ],
      genera_multa_ausencia: true,
      valor_multa: 10.00
    };
    this.modalEventoVisible = true;
  }

  cerrarModalEvento() {
    this.modalEventoVisible = false;
  }

  agregarPuntoOrdenDia() {
    if (!this.formEvento.puntos_orden_dia) {
      this.formEvento.puntos_orden_dia = [];
    }
    const len = this.formEvento.puntos_orden_dia.length;
    if (len > 0 && this.formEvento.puntos_orden_dia[len - 1].toLowerCase() === 'varios') {
      this.formEvento.puntos_orden_dia.splice(len - 1, 0, '');
    } else {
      this.formEvento.puntos_orden_dia.push('');
    }
  }

  eliminarPuntoOrdenDia(index: number) {
    if (this.formEvento.puntos_orden_dia && this.formEvento.puntos_orden_dia.length > 2) {
      this.formEvento.puntos_orden_dia.splice(index, 1);
    }
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }

  // --- WHATSAPP WEB MANAGEMENT ---
  modalWhatsAppVisible: boolean = false;
  whatsAppStatus: { status: string; statusMessage: string; isReady: boolean; qrCodeDataUrl: string } | null = null;
  cargandoWhatsApp: boolean = false;
  whatsAppPollInterval: any = null;

  abrirModalWhatsApp() {
    this.modalWhatsAppVisible = true;
    this.consultarEstadoWhatsApp();
    this.iniciarPollingWhatsApp();
  }

  cerrarModalWhatsApp() {
    this.modalWhatsAppVisible = false;
    this.detenerPollingWhatsApp();
  }

  iniciarPollingWhatsApp() {
    this.detenerPollingWhatsApp();
    this.consultarEstadoWhatsApp(true);
    this.whatsAppPollInterval = setInterval(() => {
      if (this.modalWhatsAppVisible) {
        this.consultarEstadoWhatsApp(true);
      } else {
        this.detenerPollingWhatsApp();
      }
    }, 1500);
  }


  detenerPollingWhatsApp() {
    if (this.whatsAppPollInterval) {
      clearInterval(this.whatsAppPollInterval);
      this.whatsAppPollInterval = null;
    }
  }

  consultarEstadoWhatsApp(silencioso: boolean = false) {
    if (!silencioso && !this.whatsAppStatus) {
      this.cargandoWhatsApp = true;
    }
    this.adminService.getWhatsAppStatus().subscribe({
      next: (res) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }

  reiniciarWhatsApp() {
    this.cargandoWhatsApp = true;
    this.adminService.initWhatsApp().subscribe({
      next: (res) => {
        this.whatsAppStatus = res.data;
        this.cargandoWhatsApp = false;
        this.consultarEstadoWhatsApp();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }

  cerrarSesionWhatsApp() {
    if (!confirm('¿Está seguro de cerrar la sesión de WhatsApp?')) return;
    this.cargandoWhatsApp = true;
    this.adminService.logoutWhatsApp().subscribe({
      next: () => {
        this.consultarEstadoWhatsApp();
      },
      error: () => {
        this.cargandoWhatsApp = false;
      }
    });
  }


  guardarEvento() {
    const esMinga = this.formEvento.tipo === 'MINGA';

    if (!esMinga && Array.isArray(this.formEvento.puntos_orden_dia)) {
      this.formEvento.descripcion = this.formEvento.puntos_orden_dia
        .filter((p: string) => p && p.trim())
        .map((p: string, idx: number) => `${idx + 1}. ${p.trim()}`)
        .join('\n');
    }

    this.adminService.createEvento(this.formEvento).subscribe({
      next: (res) => {
        const eventoId = res.eventoId;
        this.cerrarModalEvento();
        this.cargarEventos();

        if (esMinga) {
          // NO se genera PDF para Mingas. Se envía mensaje por whatsapp-web.js
          alert('Minga creada exitosamente. Enviando convocatoria por WhatsApp Web a los comuneros...');
          this.adminService.notificarMingaWhatsApp(eventoId).subscribe({
            next: (whRes) => {
              alert(whRes.message || 'Convocatoria a Minga enviada por WhatsApp exitosamente.');
            },
            error: (whErr) => {
              alert(whErr.error?.message || 'Minga registrada. Nota: Vincule la sesión de WhatsApp Web mediante el botón "WhatsApp Web" en el panel para envíos automáticos.');
            }
          });
        } else {
          // Para Asamblea se sigue generando el PDF oficial de convocatoria
          alert('Asamblea creada exitosamente. Descargando Convocatoria Oficial en PDF...');
          this.generarConvocatoriaPdf(this.formEvento);
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Error al crear el evento');
      }
    });
  }

  generarConvocatoriaPdf(evento: any) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado Oficial Centrado
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('JUNTA DE RIEGO LA JONES - PATATE', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(13);
    doc.text('CONVOCATORIA A ASAMBLEA GENERAL', pageWidth / 2, 28, { align: 'center' });

    const subtipo = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase();
    doc.setFontSize(11);
    doc.text(subtipo === 'ORDINARIA' ? 'ORDINARIA' : 'EXTRAORDINARIA', pageWidth / 2, 35, { align: 'center' });

    // Puntos del Orden del Día
    const puntos = Array.isArray(evento.puntos_orden_dia) && evento.puntos_orden_dia.length > 0
      ? evento.puntos_orden_dia.filter((p: string) => p && p.trim())
      : ['Constatación del cuórum', 'Lectura del acta anterior', 'Varios'];

    // Construir tabla exacta al formato oficial
    const tableBody: any[] = [
      [
        { content: 'Estimados usuarios, reciban un cordial saludo.', colSpan: 2, styles: { fontStyle: 'normal', cellPadding: 3 } }
      ],
      [
        { content: 'Convocatoria', styles: { fontStyle: 'normal' } },
        { content: 'Por orden del señor Presidente de la Junta, se convoca a Asamblea General de usuarios con el siguiente detalle:' }
      ],
      [
        { content: 'Lugar', styles: { fontStyle: 'normal' } },
        { content: evento.lugar || 'Casa Comunal Junta La Jones' }
      ],
      [
        { content: 'Fecha', styles: { fontStyle: 'normal' } },
        { content: evento.fecha }
      ],
      [
        { content: 'Hora', styles: { fontStyle: 'normal' } },
        { content: evento.hora_inicio }
      ],
      [
        { content: 'ORDEN DEL DÍA', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [217, 238, 216], textColor: [0, 0, 0] } }
      ]
    ];

    puntos.forEach((p: string, idx: number) => {
      tableBody.push([
        { content: `${idx + 1}.`, styles: { fontStyle: 'normal', halign: 'left' } },
        { content: p.trim() }
      ]);
    });

    autoTable(doc, {
      startY: 42,
      head: [['DETALLE', 'INFORMACIÓN']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [217, 238, 216],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 125 }
      },
      styles: {
        fontSize: 10,
        textColor: [0, 0, 0],
        lineColor: [50, 50, 50],
        lineWidth: 0.2
      },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 25 : 200;

    // Firma al pie
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Atentamente,', pageWidth / 2, finalY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('SECRETARIO/A', pageWidth / 2, finalY + 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text('Junta de Riego La Jones - Patate', pageWidth / 2, finalY + 32, { align: 'center' });

    doc.save(`Convocatoria_Asamblea_${subtipo}_${evento.fecha}.pdf`);
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
        const presentes = payload.filter(p => p.estado === 'PRESENTE').length;
        alert(`Asistencia guardada exitosamente. Presentes: ${presentes} de ${payload.length}`);
        this.cerrarModalAsistencia();
        this.cargarEventos(); // Actualizar conteo en la lista
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
    this.busquedaComuneroTurnoModal = '';
    this.nuevoTurno = {
      persona_id: null,
      lote_id: null,
      dia_semana: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      tipo: 'REGULAR',
      costo: 5.00,
      observacion: ''
    };
    this.lotesDisponiblesTurno = [];
    this.modalTurnoVisible = true;

    // Cargar la lista completa de comuneros para el panel de selección derecha
    this.adminService.getPersonas(1, 1000).subscribe({
      next: (res) => {
        this.usuariosTurnoModal = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar comuneros para modal de turno', err)
    });
  }

  seleccionarComuneroTurnoModal(u: any) {
    this.nuevoTurno.persona_id = u.id;
    this.cdr.detectChanges();
    this.onPersonaChangeInTurno();
  }

  onPersonaChangeInTurno() {
    this.nuevoTurno.lote_id = null;
    this.lotesDisponiblesTurno = [];
    this.cdr.detectChanges();

    if (!this.nuevoTurno.persona_id) return;

    this.adminService.getLotes(undefined, undefined, this.nuevoTurno.persona_id).subscribe({
      next: (res) => {
        this.lotesDisponiblesTurno = res.data || [];
        if (this.lotesDisponiblesTurno.length > 0) {
          this.nuevoTurno.lote_id = this.lotesDisponiblesTurno[0].id;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando lotes del comunero', err)
    });
  }

  cerrarModalTurno() {
    this.modalTurnoVisible = false;
  }

  cargarTurnos() {
    this.adminService.getTurnos().subscribe({
      next: (res) => {
        if (res && res.data) {
          const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          this.turnos = res.data.map((t: any) => ({
            id: t.id,
            lote: t.lote_codigo || 'N/A',
            lote_id: t.lote_id,
            persona_id: t.persona_id,
            usuario: t.comunero_nombre,
            dia: diasSemana[t.dia_semana] || 'Desconocido',
            dia_semana: t.dia_semana,
            horaInicio: t.hora_inicio,
            horaFin: t.hora_fin,
            sector: t.sector_nombre || 'N/A',
            tipo: t.tipo || 'REGULAR',
            observacion: t.observacion || ''
          }));
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  verDetalleTurno(turno: any) {
    this.turnoSeleccionadoParaDetalle = { ...turno };
    this.modalDetalleTurnoVisible = true;
  }

  cerrarModalDetalleTurno() {
    this.modalDetalleTurnoVisible = false;
    this.turnoSeleccionadoParaDetalle = null;
  }

  abrirModalEditarTurno(turno: any) {
    this.turnoEnEdicion = {
      id: turno.id,
      persona_id: turno.persona_id,
      lote_id: turno.lote_id,
      usuario: turno.usuario,
      lote: turno.lote,
      dia_semana: turno.dia_semana || 1,
      hora_inicio: turno.horaInicio || '08:00',
      hora_fin: turno.horaFin || '10:00',
      tipo: turno.tipo || 'REGULAR',
      observacion: turno.observacion || ''
    };
    this.modalEditarTurnoVisible = true;
  }

  cerrarModalEditarTurno() {
    this.modalEditarTurnoVisible = false;
    this.turnoEnEdicion = null;
  }

  guardarEdicionTurno() {
    if (!this.turnoEnEdicion) return;

    if (!this.turnoEnEdicion.dia_semana || !this.turnoEnEdicion.hora_inicio || !this.turnoEnEdicion.hora_fin) {
      alert('El día y las horas de inicio y fin son obligatorios.');
      return;
    }

    if (this.turnoEnEdicion.hora_inicio >= this.turnoEnEdicion.hora_fin) {
      alert('La hora de inicio debe ser menor a la hora de finalización.');
      return;
    }

    const payload = {
      persona_id: this.turnoEnEdicion.persona_id,
      lote_id: this.turnoEnEdicion.lote_id,
      dia_semana: this.turnoEnEdicion.dia_semana,
      hora_inicio: this.turnoEnEdicion.hora_inicio,
      hora_fin: this.turnoEnEdicion.hora_fin,
      tipo: this.turnoEnEdicion.tipo,
      observacion: this.turnoEnEdicion.observacion
    };

    this.adminService.actualizarTurno(this.turnoEnEdicion.id, payload).subscribe({
      next: (res: any) => {
        alert(res.message || 'Turno actualizado correctamente.');
        this.cerrarModalEditarTurno();
        this.cargarTurnos();
      },
      error: (err: any) => alert(err.error?.message || 'Error al actualizar el turno.')
    });
  }

  eliminarTurno(turno: any) {
    if (confirm(`¿Está seguro de eliminar el turno asignado a "${turno.usuario}" (${turno.dia} ${turno.horaInicio} - ${turno.horaFin})?`)) {
      this.adminService.eliminarTurno(turno.id).subscribe({
        next: (res: any) => {
          alert(res.message || 'Turno eliminado con éxito.');
          this.cargarTurnos();
        },
        error: (err: any) => alert(err.error?.message || 'Error al eliminar el turno.')
      });
    }
  }

  guardarTurno() {
    if (!this.nuevoTurno.persona_id) {
      alert('Debe seleccionar un comunero.');
      return;
    }
    
    if (!this.nuevoTurno.lote_id) {
      alert('Debe seleccionar un lote para asignar el turno.');
      return;
    }

    if (!this.nuevoTurno.hora_inicio || !this.nuevoTurno.hora_fin) {
      alert('Debe especificar las horas de inicio y fin.');
      return;
    }

    if (this.nuevoTurno.hora_inicio >= this.nuevoTurno.hora_fin) {
      alert('La hora de inicio debe ser menor a la hora de finalización.');
      return;
    }

    this.adminService.asignarTurno(this.nuevoTurno).subscribe({
      next: (res: any) => {
        alert(res.message || 'Turno de agua asignado con éxito.');
        this.cerrarModalTurno();
        this.cargarTurnos();
      },
      error: (err) => {
        alert(err.error?.message || 'Error al asignar el turno.');
      }
    });
  }

  // Lógica Finanzas
  Number = Number;
  modalCobroVisible: boolean = false;
  todosLosComunerosFinanzas: any[] = [];
  comuneroFiltroFinanzas: string = '';
  comuneroSeleccionadoFinanzas: any = null;
  obligacionesComunero: any[] = [];
  obligacionesSeleccionadasIds: number[] = [];
  valorRecibidoFinanzas: number | null = null;
  comprobanteModalVisible: boolean = false;
  comprobanteActual: any = null;
  historialPagos: any[] = [];
  historialFiltroBusqueda: string = '';

  // Lógica de Egresos
  modalEgresoVisible: boolean = false;
  historialEgresos: any[] = [];
  historialEgresosFiltroBusqueda: string = '';
  nuevoEgreso: any = {
    fecha: new Date().toISOString().substring(0, 10),
    concepto: '',
    proveedor: '',
    ruc: '',
    numero_factura: '',
    valor: null,
    descripcion: ''
  };

  formatValor(val: any): string {
    return Number(val || 0).toFixed(2);
  }

  formatReciboNo(id: any): string {
    return `REC-${String(id || 0).padStart(6, '0')}`;
  }

  formatEgresoNo(id: any): string {
    return `EGR-${String(id || 0).padStart(6, '0')}`;
  }

  prepararNuevoCobro() {
    this.cambiarTab('FINANZAS');
    this.cambiarSubTabFinanzas('INGRESOS');
    this.comuneroFiltroFinanzas = '';
    this.comuneroSeleccionadoFinanzas = null;
    this.obligacionesComunero = [];
    this.pagosComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;
    this.cargarComunerosFinanzas();
  }

  cerrarModalCobro() {
    this.comuneroSeleccionadoFinanzas = null;
  }

  abrirModalEgreso() {
    this.modalEgresoVisible = true;
    this.nuevoEgreso = {
      fecha: new Date().toISOString().substring(0, 10),
      concepto: '',
      proveedor: '',
      ruc: '',
      numero_factura: '',
      valor: null,
      descripcion: ''
    };
    this.cdr.detectChanges();
  }

  cerrarModalEgreso() {
    this.modalEgresoVisible = false;
    this.cdr.detectChanges();
  }

  cargarComunerosFinanzas() {
    this.adminService.getPersonas(1, 1000).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.todosLosComunerosFinanzas = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cargarHistorialPagos() {
    this.adminService.getPagos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.historialPagos = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cargarHistorialEgresos() {
    this.adminService.getEgresos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.historialEgresos = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  get historialEgresosFiltrado(): any[] {
    if (!this.historialEgresosFiltroBusqueda.trim()) {
      return this.historialEgresos;
    }
    const term = this.historialEgresosFiltroBusqueda.toLowerCase();
    return this.historialEgresos.filter(e =>
      (e.concepto && e.concepto.toLowerCase().includes(term)) ||
      (e.proveedor_nombre && e.proveedor_nombre.toLowerCase().includes(term)) ||
      (e.numero_factura && e.numero_factura.toLowerCase().includes(term)) ||
      (e.registrado_por_usuario && e.registrado_por_usuario.toLowerCase().includes(term)) ||
      (e.id && `egr-${e.id}`.toLowerCase().includes(term))
    );
  }

  guardarEgreso() {
    if (!this.nuevoEgreso.concepto || !this.nuevoEgreso.concepto.trim()) {
      alert('Por favor ingresa el concepto o motivo del egreso.');
      return;
    }
    if (!this.nuevoEgreso.valor || Number(this.nuevoEgreso.valor) <= 0) {
      alert('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    const payload = {
      fecha: this.nuevoEgreso.fecha || new Date().toISOString().substring(0, 10),
      concepto: this.nuevoEgreso.concepto.trim(),
      descripcion: this.nuevoEgreso.descripcion ? this.nuevoEgreso.descripcion.trim() : null,
      numero_factura: this.nuevoEgreso.numero_factura ? this.nuevoEgreso.numero_factura.trim() : null,
      valor: Number(this.nuevoEgreso.valor)
    };

    this.adminService.registrarEgreso(payload).subscribe({
      next: (res: any) => {
        this.modalEgresoVisible = false;
        this.cdr.detectChanges();
        this.cargarHistorialEgresos();
        this.cargarDatosBackend();
        alert(res.message || 'Egreso registrado exitosamente.');
      },
      error: (err) => alert(err.error?.message || 'Error al registrar el egreso.')
    });
  }

  get comunerosFiltradosFinanzas(): any[] {
    const lista = this.todosLosComunerosFinanzas.length > 0 ? this.todosLosComunerosFinanzas : this.usuarios;
    if (!this.comuneroFiltroFinanzas.trim()) {
      return lista;
    }
    const term = this.comuneroFiltroFinanzas.toLowerCase();
    return lista.filter(u =>
      (u.nombres && u.nombres.toLowerCase().includes(term)) ||
      (u.cedula && u.cedula.toLowerCase().includes(term))
    );
  }

  get historialPagosFiltrado(): any[] {
    if (!this.historialFiltroBusqueda.trim()) {
      return this.historialPagos;
    }
    const term = this.historialFiltroBusqueda.toLowerCase();
    return this.historialPagos.filter(p =>
      (p.comunero_nombre && p.comunero_nombre.toLowerCase().includes(term)) ||
      (p.cedula && p.cedula.toLowerCase().includes(term)) ||
      (p.id && `rec-${p.id}`.toLowerCase().includes(term)) ||
      (p.registrado_por_usuario && p.registrado_por_usuario.toLowerCase().includes(term))
    );
  }

  anularPagoDesdeHistorial(pago: any) {
    if (pago.observacion && pago.observacion.includes('[ANULADO:')) {
      alert('Este pago ya se encuentra anulado.');
      return;
    }

    const motivo = prompt(`Ingresa el motivo de anulación para el pago No. REC-${String(pago.id).padStart(6, '0')}:`);
    if (!motivo || !motivo.trim()) return;

    this.adminService.anularPago(pago.id, motivo.trim()).subscribe({
      next: (res: any) => {
        alert(res.message || 'Pago anulado exitosamente.');
        this.cargarHistorialPagos();
        this.cargarDatosBackend();
        if (this.comuneroSeleccionadoFinanzas) {
          this.seleccionarComuneroFinanzas(this.comuneroSeleccionadoFinanzas);
        }
      },
      error: (err) => alert(err.error?.message || 'Error al anular el pago.')
    });
  }

  reimprimirPDFDesdeHistorial(pago: any) {
    this.comprobanteActual = {
      comprobanteNo: `REC-${String(pago.id).padStart(6, '0')}`,
      fechaHora: new Date(pago.fecha_pago).toLocaleString(),
      comuneroNombre: pago.comunero_nombre,
      comuneroCedula: pago.cedula,
      detalles: [
        {
          concepto: 'Cobro de Rubro / Obligación',
          periodo: 'Registrado',
          valor: Number(pago.valor_total)
        }
      ],
      total: Number(pago.valor_total),
      valorRecibido: Number(pago.valor_total),
      cambio: 0
    };
    this.imprimirPDFComprobante();
  }

  pagosComunero: any[] = [];

  seleccionarComuneroFinanzas(comunero: any) {
    this.comuneroSeleccionadoFinanzas = comunero;
    this.obligacionesComunero = [];
    this.pagosComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;
    this.cdr.detectChanges();

    if (!comunero) return;

    this.adminService.getObligaciones(comunero.id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.obligacionesComunero = res.data.filter((o: any) => o.estado === 'PENDIENTE');
          this.pagosComunero = res.data.filter((o: any) => o.estado === 'PAGADA');
          this.obligacionesSeleccionadasIds = this.obligacionesComunero.map(o => o.id);
        } else {
          this.obligacionesComunero = [];
          this.pagosComunero = [];
          this.obligacionesSeleccionadasIds = [];
        }
        this.cdr.detectChanges();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al consultar obligaciones', err);
        alert('Error al consultar obligaciones del comunero.');
        this.cdr.detectChanges();
      }
    });
  }

  isObligacionSeleccionada(id: number): boolean {
    return this.obligacionesSeleccionadasIds.includes(id);
  }

  toggleObligacionSeleccionada(id: number) {
    if (this.isObligacionSeleccionada(id)) {
      this.obligacionesSeleccionadasIds = this.obligacionesSeleccionadasIds.filter(item => item !== id);
    } else {
      this.obligacionesSeleccionadasIds = [...this.obligacionesSeleccionadasIds, id];
    }
    this.cdr.detectChanges();
  }

  toggleSeleccionarTodasObligaciones(event: any) {
    if (event.target.checked) {
      this.obligacionesSeleccionadasIds = this.obligacionesComunero.map(o => o.id);
    } else {
      this.obligacionesSeleccionadasIds = [];
    }
    this.cdr.detectChanges();
  }

  get totalAPagarFinanzas(): number {
    return this.obligacionesComunero
      .filter(o => this.obligacionesSeleccionadasIds.includes(o.id))
      .reduce((sum, o) => sum + Number(o.valor || 0), 0);
  }

  get cambioCalculado(): number {
    if (!this.valorRecibidoFinanzas || this.valorRecibidoFinanzas < this.totalAPagarFinanzas) {
      return 0;
    }
    return Number((this.valorRecibidoFinanzas - this.totalAPagarFinanzas).toFixed(2));
  }

  cobrarObligacion() {
    if (!this.comuneroSeleccionadoFinanzas || this.obligacionesSeleccionadasIds.length === 0) {
      alert('Por favor selecciona al menos una obligación a cobrar.');
      return;
    }

    const total = this.totalAPagarFinanzas;
    if (this.valorRecibidoFinanzas === null || this.valorRecibidoFinanzas < total) {
      alert(`El valor recibido debe ser mayor o igual al total a pagar ($${total.toFixed(2)}).`);
      return;
    }

    const obligacionesACobrar = this.obligacionesComunero.filter(o => this.obligacionesSeleccionadasIds.includes(o.id));

    const payload = {
      persona_id: this.comuneroSeleccionadoFinanzas.id,
      metodo: 'EFECTIVO',
      obligacionesIds: this.obligacionesSeleccionadasIds,
      observaciones: 'Pago procesado desde panel administrativo.'
    };

    this.adminService.registrarPago(payload).subscribe({
      next: (res: any) => {
        // Armar datos del comprobante para imprimir
        this.comprobanteActual = {
          comprobanteNo: res.pagoId ? `REC-${String(res.pagoId).padStart(6, '0')}` : `REC-${Date.now()}`,
          fechaHora: new Date().toLocaleString(),
          comuneroNombre: this.comuneroSeleccionadoFinanzas.nombres,
          comuneroCedula: this.comuneroSeleccionadoFinanzas.cedula,
          detalles: obligacionesACobrar.map(o => ({
            concepto: o.concepto_nombre || o.concepto || 'Cobro de Rubro',
            periodo: o.periodo_anio ? `${o.periodo_anio}${o.periodo_mes ? ' - Mes ' + o.periodo_mes : ''}` : 'N/A',
            valor: Number(o.valor)
          })),
          total: total,
          valorRecibido: Number(this.valorRecibidoFinanzas),
          cambio: this.cambioCalculado
        };

        this.comprobanteModalVisible = true;
        this.modalCobroVisible = false;
        this.cargarDatosBackend(); // Actualizar finanzas/balance
        this.cargarHistorialPagos(); // Recargar historial de cobros
        this.seleccionarComuneroFinanzas(this.comuneroSeleccionadoFinanzas); // Recargar obligaciones pendientes
      },
      error: (err) => alert(err.error?.message || 'Error al procesar el pago.')
    });
  }

  cerrarModalComprobante() {
    this.comprobanteModalVisible = false;
    this.comprobanteActual = null;
  }

  imprimirPDFComprobante() {
    if (!this.comprobanteActual) return;
    const c = this.comprobanteActual;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    // Encabezado en Blanco y Negro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('JUNTA DE AGUA Y RIEGO "LA JONES"', 74, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Patate - Tungurahua - Ecuador', 74, 20, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`COMPROBANTE DE PAGO ${c.comprobanteNo}`, 74, 27, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(15, 30, 133, 30);

    // Ficha Comunero
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Comunero Titular:', 15, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(c.comuneroNombre, 45, 36);

    doc.setFont('helvetica', 'bold');
    doc.text('Cédula / RUC:', 15, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(c.comuneroCedula, 45, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha / Hora:', 15, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(c.fechaHora, 45, 48);

    // Tabla de Detalles (Blanco y Negro)
    const tableData = c.detalles.map((d: any) => [
      d.concepto,
      d.periodo,
      `$${d.valor.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 53,
      head: [['Concepto', 'Periodo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2 },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 8.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35 },
        2: { cellWidth: 23, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 100;

    // Resumen de Valores en Blanco y Negro
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL COBRADO:', 75, finalY);
    doc.text(`$${c.total.toFixed(2)}`, 133, finalY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('VALOR RECIBIDO:', 75, finalY + 5);
    doc.text(`$${c.valorRecibido.toFixed(2)}`, 133, finalY + 5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('CAMBIO ENTREGADO:', 75, finalY + 10);
    doc.text(`$${c.cambio.toFixed(2)}`, 133, finalY + 10, { align: 'right' });

    // Pie de página
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    doc.text('Gracias por mantener al día sus aportes para el fortalecimiento de nuestra Junta de Agua.', 74, finalY + 22, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CAJA GENERAL - JUNTA LA JONES', 74, finalY + 27, { align: 'center' });

    // Auto Imprimir directo el PDF generado
    doc.autoPrint();
    const pdfBlobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = pdfBlobUrl.toString();
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 100);
    };
  }
}
