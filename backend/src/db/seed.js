/**
 * Datos de prueba realistas para desarrollo y demostraciones.
 *
 * La historia se simula mes a mes con los mismos servicios que usa la API (tarifas,
 * facturación mensual, asistencias, finalización con multas, pagos y anulaciones), así
 * los datos cumplen las mismas reglas que los que se registran desde la interfaz.
 * Es determinista: con la misma semilla y la misma fecha de corte genera la misma base.
 */
const { esCedulaValida } = require('../shared/schemas');
const { hashPassword } = require('../shared/passwords');
const { hoy: hoyEcuador } = require('../shared/dates');
const { prefijoSector } = require('../utils/loteCodigo');
const finanzas = require('../services/finanzasService');
const eventos = require('../services/eventosService');
const { guardarDocumento } = require('../services/documentStorage');
const { degradadoPng } = require('./imagenDemo');

const NOMBRES_H = ['José', 'Luis', 'Segundo', 'Manuel', 'Carlos', 'Juan', 'Marco', 'Jorge', 'Ángel', 'Fausto', 'Washington', 'Edison', 'Patricio', 'Héctor', 'Rodrigo', 'Wilson', 'Galo', 'Milton', 'Diego', 'Byron', 'Fabián', 'Raúl', 'Germán', 'Hugo', 'Darwin'];
const NOMBRES_M = ['María', 'Rosa', 'Carmen', 'Blanca', 'Luz', 'Martha', 'Gloria', 'Ana', 'Lucía', 'Mercedes', 'Fanny', 'Rocío', 'Nelly', 'Mariana', 'Silvia', 'Elena', 'Jenny', 'Patricia', 'Dolores', 'Inés', 'Teresa', 'Verónica', 'Gladys', 'Mónica', 'Beatriz'];
const APELLIDOS = ['Toapanta', 'Quispe', 'Chicaiza', 'Pilamunga', 'Masaquiza', 'Caiza', 'Tisalema', 'Sailema', 'Freire', 'Naranjo', 'Aldaz', 'Moreta', 'Lascano', 'Villacís', 'Sánchez', 'Jácome', 'Altamirano', 'Barona', 'Mayorga', 'Pérez', 'Tigse', 'Chango', 'Guamán', 'Llerena', 'Robalino', 'Salazar', 'Mejía', 'Paredes', 'Ortiz', 'Tamayo', 'Carvajal', 'Silva', 'Garcés', 'Núñez', 'Viteri', 'Acosta', 'Cobo', 'Medina', 'Pazmiño', 'Sisa'];

const SECTORES = [
  { nombre: 'Patate Viejo', descripcion: 'Sector histórico, canal principal y tomas de cabecera', lat: -1.3080, lng: -78.5000, barrio: 'Sector Patate Viejo' },
  { nombre: 'La Merced', descripcion: 'Zona centro-norte, distribución intermedia y reservorio La Merced', lat: -1.3260, lng: -78.5140, barrio: 'Barrio La Merced' },
  { nombre: 'San Javier', descripcion: 'Sector bajo y fértil hacia la vega del río Patate', lat: -1.3200, lng: -78.5230, barrio: 'Sector San Javier' }
];
const REFERENCIAS = ['Junto a la acequia principal', 'Frente a la casa comunal', 'Bajo el reservorio', 'Junto al camino vecinal', 'Cerca de la escuela', 'Al filo de la quebrada', 'Tras la capilla', 'Junto al tanque rompepresión'];

// Pago anual de agua: el valor de cada año es la tarifa AGUA_ANUAL vigente al 1 de enero.
const TARIFAS_AGUA = [
  { mesesAtras: 24, valor: 36.00, observacion: 'Tarifa anual aprobada en asamblea general ordinaria' },
  { mesesAtras: 9, valor: 42.00, observacion: 'Incremento aprobado en asamblea por mantenimiento del canal' }
];
const MULTA_ASAMBLEA = 10;
const MULTA_MINGA = 15;

const TRABAJOS_MINGA = [
  'Limpieza del canal matriz', 'Desbroce de la acequia de La Jones Baja', 'Reparación de la bocatoma',
  'Limpieza del reservorio', 'Arreglo de compuertas', 'Cambio de tubería en el paso de la quebrada',
  'Desbroce de caminos de servicio', 'Revestimiento de un tramo del canal'
];
const MOTIVOS_JUSTIFICACION = ['Calamidad doméstica', 'Enfermedad con certificado médico', 'Viaje por trabajo fuera de la provincia', 'Cita médica del IESS', 'Cuidado de familiar enfermo'];
const PROVEEDORES = [
  { proveedor: 'Ferretería El Constructor', ruc: '1802456781001', conceptos: ['Compra de cemento y arena para el canal', 'Compra de tubería PVC de 110 mm', 'Compra de herramientas para mingas'] },
  { proveedor: 'Agropecuaria Patate', ruc: '1803367812001', conceptos: ['Compra de mangueras de riego', 'Compra de compuertas metálicas'] },
  { proveedor: 'Papelería San Cristóbal', ruc: '1801198734001', conceptos: ['Útiles de oficina y recibos', 'Impresión de convocatorias'] }
];

/** Generador pseudoaleatorio determinista (mulberry32). */
function crearAzar(semilla) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entero: (min, max) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: (lista) => lista[Math.floor(siguiente() * lista.length)],
    probabilidad: (p) => siguiente() < p
  };
}

