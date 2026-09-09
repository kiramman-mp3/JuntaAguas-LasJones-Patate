const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API REST — Sistema Integrado de Gestión Junta La Jones (Patate)',
    version: '1.0.0',
    description: 'Documentación oficial e interactiva de las APIs REST para la administración de comuneros, lotes georreferenciados, turnos de agua, asistencias a asambleas/mingas, recaudación financiera y auditoría.',
    contact: {
      name: 'Junta de Agua y Riego La Jones',
      url: 'https://github.com/kiramman-mp3/JuntaAguas-LasJones-Patate'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Servidor de Desarrollo Local'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT obtenido al iniciar sesión en /auth/login.'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ERROR' },
          message: { type: 'string', example: 'Descripción del error.' }
        }
      },
      Persona: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          cedula: { type: 'string', example: '1801234567' },
          nombres: { type: 'string', example: 'Juan Carlos' },
          apellidos: { type: 'string', example: 'Morales Soria' },
          direccion: { type: 'string', example: 'Sector Las Jones Alto' },
          telefono: { type: 'string', example: '032870112' },
          celular: { type: 'string', example: '0991234567' },
          email: { type: 'string', example: 'juan.morales@example.com' },
          estado: { type: 'string', example: 'ACTIVO' }
        }
      },
      Lote: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          sector_id: { type: 'integer', example: 1 },
          codigo: { type: 'string', example: 'LOT-JONES-A04' },
          superficie_m2: { type: 'number', example: 2500.00 },
          latitud_aproximada: { type: 'number', example: -1.3324100 },
          longitud_aproximada: { type: 'number', example: -78.5142100 },
          radio_error_m: { type: 'number', example: 5.00 },
          referencia_ubicacion: { type: 'string', example: 'Frente a la toma de agua #2' }
        }
      },
      Obligacion: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          persona_id: { type: 'integer', example: 1 },
          concepto_id: { type: 'integer', example: 1 },
          periodo_anio: { type: 'integer', example: 2026 },
          periodo_mes: { type: 'integer', example: 8 },
          valor: { type: 'number', example: 10.00 },
          origen: { type: 'string', example: 'AUTOMATICA' },
          estado: { type: 'string', example: 'PENDIENTE' }
        }
      }
    }
  },
  tags: [
    { name: 'Autenticación', description: 'Endpoints para inicio de sesión y gestión de credenciales' },
    { name: 'Comuneros (Personas)', description: 'Gestión de comuneros y consulta pública de deudas por cédula' },
    { name: 'Lotes y Sectores', description: 'Terrenos georreferenciados y titularidad' },
    { name: 'Turnos de Agua', description: 'Horarios de distribución de agua de riego' },
    { name: 'Eventos y Asistencias', description: 'Asambleas, Mingas y generación automática de multas' },
    { name: 'Gestión Financiera', description: 'Recaudación, obligaciones, pagos, egresos y balance al día' },
    { name: 'Inventario', description: 'Control físico de bienes de la Junta' },
    { name: 'Planificación Anual', description: 'Planes operativos anuales y seguimiento de tareas' },
    { name: 'Auditoría', description: 'Bitácora inalterable de auditoría' }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerDefinition,
  swaggerSpec
};
