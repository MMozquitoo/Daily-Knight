// React Native 0.81 exporta una clase DOMException internamente pero no la
// instala como global — el polyfill de streams que usa expo-file-system
// (vía expo/virtual/streams.js) asume que ya existe, y sin esto la app
// no arranca: "ReferenceError: Property 'DOMException' doesn't exist".
// No es una configuración nuestra rota: es un hueco real de esta versión.
// Debe importarse ANTES que cualquier otro módulo en el entry point.

if (typeof (globalThis as any).DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    code: number;
    constructor(message?: string, name: string = 'Error') {
      super(message);
      this.name = name;
      this.code = 0;
    }
  }
  (globalThis as any).DOMException = DOMExceptionPolyfill;
}

export {};