const dosDigitos = (n) => String(n).padStart(2, '0');
const fechaIso = (anio, mes, dia) => `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const sumarMeses = ({ anio, mes }, n) => {
  const total = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
};
const sumarDias = (fecha, n) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Instante correspondiente a una fecha y hora local de Ecuador (UTC-5). */
const instante = (fecha, hora = '12:00:00') => new Date(`${fecha}T${hora}-05:00`);
/** Día del mes del n-ésimo día de la semana (0 = domingo) en un mes. */
function enesimoDiaSemana(anio, mes, diaSemana, n) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  return 1 + ((diaSemana - primero + 7) % 7) + (n - 1) * 7;
}
const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cédula válida de Tungurahua (provincia 18) con dígito verificador correcto. */
function generarCedula(azar) {
  let base = `18${azar.entero(0, 5)}`;
  while (base.length < 9) base += azar.entero(0, 9);
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(base[i]) * (i % 2 === 0 ? 2 : 1);
    if (v >= 10) v -= 9;
    suma += v;
  }
  return base + (suma % 10 === 0 ? 0 : 10 - (suma % 10));
}

async function insertarFilas(conexion, sql, filas, lote = 500) {
  for (let i = 0; i < filas.length; i += lote) {
    await conexion.query(sql, [filas.slice(i, i + lote)]);
  }
}

/** Usuarios con un perfil de pago y asistencia que guía la simulación. */
function generarPersonas(azar, total) {
  const cedulas = new Set();
  const personas = [];
  for (let i = 0; i < total; i++) {
    let cedula;
    do cedula = generarCedula(azar); while (cedulas.has(cedula));
    if (!esCedulaValida(cedula)) throw new Error(`Cédula generada inválida: ${cedula}`);
    cedulas.add(cedula);

    const mujer = azar.probabilidad(0.48);
    const nombres = mujer ? NOMBRES_M : NOMBRES_H;
    const primerNombre = azar.elegir(nombres);
    let segundoNombre;
    do segundoNombre = azar.elegir(nombres); while (segundoNombre === primerNombre);
    const apellidoPaterno = azar.elegir(APELLIDOS);
    const sector = azar.entero(0, SECTORES.length - 1);
    const p = azar.siguiente();
    personas.push({
      cedula,
      nombres: `${primerNombre} ${segundoNombre}`,
      apellidos: `${apellidoPaterno} ${azar.elegir(APELLIDOS)}`,
      direccion: `${SECTORES[sector].barrio}, ${azar.elegir(REFERENCIAS).toLowerCase()}`,
      celular: `09${azar.entero(6, 9)}${String(azar.entero(0, 9999999)).padStart(7, '0')}`,
      telefono: azar.probabilidad(0.2) ? `03287${String(azar.entero(0, 9999)).padStart(4, '0')}` : null,
      email: azar.probabilidad(0.3) ? `${sinTildes(primerNombre)}.${sinTildes(apellidoPaterno)}${azar.entero(1, 99)}@gmail.com` : null,
      fechaNacimiento: fechaIso(azar.entero(1948, 2002), azar.entero(1, 12), azar.entero(1, 28)),
      sector,
      perfil: p < 0.6 ? 'PUNTUAL' : p < 0.85 ? 'REGULAR' : 'MOROSO'
    });
  }
  return personas;
}

async function crearPersonasYCuentas(conexion, azar, { totalUsuarios, password }) {
  // La directiva va primero: sus cuentas son las administradoras.
  const directiva = [
    { cargo: 'Presidente', nombres: 'Carlos Eduardo', apellidos: 'Moreta Salazar' },
    { cargo: 'Tesorera', nombres: 'María Rosa', apellidos: 'Quispe Toapanta' }
  ];
  const personas = generarPersonas(azar, directiva.length + totalUsuarios);
  directiva.forEach((d, i) => Object.assign(personas[i], { nombres: d.nombres, apellidos: d.apellidos, perfil: 'PUNTUAL', cargo: d.cargo }));

  const [r] = await conexion.query(
    'INSERT INTO personas (cedula, nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento, estado) VALUES ?',
    [personas.map((p) => [p.cedula, p.nombres, p.apellidos, p.direccion, p.telefono, p.celular, p.email, p.fechaNacimiento, 'ACTIVO'])]
  );
  personas.forEach((p, i) => { p.id = r.insertId + i; });

  const [roles] = await conexion.query('SELECT id, codigo FROM roles');
  const rol = Object.fromEntries(roles.map((x) => [x.codigo, x.id]));
  const hash = await hashPassword(password);

  // Cuentas: la directiva (ADMIN), un usuario de demostración y una parte de los usuarios,
  // estos últimos con contraseña temporal pendiente de cambio, como al crearlas desde la interfaz.
  const conCuenta = personas.slice(0, directiva.length + 1)
    .concat(personas.slice(directiva.length + 1).filter(() => azar.probabilidad(0.25)));
  const filas = conCuenta.map((p, i) => [
    p.id, i < directiva.length ? rol.ADMIN : rol.USUARIO, hash, i > directiva.length, 'ACTIVA'
  ]);
  const [c] = await conexion.query(
    'INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES ?', [filas]
  );
  conCuenta.forEach((p, i) => { p.cuentaId = c.insertId + i; });
  await conexion.query('UPDATE cuentas SET creada_por_cuenta_id = ? WHERE id <> ?', [personas[0].cuentaId, personas[0].cuentaId]);

  return { personas, admin: personas[0], demo: personas[directiva.length], cuentas: conCuenta.length };
}

async function crearSectoresYLotes(conexion, azar, personas, fechaInicio) {
  for (const s of SECTORES) {
    await conexion.query(
      `INSERT INTO sectores (nombre, descripcion, activo) VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = TRUE`,
      [s.nombre, s.descripcion]
    );
  }
  const [dbSectores] = await conexion.query(
    'SELECT id, nombre, descripcion FROM sectores WHERE nombre IN (?) ORDER BY id ASC',
    [SECTORES.map((s) => s.nombre)]
  );
  const mapaDb = new Map(dbSectores.map((row) => [row.nombre, row.id]));
  const sectores = SECTORES.map((s) => ({
    ...s,
    id: mapaDb.get(s.nombre),
    prefijo: prefijoSector(s.nombre),
    siguiente: 1
  }));

  const lotes = [];
  for (const persona of personas) {
    const cantidad = azar.probabilidad(0.6) ? 1 : azar.probabilidad(0.75) ? 2 : 3;
    for (let i = 0; i < cantidad; i++) {
      const sector = sectores[azar.probabilidad(0.8) ? persona.sector : azar.entero(0, sectores.length - 1)];
      const ancho = azar.entero(20, 70);
      const largo = azar.entero(30, 120);
      lotes.push({
        persona, sector,
        codigo: `${sector.prefijo}-${String(sector.siguiente++).padStart(3, '0')}`,
        ancho, largo, superficie: ancho * largo,
        lat: sector.lat + (azar.siguiente() - 0.5) * 0.008,
        lng: sector.lng + (azar.siguiente() - 0.5) * 0.008,
        radio: azar.entero(5, 15),
        referencia: azar.elegir(REFERENCIAS),
        relacion: azar.probabilidad(0.06) ? 'REPRESENTANTE' : 'PROPIETARIO',
        desde: fechaIso(azar.entero(1995, Number(fechaInicio.slice(0, 4)) - 1), azar.entero(1, 12), azar.entero(1, 28))
      });
    }
  }

  const [l] = await conexion.query(
    `INSERT INTO lotes (sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion)
     VALUES ?`,
    [lotes.map((x) => [x.sector.id, x.codigo, x.superficie, x.ancho, x.largo, x.lat.toFixed(7), x.lng.toFixed(7), x.radio, x.referencia])]
  );
  lotes.forEach((x, i) => { x.id = l.insertId + i; });
  await conexion.query(
    'INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde, observacion) VALUES ?',
    [lotes.map((x) => [x.persona.id, x.id, x.relacion, 100, x.desde, x.relacion === 'REPRESENTANTE' ? 'Representa a un familiar residente fuera de la comunidad' : null])]
  );
  return { sectores, lotes };
}

/**
 * Turnos semanales sin solapes dentro de cada sector: el agua de un ramal se entrega a un lote a la vez,
 * de 05:00 a 21:00, con una duración según la superficie.
 */
async function crearTurnos(conexion, lotes, vigenciaDesde) {
  const INICIO = 5 * 60;
  const FIN = 21 * 60;
  const hora = (min) => `${dosDigitos(Math.floor(min / 60))}:${dosDigitos(min % 60)}:00`;
  const filas = [];
  const porSector = new Map();
  for (const lote of lotes) {
    if (!porSector.has(lote.sector.id)) porSector.set(lote.sector.id, []);
    porSector.get(lote.sector.id).push(lote);
  }
  for (const lotesSector of porSector.values()) {
    let dia = 1;
    let minuto = INICIO;
    for (const lote of lotesSector) {
      const duracion = Math.min(3, Math.max(1, Math.ceil(lote.superficie / 2500))) * 60;
      if (minuto + duracion > FIN) { dia++; minuto = INICIO; }
      if (dia > 7) break; // El ramal ya no tiene horas libres en la semana.
      filas.push([lote.persona.id, lote.id, dia, hora(minuto), hora(minuto + duracion), vigenciaDesde, 'ACTIVO']);
      minuto += duracion;
    }
  }
  await insertarFilas(conexion, 'INSERT INTO turnos_riego (persona_id, lote_id, dia_semana, hora_inicio, hora_fin, vigencia_desde, estado) VALUES ?', filas);
  return filas.length;
}

/**
 * Calendario de eventos: asamblea ordinaria trimestral, una minga mensual y la asamblea
 * extraordinaria que aprueba la segunda tarifa, el mes anterior a su vigencia.
 */
function calendarioEventos(azar, meses, mesExtraordinaria) {
  const lista = [];
  meses.forEach(({ anio, mes }, i) => {
    if ([1, 4, 7, 10].includes(mes)) {
      lista.push({ tipo: 'ASAMBLEA', fecha: fechaIso(anio, mes, enesimoDiaSemana(anio, mes, 0, 1)), hora: '08:00:00', horaFin: '12:00:00', titulo: `Asamblea General Ordinaria ${['enero', 'abril', 'julio', 'octubre'][[1, 4, 7, 10].indexOf(mes)]} ${anio}` });
    }
    if (i === mesExtraordinaria) {
      lista.push({ tipo: 'ASAMBLEA', fecha: fechaIso(anio, mes, enesimoDiaSemana(anio, mes, 0, 3)), hora: '14:00:00', horaFin: '17:00:00', titulo: `Asamblea Extraordinaria: incremento del pago anual de agua ${anio}`, extraordinaria: true });
    }
    lista.push({ tipo: 'MINGA', fecha: fechaIso(anio, mes, enesimoDiaSemana(anio, mes, 6, 2)), hora: '07:00:00', horaFin: '13:00:00', titulo: azar.elegir(TRABAJOS_MINGA) });
  });
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const ORDEN_DEL_DIA = ['Constatación del quórum', 'Lectura y aprobación del acta anterior', 'Informe económico de tesorería', 'Planificación de mingas y turnos de riego', 'Asuntos varios'];

async function crearEvento(conexion, e, { cuentaId, estado }) {
  const valorMulta = e.tipo === 'ASAMBLEA' ? MULTA_ASAMBLEA : MULTA_MINGA;
  const lugar = e.tipo === 'ASAMBLEA' ? 'Casa comunal de La Jones' : 'Punto de encuentro: bocatoma del canal matriz';
  const descripcion = e.tipo === 'ASAMBLEA'
    ? 'Se convoca a todos los usuarios del agua de riego. La inasistencia sin justificación genera multa.'
    : 'Traer pala, machete y azadón. La inasistencia sin justificación genera multa.';
  const [r] = await conexion.query(
    `INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, estado, genera_multa_ausencia, valor_multa, created_by_cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
    [e.tipo, e.titulo, descripcion, e.fecha, e.hora, e.horaFin, lugar, estado, valorMulta, cuentaId]
  );
  if (e.tipo === 'ASAMBLEA') {
    const puntos = e.extraordinaria ? ['Constatación del quórum', 'Propuesta de incremento del pago anual de agua', 'Votación y resolución'] : ORDEN_DEL_DIA;
    await conexion.query(
      'INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar) VALUES ?',
      [puntos.map((p, i) => [r.insertId, i + 1, p])]
    );
  }
  return r.insertId;
}

