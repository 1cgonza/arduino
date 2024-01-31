import './scss/estilos.scss';
import conexionArduino from './modulos/conexionArduino';
import TransformadorDatos from './modulos/TransformadorDatos';

export const convertirEscala = (
  valor: number,
  escalaBaseMin: number,
  escalaBaseMax: number,
  escalaDestinoMin: number,
  escalaDestinoMax: number
): number => {
  return (
    ((valor - escalaBaseMin) * (escalaDestinoMax - escalaDestinoMin)) / (escalaBaseMax - escalaBaseMin) +
    escalaDestinoMin
  );
};

// async function inicio() {
//   if ('serial' in navigator) {
//     try {
//       const puerto = await navigator.serial.requestPort();
//       await puerto.open({ baudRate: 57600 });
//       const lector = puerto.readable.getReader();
//       const decodificador = new TextDecoder();
//       // console.log(lector);
//       while (puerto.readable) {
//         // const reader = puerto.readable.getReader();

//         try {
//           while (true) {
//             const { value, done } = await lector.read();

//             if (done) {
//               // |reader| has been canceled.
//               break;
//             }
//             console.log(decodificador.decode(value));
//           }
//         } catch (error) {
//           // Handle |error|…
//         } finally {
//           lector.releaseLock();
//         }
//       }

//       async function leerMensaje() {
//         try {
//           const datosLector = await lector.read();
//           return;
//         } catch (error) {
//           return `Error en lectura de datos: ${error}`;
//         }
//       }
//     } catch (error) {
//       console.error('Problema abriendo el puerto serial', error);
//     }
//   }
// }

// document.body.onclick = () => {
//   console.log('inicio');
//   inicio().catch(console.error);
// };
let rotacion = 180;
let sentido = 1;
let puerto: SerialPort;
let writer: WritableStreamDefaultWriter<string>;
const _listeners = {};
const frecuencia = 57600;

const titulo = document.getElementById('titulo') as HTMLTitleElement;
// const conexion = conexionArduino();
titulo.onclick = () => {
  conectarDispositivo().catch(console.error);
};

function puertoAbierto() {
  return puerto && puerto.readable && puerto.writable;
}

async function conectarDispositivo() {
  if (puertoAbierto()) throw new Error('Conexión con el dispositivo ya fue creada.');

  try {
    puerto = await navigator.serial.requestPort();
    await puerto.open({
      baudRate: frecuencia,
    });
  } catch (error) {
    throw new Error(error);
  }

  const textEncoder = new TextEncoderStream();
  writer = textEncoder.writable.getWriter();
  const decoder = new TextDecoderStream();
  // TODO create methods to close the connection and release the port using these
  const writableStreamClosed = textEncoder.readable.pipeTo(puerto.writable);
  const readableStreamClosed = puerto.readable.pipeTo(decoder.writable);
  const inputStream = decoder.readable;
  const reader = inputStream.pipeThrough(new TransformStream(new TransformadorDatos())).getReader();

  readLoop(reader)
    .then((response) => {
      console.log(response, 'readLoop done');
    })
    .catch((e) => {
      console.error(
        'Could not read serial data. Please make sure the same baud rate is used on device (Serial.begin()) and library. Library currently uses baud rate',
        frecuencia,
        "Please also make sure you're not sending too much serial data. Consider using (a higher) delay() to throttle the amount of data sent."
      );
      console.error(e);
    });
}

async function readLoop(reader: ReadableStreamDefaultReader) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      let json = null;
      try {
        json = JSON.parse(value);
      } catch {
        // Ignore bad reads
      }
      if (json) {
        // If it's an array, handle accordingly
        if (typeof json === 'object') {
          if (json[0] === '_w') {
            console.warn('[ARDUINO] ' + json[1]);
            continue;
          }

          if (json[0] === '_l') {
            console.log('[ARDUINO] ' + json[1]);
            continue;
          }

          if (json[0] === '_e') {
            console.error('[ARDUINO] ' + json[1]);
            continue;
          }

          // Reserved event name 'd': Data transfer. Register a listener "data" to listen to it.
          if (json[0] === '_d') {
            emit('data', json[1]);
            continue;
          }

          emit(json[0], json[1]);
        }

        // If it's just a string, just call the event
        else if (typeof json === 'string') {
          emit(json, null);
        }
      }
    }
    if (done) {
      console.log('[readLoop] DONE', done);
      reader.releaseLock();
      break;
    }
  }
}

function emit(name: string, data: number | null) {
  if (!_listeners[name]) {
    return console.warn('Event ' + name + ' has been received, but it has never been registered as listener.');
  }

  _listeners[name].forEach((callback) => callback(data));
}
