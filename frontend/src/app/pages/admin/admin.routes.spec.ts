import { ADMIN_ROUTES } from './admin.routes';
import { GRUPOS_FINANZAS } from './components/finanzas/grupos-finanzas';

const destino = (path: string) => ADMIN_ROUTES.find((r) => r.path === path)?.redirectTo;
const posicion = (path: string) => ADMIN_ROUTES.findIndex((r) => r.path === path);

describe('Rutas de finanzas', () => {
  it('una sección pedida en otro apartado redirige al apartado que la contiene (H-31)', () => {
    expect(destino('cobros/facturacion')).toBe('ajustes/facturacion');
    expect(destino('historial/facturacion')).toBe('ajustes/facturacion');
    expect(destino('ajustes/cobrar')).toBe('cobros/cobrar');
    expect(destino('cobros/pagos')).toBe('historial/pagos');
  });

  it('el nombre anterior agua-anual lleva a la facturación anual desde cualquier apartado', () => {
    for (const grupo of GRUPOS_FINANZAS) {
      expect(destino(`${grupo.id}/agua-anual`)).toBe('ajustes/facturacion');
    }
  });

  it('las secciones de su propio apartado no se redirigen y las redirecciones van antes de :seccion', () => {
    for (const grupo of GRUPOS_FINANZAS) {
      for (const seccion of grupo.secciones) {
        expect(destino(`${grupo.id}/${seccion.id}`)).toBeUndefined();
      }
      expect(posicion(`${grupo.id}/agua-anual`)).toBeLessThan(posicion(`${grupo.id}/:seccion`));
    }
  });
});