/** Registra la asistencia de todo el padrón y finaliza el evento, lo que genera las multas por ausencia. */
async function realizarEvento(conexion, azar, eventoId, personasPorId, cuentaId) {
  const evento = await eventos.obtenerEvento(conexion, eventoId);
  const { personas: padron } = await eventos.obtenerPadron(conexion, evento);
  const asistencias = padron.map(({ persona_id: id }) => {
    const perfil = personasPorId.get(Number(id))?.perfil;
    const presente = { PUNTUAL: 0.93, REGULAR: 0.8, MOROSO: 0.6 }[perfil] ?? 0.85;
    if (azar.probabilidad(presente)) return { persona_id: id, estado: 'PRESENTE' };
    if (azar.probabilidad(0.3)) return { persona_id: id, estado: 'JUSTIFICADO', motivo_justificacion: azar.elegir(MOTIVOS_JUSTIFICACION) };
    return { persona_id: id, estado: 'AUSENTE' };
  });
  await eventos.registrarAsistencias(conexion, evento, asistencias, cuentaId);
  // La asistencia se registra durante el evento, no en el momento de sembrar.
  await conexion.query('UPDATE asistencias SET hora_registro = ? WHERE evento_id = ?', [instante(evento.fecha, evento.hora_inicio), eventoId]);

  if (evento.tipo === 'ASAMBLEA') {
    await conexion.query(
      `UPDATE puntos_asamblea SET tratado = 'Se trató el punto con la participación de los asistentes.',
         resolucion = CASE WHEN orden = 1 THEN 'Se constató el quórum reglamentario.' ELSE 'Aprobado por mayoría de los asistentes.' END
       WHERE evento_id = ?`,
      [eventoId]
    );
  }
  const { multasGeneradas } = await eventos.finalizar(conexion, evento, instante(evento.fecha, '18:00:00'));
  return multasGeneradas;
}

