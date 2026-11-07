import { CampoErrorDirective } from './campo-error.directive';
import { EnvioValidadoDirective } from './envio-validado.directive';
import { MascaraDirective } from './mascara.directive';

/**
 * Comportamiento común de los formularios: errores bajo cada campo, revisión al enviar y
 * máscaras de entrada. Se agrega junto a `FormsModule` en los componentes con formularios.
 */
export const AYUDAS_FORMULARIO = [CampoErrorDirective, EnvioValidadoDirective, MascaraDirective];
