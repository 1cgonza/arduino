// https://developer.mozilla.org/en-US/docs/Web/API/TransformStream#anything-to-uint8array_stream

export default class TransformadorDatos {
  pedazos: string;

  constructor() {
    this.pedazos = '';
  }

  async transform(pedazo: string, controlador: TransformStreamDefaultController) {
    try {
      this.pedazos += pedazo;
      const lineas = this.pedazos.split('\r\n');
      this.pedazos = lineas.pop() as string;
      lineas.forEach((linea) => controlador.enqueue(linea));
    } catch (error) {
      console.error(`Error en la transformación: ${error}`);
    }
  }

  flush(controlador: TransformStreamDefaultController) {
    try {
      controlador.enqueue(this.pedazos);
    } catch (error) {
      console.error(`Error limpiando tubería: ${error}`);
    }
  }
}