/** El usuario paga en una sola transacción todo lo que adeuda a la fecha, como en ventanilla. */
async function pagarPendientes(conexion, azar, persona, fecha, cuentaId) {
  const [pendientes] = await conexion.query(
    "SELECT id FROM obligaciones WHERE persona_id = ? AND estado = 'PENDIENTE' AND fecha_emision <= ? ORDER BY fecha_emision",
    [persona.id, fecha]
  );
  if (!pendientes.length) return null;
  const metodo = azar.probabilidad(0.8) ? 'EFECTIVO' : azar.probabilidad(0.75) ? 'TRANSFERENCIA' : 'DEPOSITO';
  const referencia = metodo === 'EFECTIVO' ? null : `${metodo === 'TRANSFERENCIA' ? 'TRF' : 'DEP'}-${azar.entero(100000, 999999)}`;
  const hora = `${dosDigitos(azar.entero(8, 16))}:${dosDigitos(azar.entero(0, 59))}:00`;
  const ahora = new Date();
  const momento = instante(fecha, hora);
  return finanzas.registrarPago(conexion, {
    personaId: persona.id, obligacionesIds: pendientes.map((o) => o.id), metodo, referencia, cuentaId,
    fechaPago: momento > ahora ? ahora : momento // Un pago de hoy no puede quedar en una hora futura.
  });
}

const PROBABILIDAD_PAGO = { PUNTUAL: 0.95, REGULAR: 0.45, MOROSO: 0.12 };

const PROBABILIDAD_PAGO_ANUAL = {
  PUNTUAL: { anterior: 0.9, actual: 0.85 },
  REGULAR: { anterior: 0.7, actual: 0.4 },
  MOROSO: { anterior: 0.2, actual: 0.05 }
};

