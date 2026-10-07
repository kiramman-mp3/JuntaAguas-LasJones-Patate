/**
 * Storage en memoria para pruebas. Node 26 expone un localStorage global sin
 * almacenamiento que oculta el de jsdom, así que las pruebas lo reemplazan con este.
 */
export function almacenamientoEnMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => { datos.delete(k); },
    setItem: (k, v) => { datos.set(k, String(v)); }
  };
}
