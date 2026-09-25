const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Vinculacion\\JuntaAguas-LasJones-Patate\\frontend\\src\\app\\pages\\admin\\admin.component.html';
let content = fs.readFileSync(filePath, 'utf8');

// We want to extract the finanzas-grid from the modal.
const modalStart = content.indexOf('<!-- MODAL: REGISTRAR NUEVO COBRO -->');
const modalEnd = content.indexOf('<!-- MODAL COMPROBANTE DE PAGO IMPRIMIBLE -->');

let gridContent = '';
if (modalStart !== -1 && modalEnd !== -1) {
  const modalHTML = content.substring(modalStart, modalEnd);
  const gridStart = modalHTML.indexOf('<div class="finanzas-grid"');
  // It ends at the div before the end of the modal-backdrop
  gridContent = modalHTML.substring(gridStart, modalHTML.lastIndexOf('</div>', modalHTML.lastIndexOf('</div>') - 1));
  
  // Clean up the modal from the file
  content = content.substring(0, modalStart) + content.substring(modalEnd);
}

if (!gridContent) {
  console.log("Error finding grid");
  process.exit(1);
}

// Add the Totales & Resumen
const totalesYResumenHTML = `
<!-- RESUMEN MENSUAL Y TOTALES -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
  <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Ingresos</span>
    <strong style="font-size: 1.5rem; color: var(--color-success);">$ {{ kpis.recaudadoMes.toFixed(2) }}</strong>
  </div>
  <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Egresos</span>
    <strong style="font-size: 1.5rem; color: var(--color-danger);">$ {{ kpis.egresosMes.toFixed(2) }}</strong>
  </div>
  <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: var(--bg-surface-hover);">
    <span style="font-size: 0.85rem; color: var(--text-color); font-weight: 600; text-transform: uppercase;">Saldo Actual</span>
    <strong style="font-size: 1.5rem; color: var(--color-primary);">$ {{ kpis.balanceAlDia.toFixed(2) }}</strong>
  </div>
</div>

<div *ngIf="resumenMensual.length > 0" style="margin-bottom: 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
  <div style="padding: 1rem; background: var(--bg-surface-hover); border-bottom: 1px solid var(--border-color);">
    <h4 style="margin: 0; font-size: 1rem; color: var(--text-color);"><i class="ri-bar-chart-box-line text-primary"></i> Resumen por Mes</h4>
  </div>
  <div style="display: flex; overflow-x: auto; padding: 1rem; gap: 1rem;">
    <div *ngFor="let mes of resumenMensual" style="min-width: 150px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem;">
      <strong style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem;">Mes: {{ mes.mes }}</strong>
      <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
        <span style="color: var(--text-muted);">Ingresos:</span> <strong style="color: var(--color-success);">$ {{ formatValor(mes.ingresos) }}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
        <span style="color: var(--text-muted);">Egresos:</span> <strong style="color: var(--color-danger);">$ {{ formatValor(mes.egresos) }}</strong>
      </div>
    </div>
  </div>
</div>
`;

// Modify grid to include payments history
const gridContentModified = gridContent.replace(
  '<!-- PANEL DERECHO: DETALLE DE COBRO & CALCULADORA -->',
  `<!-- PANEL DERECHO: DETALLE DE COBRO & CALCULADORA -->`
).replace(
  '<div *ngIf="obligacionesComunero.length === 0"',
  `<div *ngIf="pagosComunero.length > 0" style="margin-top: 1.5rem;">
     <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--text-color);">
       <i class="ri-history-line text-primary"></i> Historial de Pagos Realizados ({{ pagosComunero.length }})
     </h5>
     <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
       <div *ngFor="let ob of pagosComunero" style="padding: 0.75rem 1rem; border: 1.5px solid var(--border-color); background: var(--bg-surface-hover); border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
         <div>
           <strong style="display: block; font-size: 0.88rem; color: var(--text-color);">
             {{ ob.concepto_nombre || ob.concepto || 'Obligación' }}
           </strong>
           <span style="font-size: 0.75rem; color: var(--text-muted);">
             Pagado en: {{ ob.fecha_pago ? ob.fecha_pago : 'Recientemente' }}
           </span>
         </div>
         <div style="text-align: right;">
           <span class="badge badge--success" style="font-size: 0.7rem; margin-bottom: 0.2rem;">PAGADA</span>
           <strong style="display: block; font-size: 1rem; color: var(--text-color);">$ {{ formatValor(ob.valor) }}</strong>
         </div>
       </div>
     </div>
   </div>
   <div *ngIf="obligacionesComunero.length === 0"`
);

// Now we replace the finanzas-historial table with our new layout
const finanzasHistorialStart = content.indexOf('<!-- TAB 1: COBROS E INGRESOS (HISTORIAL & AUDITORÍA) -->');
const finanzasEgresosStart = content.indexOf('<!-- TAB 2: EGRESOS Y COMPRAS (HISTORIAL) -->');

if (finanzasHistorialStart !== -1 && finanzasEgresosStart !== -1) {
  content = 
    content.substring(0, finanzasHistorialStart) + 
    '<!-- TAB 1: COBROS E INGRESOS (BUSCADOR COMUNERO) -->\n' +
    '<div *ngIf="subTabFinanzas === \'INGRESOS\'" class="finanzas-historial">\n' +
    totalesYResumenHTML + '\n' +
    gridContentModified + '\n' +
    '</div>\n\n' +
    content.substring(finanzasEgresosStart);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("HTML successfully updated");