/**
 * Pagos del agua anual: cada obligación emitida (en enero de su año, ver sembrar) se paga dentro de
 * su año según el perfil del usuario, nunca después de ayer. Lo que no se paga queda en cartera.
 */
async function crearPagosAnualesAgua(conexion, azar, personasPorId, hoy, cuentaId) {
  const anioActual = Number(hoy.slice(0, 4));

  const [iniciadas] = await conexion.query(
    'SELECT id, persona_id, periodo_anio, fecha_emision FROM obligacion_anual_agua WHERE periodo_anio <= ? ORDER BY id',
    [anioActual]
  );
  let pagos = 0;
  for (const obligacion of iniciadas) {
    const persona = personasPorId.get(Number(obligacion.persona_id));
    const probabilidad = PROBABILIDAD_PAGO_ANUAL[persona.perfil][obligacion.periodo_anio < anioActual ? 'anterior' : 'actual'];
    if (!azar.probabilidad(probabilidad)) continue;

    // El pago ocurre entre la emisión y el fin del año de la obligación, y nunca después de ayer.
    const inicio = obligacion.fecha_emision;
    const fin = [fechaIso(obligacion.periodo_anio, 12, 31), sumarDias(hoy, -1)].sort()[0];
    const dias = Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
    if (dias < 0) continue;
    const fecha = sumarDias(inicio, azar.entero(0, dias));

    const metodo = azar.probabilidad(0.75) ? 'TRANSFERENCIA' : 'DEPOSITO';
    await finanzas.registrarPagoAnualAgua(conexion, {
      personaId: persona.id, obligacionesIds: [obligacion.id], metodo, cuentaId,
      referencia: `${metodo === 'TRANSFERENCIA' ? 'TRF' : 'DEP'}-${azar.entero(100000, 999999)}`,
      fechaPago: instante(fecha, `${dosDigitos(azar.entero(8, 16))}:${dosDigitos(azar.entero(0, 59))}:00`)
    });
    pagos++;
  }
  return { pagos };
}

async function crearEgresos(conexion, azar, meses, hoy, cuentaId) {
  const filas = [];
  for (const { anio, mes } of meses) {
    const fechaTomero = fechaIso(anio, mes, Math.min(28, diasDelMes(anio, mes)));
    if (fechaTomero <= hoy) {
      filas.push([fechaTomero, 'Pago mensual al operador del canal (tomero)', null, null, `Honorario de ${mes}/${anio}`, null, 150]);
    }
    if (azar.probabilidad(0.5)) {
      const p = azar.elegir(PROVEEDORES);
      const fecha = fechaIso(anio, mes, azar.entero(5, 25));
      if (fecha <= hoy) {
        filas.push([fecha, azar.elegir(p.conceptos), p.proveedor, p.ruc, null, `001-002-${String(azar.entero(1000, 99999)).padStart(9, '0')}`, azar.entero(25, 260)]);
      }
    }
  }
  await conexion.query(
    'INSERT INTO egresos (fecha, concepto, proveedor, ruc_proveedor, descripcion, numero_factura, valor, registrado_por_cuenta_id) VALUES ?',
    [filas.map((f) => [...f, cuentaId])]
  );
  return filas.length;
}

async function crearInventario(conexion, fechaInicio) {
  const bienes = [
    ['INV-001', 'Pala de punta', 'Herramienta para mingas', 20, 12.5, 'BUENO', 'Bodega de la casa comunal'],
    ['INV-002', 'Machete', 'Herramienta para desbroce', 15, 8, 'BUENO', 'Bodega de la casa comunal'],
    ['INV-003', 'Carretilla', 'Carretilla de llanta neumática', 4, 65, 'REGULAR', 'Bodega de la casa comunal'],
    ['INV-004', 'Motoguadaña', 'Motoguadaña a gasolina para limpieza del canal', 1, 420, 'BUENO', 'Bodega de la casa comunal'],
    ['INV-005', 'Tubería PVC 110 mm', 'Tubos de 6 m de reserva para reparaciones', 12, 18.75, 'BUENO', 'Bodega junto a la bocatoma'],
    ['INV-006', 'Compuerta metálica', 'Compuerta de repuesto para derivaciones', 2, 95, 'BUENO', 'Bodega junto a la bocatoma'],
    ['INV-007', 'Computadora portátil', 'Equipo de secretaría y tesorería', 1, 650, 'BUENO', 'Oficina de la directiva'],
    ['INV-008', 'Impresora multifunción', 'Impresión de recibos y convocatorias', 1, 280, 'REGULAR', 'Oficina de la directiva'],
    ['INV-009', 'Sillas plásticas', 'Sillas para asambleas', 80, 9.5, 'BUENO', 'Casa comunal'],
    ['INV-010', 'Megáfono', 'Megáfono para convocatorias y mingas', 1, 55, 'MALO', 'Oficina de la directiva']
  ];
  await conexion.query(
    'INSERT INTO bienes_inventario (codigo, nombre, descripcion, cantidad, valor_unitario, estado_fisico, ubicacion, fecha_adquisicion) VALUES ?',
    [bienes.map((b) => [...b, fechaInicio])]
  );
  return bienes.length;
}

