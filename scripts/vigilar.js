#!/usr/bin/env node
/**
 * Vigilante de disponibilidad: consulta /api/health cada minuto y avisa por webhook cuando el
 * sistema se cae y cuando se recupera. También avisa si el último respaldo es demasiado viejo.
 *
 *   npm run vigilar                       corre sin parar (déjelo bajo systemd, pm2 o el Programador de tareas)
 *   npm run vigilar -- --una-vez          una sola comprobación y sale con código 1 si falla (para cron)
 *
 * Variables de entorno (todas opcionales):
 *   VIGILAR_URL         URL a consultar          (por defecto http://127.0.0.1:3000/api/health)
 *   VIGILAR_INTERVALO   segundos entre consultas (60)
 *   VIGILAR_FALLOS      fallos seguidos antes de avisar, evita falsas alarmas por un reinicio (3)
 *   VIGILAR_WEBHOOK     URL que recibe un POST JSON { text, content }: sirve para Slack, Discord y Mattermost
 *   VIGILAR_RESPALDO_HORAS   horas máximas de antigüedad del último respaldo en backups/ (26); 0 desactiva
 *
 * Sin VIGILAR_WEBHOOK solo escribe en la consola, que systemd/pm2 guardan en su registro.
 */
const fs = require('fs');
const path = require('path');

const url = process.env.VIGILAR_URL || 'http://127.0.0.1:3000/api/health';
const intervaloMs = Number(process.env.VIGILAR_INTERVALO || 60) * 1000;
const fallosParaAvisar = Number(process.env.VIGILAR_FALLOS || 3);
const webhook = process.env.VIGILAR_WEBHOOK;
const horasRespaldo = Number(process.env.VIGILAR_RESPALDO_HORAS ?? 26);
const carpetaRespaldos = path.join(__dirname, '..', 'backups');
const unaVez = process.argv.includes('--una-vez');

const hora = () => new Date().toISOString();
const log = (mensaje) => console.log(`${hora()} [vigilar] ${mensaje}`);

async function avisar(mensaje) {
  log(mensaje);
  if (!webhook) return;
  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: mensaje, content: mensaje }),
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) log(`El webhook respondió ${r.status}.`);
  } catch (error) {
    log(`No se pudo enviar el aviso: ${error.message}`);
  }
}

/** Devuelve null si el sistema responde bien, o el motivo del fallo. */
async function comprobarSalud() {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (r.ok) return null;
    return `respondió ${r.status}${r.status === 503 ? ' (base de datos no disponible)' : ''}`;
  } catch (error) {
    return `sin respuesta (${error.cause?.code ?? error.message})`;
  }
}

/** Devuelve null si el último respaldo es reciente, o el motivo de la alerta. */
function comprobarRespaldo() {
  if (!horasRespaldo) return null;
  const archivos = fs.existsSync(carpetaRespaldos) ? fs.readdirSync(carpetaRespaldos).filter((n) => /^junta-.*\.sql\.gz$/.test(n)) : [];
  if (!archivos.length) return 'no hay ningún respaldo en backups/';
  const reciente = Math.max(...archivos.map((n) => fs.statSync(path.join(carpetaRespaldos, n)).mtimeMs));
  const horas = (Date.now() - reciente) / 3600000;
  return horas > horasRespaldo ? `el último respaldo tiene ${horas.toFixed(0)} horas` : null;
}

let fallosSeguidos = 0;
let caido = false;
let respaldoAlertado = false;

async function ciclo() {
  const motivo = await comprobarSalud();
  if (motivo) {
    fallosSeguidos += 1;
    log(`Fallo ${fallosSeguidos}/${fallosParaAvisar}: ${motivo}`);
    if (!caido && fallosSeguidos >= fallosParaAvisar) {
      caido = true;
      await avisar(`🔴 Junta La Jones: el sistema no responde en ${url} — ${motivo}.`);
    }
  } else {
    if (caido) await avisar(`🟢 Junta La Jones: el sistema volvió a responder en ${url}.`);
    fallosSeguidos = 0;
    caido = false;
  }

  const problemaRespaldo = comprobarRespaldo();
  if (problemaRespaldo && !respaldoAlertado) {
    respaldoAlertado = true;
    await avisar(`🟠 Junta La Jones: ${problemaRespaldo}. Revise la tarea programada de "npm run respaldo".`);
  } else if (!problemaRespaldo) {
    respaldoAlertado = false;
  }
  return !motivo && !problemaRespaldo;
}

async function main() {
  if (unaVez) {
    // Una sola pasada: con un fallo avisa de inmediato, sin esperar varios ciclos.
    const motivo = await comprobarSalud();
    const respaldo = comprobarRespaldo();
    if (motivo) await avisar(`🔴 Junta La Jones: el sistema no responde en ${url} — ${motivo}.`);
    if (respaldo) await avisar(`🟠 Junta La Jones: ${respaldo}.`);
    if (!motivo && !respaldo) log('Todo en orden.');
    process.exit(motivo || respaldo ? 1 : 0);
  }
  log(`Vigilando ${url} cada ${intervaloMs / 1000} s${webhook ? ' con avisos por webhook' : ' (sin webhook: solo consola)'}.`);
  for (;;) {
    await ciclo();
    await new Promise((resolver) => setTimeout(resolver, intervaloMs));
  }
}

main();