const NOTICIAS = [
  { titulo: 'Minga de limpieza del canal matriz antes del verano', corta: 'Este fin de semana limpiamos el canal desde la bocatoma. Participan todos los sectores.', larga: 'La directiva convoca a todos los usuarios a la minga de limpieza del canal matriz. Iniciamos a las 7:00 en la bocatoma. Traer pala, machete y botas de caucho. La asistencia genera registro y la inasistencia sin justificar una multa, según lo resuelto en asamblea. Al final habrá un refrigerio para los asistentes.', tags: ['minga', 'canal', 'verano'], colores: [[22, 101, 52], [134, 239, 172]] },
  { titulo: 'Rendición de cuentas: fecha y lugar de la asamblea', corta: 'La asamblea ordinaria de rendición de cuentas será en la casa comunal.', larga: 'Se presentará el informe de tesorería, el estado de la cartera por cobrar y el avance del plan anual de actividades. Los usuarios podrán hacer preguntas y proponer puntos para la próxima sesión. Lleve su cédula para registrar su asistencia.', tags: ['asamblea', 'finanzas'], colores: [[30, 64, 175], [147, 197, 253]] },
  { titulo: 'Nuevos turnos de riego para la temporada seca', corta: 'Se ajustaron los horarios de los tres sectores para repartir mejor el caudal.', larga: 'Con el aumento de la demanda en verano, la directiva reorganizó los turnos semanales sin cruces dentro de cada sector. Puede consultar su turno en el portal o en la secretaría. Cualquier reclamo se atiende los sábados de 08:00 a 12:00.', tags: ['turnos', 'riego', 'verano'], colores: [[14, 116, 144], [165, 243, 252]] },
  { titulo: 'Pago anual de agua: cómo cancelar por transferencia o en secretaría', corta: 'El pago anual vence el 31 de diciembre. Conserve su comprobante.', larga: 'Puede pagar en la secretaría de la Junta o por transferencia o depósito bancario indicando su cédula como referencia. Al registrar el pago recibirá un comprobante numerado que también puede descargar desde Mi cuenta.', tags: ['pagos', 'finanzas'], colores: [[161, 98, 7], [253, 224, 71]] },
  { titulo: 'Reparación de la compuerta de El Tambo', corta: 'Se repara la compuerta de la derivación de El Tambo; habrá cortes parciales.', larga: 'Durante la reparación el agua llegará con menor caudal a los lotes de la derivación. Agradecemos su comprensión. La obra se financia con el fondo de mantenimiento aprobado en asamblea.', tags: ['canal', 'mantenimiento'], colores: [[154, 52, 18], [253, 186, 116]] },
  { titulo: 'Actualización del catastro de lotes', corta: 'Verifique que los datos de su lote y su titularidad estén correctos.', larga: 'Estamos actualizando la georreferenciación de los lotes. Si cambió de titular o de contacto, acérquese a la secretaría con su cédula y el documento que respalde el cambio.', tags: ['catastro', 'secretaría'], colores: [[88, 28, 135], [216, 180, 254]] },
  { titulo: 'Recomendaciones para el uso eficiente del agua', corta: 'Pequeños cambios en el riego ahorran agua y mejoran la cosecha.', larga: 'Riegue en las primeras horas de la mañana, revise las fugas en su acequia y respete su turno. El agua es de todos los usuarios y cuidarla es parte del trabajo comunitario.', tags: ['riego', 'recomendaciones'], colores: [[6, 95, 70], [110, 231, 183]] },
  { titulo: 'Elección de la nueva directiva: calendario', corta: 'La elección se realizará en diciembre; las candidaturas se reciben en secretaría.', larga: 'Pueden postularse los usuarios al día en sus obligaciones. Las candidaturas se reciben hasta una semana antes de la asamblea de elección. La votación es presencial y secreta.', tags: ['asamblea', 'elecciones'], colores: [[67, 56, 202], [199, 210, 254]] }
];

/** Noticias de ejemplo, una cada nueve días hacia atrás, con imagen y etiquetas. */
async function crearNoticias(conexion, hoy, cuentaId) {
  for (const [i, n] of NOTICIAS.entries()) {
    const imagen = await guardarDocumento(degradadoPng(...n.colores), 'noticia', { soloImagen: true });
    // 15:00 UTC = 10:00 en Ecuador.
    const publicada = `${sumarDias(hoy, -(i * 9 + 2))} 15:00:00`;
    const [r] = await conexion.query(
      'INSERT INTO noticias (titulo, descripcion_corta, descripcion_larga, imagen_url, publicada_en, creada_por_cuenta_id) VALUES (?, ?, ?, ?, ?, ?)',
      [n.titulo, n.corta, n.larga, imagen.url, publicada, cuentaId]
    );
    await conexion.query('INSERT INTO noticia_etiquetas (noticia_id, etiqueta) VALUES ?', [n.tags.map((t) => [r.insertId, t])]);
  }
  return NOTICIAS.length;
}

async function crearPlanAnual(conexion, anio, hoy, cuentaId) {
  const [r] = await conexion.query(
    "INSERT INTO planes_anuales (anio, descripcion, estado, created_by_cuenta_id) VALUES (?, ?, 'ACTIVO', ?)",
    [anio, `Plan operativo anual ${anio} de la Junta de Riego La Jones`, cuentaId]
  );
  const actividades = [
    ['Rendición de cuentas a la asamblea', 1, 15, 1, 31],
    ['Limpieza integral del canal matriz', 2, 1, 3, 31],
    ['Revestimiento de 200 m del canal en La Jones Baja', 4, 1, 6, 30],
    ['Actualización del catastro de lotes', 5, 1, 8, 31],
    ['Mantenimiento del reservorio', 9, 1, 10, 31],
    ['Elección de la nueva directiva', 11, 1, 12, 15]
  ];
  const filas = actividades.map(([nombre, mi, di, mf, df]) => {
    const inicio = fechaIso(anio, mi, di);
    const fin = fechaIso(anio, mf, df);
    const estado = fin < hoy ? 'CUMPLIDA' : inicio <= hoy ? 'EN_PROCESO' : 'PENDIENTE';
    return [r.insertId, nombre, inicio, fin, estado, estado === 'CUMPLIDA' ? fin : null];
  });
  await conexion.query('INSERT INTO actividades_plan (plan_id, nombre, fecha_inicio, fecha_fin, estado, fecha_cumplimiento) VALUES ?', [filas]);
  return filas.length;
}

/**
 * Siembra la base completa. Exige una base migrada y sin usuarios.
 * @param {import('mysql2/promise').Connection} conexion conexión posicionada en la base, con dateStrings para DATE
 * @param {{ hoy?: string, semilla?: number, totalUsuarios?: number, meses?: number, password: string, log?: Function }} opciones
 */
async function sembrar(conexion, { hoy = hoyEcuador(), semilla = 2026, totalUsuarios = 120, meses: totalMeses = 22, password, log = console.log }) {
  const [[{ total }]] = await conexion.query('SELECT COUNT(*) AS total FROM personas');
  if (total > 0) throw new Error('La base ya tiene usuarios registrados. Use --reset para recrearla antes de sembrar.');

  const azar = crearAzar(semilla);
  const actual = { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
  const meses = Array.from({ length: totalMeses }, (_, i) => sumarMeses(actual, i - totalMeses + 1));
  const fechaInicio = fechaIso(meses[0].anio, meses[0].mes, 1);

  await conexion.beginTransaction();
  try {
    log('[seed] Usuarios, cuentas, sectores y lotes...');
    const { personas, admin, demo, cuentas } = await crearPersonasYCuentas(conexion, azar, { totalUsuarios, password });
    const personasPorId = new Map(personas.map((p) => [p.id, p]));
    const { lotes } = await crearSectoresYLotes(conexion, azar, personas, fechaInicio);
    const turnos = await crearTurnos(conexion, lotes, fechaInicio);

    log('[seed] Tarifas...');
    const agua = await finanzas.conceptoPorCodigo(conexion, 'AGUA_ANUAL');
    for (const t of TARIFAS_AGUA) {
      const { anio, mes } = sumarMeses(actual, -t.mesesAtras);
      await finanzas.registrarTarifa(conexion, { conceptoId: agua.id, valor: t.valor, vigenciaDesde: fechaIso(anio, mes, 1), observacion: t.observacion });
    }
    // Las multas por inasistencia también se configuran como tarifas (Ajustes → Tarifas).
    const inicioMultas = TARIFAS_AGUA.reduce((a, t) => Math.max(a, t.mesesAtras), 0);
    const { anio: anioMultas, mes: mesMultas } = sumarMeses(actual, -inicioMultas);
    for (const [codigo, valor] of [['MULTA_ASAMBLEA', MULTA_ASAMBLEA], ['MULTA_MINGA', MULTA_MINGA]]) {
      const concepto = await finanzas.conceptoPorCodigo(conexion, codigo);
      await finanzas.registrarTarifa(conexion, { conceptoId: concepto.id, valor, vigenciaDesde: fechaIso(anioMultas, mesMultas, 1), observacion: 'Multa por inasistencia' });
    }

    // Algunos usuarios dejan la Junta a mitad del período (venta del terreno, fallecimiento).
    const retiros = new Map();
    for (const p of personas.slice(3).filter(() => azar.probabilidad(0.03))) {
      retiros.set(p.id, azar.entero(Math.floor(totalMeses / 3), totalMeses - 2));
    }

    log(`[seed] Simulando ${totalMeses} meses de pago anual de agua, eventos y pagos...`);
    const calendario = calendarioEventos(azar, meses, totalMeses - TARIFAS_AGUA[1].mesesAtras - 2);
    const resumen = { obligacionesAnuales: 0, eventosRealizados: 0, multas: 0, pagos: 0 };
    for (const [i, periodo] of meses.entries()) {
      const retirados = [...retiros].filter(([, mes]) => mes === i).map(([id]) => id);
      if (retirados.length) await conexion.query("UPDATE personas SET estado = 'INACTIVO' WHERE id IN (?)", [retirados]);

      // El pago anual se emite al empezar cada año (o al inicio de la historia simulada).
      if (i === 0 || periodo.mes === 1) {
        const anual = await finanzas.generarObligacionesAnualesAgua(conexion, {
          anio: periodo.anio, fechaEmision: fechaIso(periodo.anio, periodo.mes, 1)
        });
        resumen.obligacionesAnuales += anual.generadas;
      }

      const prefijo = `${periodo.anio}-${dosDigitos(periodo.mes)}`;
      for (const e of calendario.filter((x) => x.fecha.startsWith(prefijo) && x.fecha < hoy)) {
        // Un evento del último año se suspendió por lluvias.
        const cancelado = e.tipo === 'MINGA' && i === totalMeses - 4;
        const id = await crearEvento(conexion, e, { cuentaId: admin.cuentaId, estado: cancelado ? 'CANCELADO' : 'CONVOCADO' });
        if (cancelado) continue;
        resumen.multas += await realizarEvento(conexion, azar, id, personasPorId, admin.cuentaId);
        resumen.eventosRealizados++;
      }

      const ultimoDia = diasDelMes(periodo.anio, periodo.mes);
      for (const persona of personas) {
        if (!azar.probabilidad(PROBABILIDAD_PAGO[persona.perfil])) continue;
        const fecha = fechaIso(periodo.anio, periodo.mes, azar.entero(5, ultimoDia));
        if (fecha >= hoy) continue;
        if (await pagarPendientes(conexion, azar, persona, fecha, admin.cuentaId)) resumen.pagos++;
      }
    }

    // Errores de digitación detectados en caja: se anula el pago y se vuelve a cobrar.
    const [recientes] = await conexion.query(
      "SELECT id, persona_id FROM pagos WHERE estado = 'VIGENTE' AND fecha_pago >= ? ORDER BY id LIMIT 4",
      [instante(sumarDias(hoy, -45), '00:00:00')]
    );
    for (const [i, pago] of recientes.entries()) {
      await finanzas.anularPago(conexion, { pagoId: pago.id, motivo: 'Error de digitación en el recibo', cuentaId: admin.cuentaId });
      if (i > 0) await pagarPendientes(conexion, azar, personasPorId.get(Number(pago.persona_id)), hoy, admin.cuentaId);
    }

    log('[seed] Pago anual de agua...');
    const anualAgua = await crearPagosAnualesAgua(conexion, azar, personasPorId, hoy, admin.cuentaId);

    log('[seed] Próximos eventos, egresos, inventario y plan anual...');
    const proximos = [
      // 4 próximas asambleas
      { tipo: 'ASAMBLEA', fecha: sumarDias(hoy, 8), hora: '08:00:00', horaFin: '12:00:00', titulo: 'Asamblea General Ordinaria: Rendición de Cuentas', estado: 'CONVOCADO' },
      { tipo: 'ASAMBLEA', fecha: sumarDias(hoy, 28), hora: '08:30:00', horaFin: '12:00:00', titulo: 'Asamblea Extraordinaria: Mantenimiento del Reservorio', estado: 'CONVOCADO' },
      { tipo: 'ASAMBLEA', fecha: sumarDias(hoy, 56), hora: '09:00:00', horaFin: '13:00:00', titulo: 'Asamblea General Ordinaria: Turnos de Riego de Verano', estado: 'PROGRAMADO' },
      { tipo: 'ASAMBLEA', fecha: sumarDias(hoy, 84), hora: '08:00:00', horaFin: '12:00:00', titulo: 'Asamblea General Informativa y Evaluación de Cuotas', estado: 'PROGRAMADO' },

      // 4 próximas mingas
      { tipo: 'MINGA', fecha: sumarDias(hoy, 4), hora: '07:00:00', horaFin: '13:00:00', titulo: 'Limpieza del canal matriz antes del verano', estado: 'CONVOCADO' },
      { tipo: 'MINGA', fecha: sumarDias(hoy, 18), hora: '07:30:00', horaFin: '12:30:00', titulo: 'Desbroce y mantenimiento de la acequia de La Jones Baja', estado: 'CONVOCADO' },
      { tipo: 'MINGA', fecha: sumarDias(hoy, 42), hora: '07:00:00', horaFin: '12:00:00', titulo: 'Reparación de la compuerta de El Tambo', estado: 'PROGRAMADO' },
      { tipo: 'MINGA', fecha: sumarDias(hoy, 70), hora: '07:00:00', horaFin: '13:00:00', titulo: 'Limpieza y mantenimiento del desarenador de la bocatoma', estado: 'PROGRAMADO' }
    ];
    for (const e of proximos) await crearEvento(conexion, e, { cuentaId: admin.cuentaId, estado: e.estado });

    const egresos = await crearEgresos(conexion, azar, meses, hoy, personas[1].cuentaId);
    const bienes = await crearInventario(conexion, fechaInicio);
    const actividades = await crearPlanAnual(conexion, actual.anio, hoy, admin.cuentaId);
    const noticias = await crearNoticias(conexion, hoy, admin.cuentaId);

    await conexion.commit();
    return {
      ...resumen, anualAgua, usuarios: personas.length, cuentas, lotes: lotes.length, turnos, egresos, bienes, actividades, noticias,
      anulaciones: recientes.length, retirados: retiros.size,
      admin: { cedula: admin.cedula, nombre: `${admin.nombres} ${admin.apellidos}` },
      demo: { cedula: demo.cedula, nombre: `${demo.nombres} ${demo.apellidos}` }
    };
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  }
}

/**
 * Agrega solo las noticias de ejemplo a una base que ya tiene datos (no toca nada más).
 * No hace nada si ya existe alguna noticia. Devuelve cuántas creó.
 */
async function sembrarNoticias(conexion) {
  const [[{ total }]] = await conexion.query('SELECT COUNT(*) AS total FROM noticias');
  if (total > 0) return 0;
  const [admin] = await conexion.query(
    "SELECT c.id FROM cuentas c JOIN roles r ON r.id = c.rol_id WHERE r.codigo = 'ADMIN' AND c.estado = 'ACTIVA' ORDER BY c.id LIMIT 1"
  );
  return crearNoticias(conexion, hoyEcuador(), admin[0]?.id ?? null);
}

module.exports = { sembrar, sembrarNoticias, generarCedula, crearAzar };
