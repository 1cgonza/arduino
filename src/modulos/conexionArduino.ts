import TransformadorDatos from './TransformadorDatos';

const DEFAULT_BAUDRATE = 57600;

const DEFAULT_CONSTRUCTOR_OBJECT = {
  baudRate: DEFAULT_BAUDRATE,
  requestElement: null,
  transformer: new TransformadorDatos(),
  logIncomingSerialData: false,
  logOutgoingSerialData: false,
  parseStringsAsNumbers: true,
  warnAboutUnregisteredEvents: true,
  newLineCharacter: '\n',
  filters: [],
};

function createConnectionInstance(configuration) {
  let puerto: SerialPort;
  let writer: WritableStreamDefaultWriter<string>;
  let _listeners = {};

  async function startConnection() {
    if (ready()) throw new Error('Serial connection has already been established.');

    try {
      puerto = await navigator.serial.requestPort({ filters: configuration.filters });
      await puerto.open({
        baudRate: configuration.baudRate,
      });
    } catch (e) {
      throw new Error(e);
    }

    const textEncoder = new TextEncoderStream();
    writer = textEncoder.writable.getWriter();
    const decoder = new TextDecoderStream();
    // TODO create methods to close the connection and release the port using these
    const writableStreamClosed = textEncoder.readable.pipeTo(puerto.writable);
    const readableStreamClosed = puerto.readable.pipeTo(decoder.writable);
    const inputStream = decoder.readable;
    const reader = inputStream.pipeThrough(new TransformStream(configuration.transformer)).getReader();

    readLoop(reader)
      .then((response) => {
        console.log(response, 'readLoop done');
      })
      .catch((e) => {
        console.error(
          'Could not read serial data. Please make sure the same baud rate is used on device (Serial.begin()) and library. Library currently uses baud rate',
          configuration.baudRate,
          "Please also make sure you're not sending too much serial data. Consider using (a higher) delay() to throttle the amount of data sent."
        );
        console.error(e);
      });
  }

  function on(name, callback) {
    if (!_listeners[name]) {
      _listeners[name] = [];
    }
    _listeners[name].push(callback);
    return [name, callback];
  }

  function removeListener(name, callbackToRemove) {
    if (typeof name === 'object' && typeof callbackToRemove === 'undefined') {
      callbackToRemove = name[1];
      name = name[0];
    }

    if (!_listeners[name]) {
      throw new Error('There is no listener named ' + name + '.');
    }

    const length = _listeners[name].length;

    _listeners[name] = _listeners[name].filter((listener) => listener !== callbackToRemove);
    return length !== _listeners[name].length;
  }

  // Remove all listeners of event name
  function removeListeners(name) {
    if (typeof name !== 'string') {
      throw new Error(
        'removeListeners expects a string as parameter, which will be used to remove all listeners of that event.'
      );
    }
    const length = _listeners[name].length;
    _listeners[name] = [];
    return length > 0;
  }

  function ready() {
    return puerto.readable && puerto.writable;
  }

  function writable() {
    return puerto.writable;
  }

  function readable() {
    return puerto.readable;
  }

  async function send(name, data) {
    if (!puerto.writable) return;

    // If only 1 parameter is supplied, it's raw data.
    if (typeof data === 'undefined') {
      if (configuration.logOutgoingSerialData) {
        console.log(name);
      }

      if (configuration.parseStringsAsNumbers) {
        name = parseAsNumber(name);
      }

      return sendData(name);
    }

    // If data is an object, parse its keys as ints
    if (configuration.parseStringsAsNumbers) {
      data = parseAsNumber(data);
    }

    const event = [name, data];
    const stringified = JSON.stringify(event);
    if (configuration.logOutgoingSerialData) {
      console.log(stringified);
    }
    return writer.write(stringified + configuration.newLineCharacter);
  }

  async function sendEvent(name) {
    return send('_e', name);
  }

  async function sendData(data) {
    return send('_d', data);
  }

  function emit(name, data) {
    if (configuration.warnAboutUnregisteredEvents && !_listeners[name]) {
      return console.warn('Event ' + name + ' has been received, but it has never been registered as listener.');
    }
    _listeners[name].forEach((callback) => callback(data));
  }

  async function readLoop(reader) {
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
          if (configuration.logIncomingSerialData) {
            console.log(json);
          }
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
        } else {
          if (configuration.logIncomingSerialData) {
            console.log(value);
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

  return {
    emit,
    on,
    puerto,
    ready,
    readable,
    removeListener,
    removeListeners,
    send,
    sendData,
    sendEvent,
    startConnection,
    writable,
    writer,
  };
}

export default function (args = {}) {
  if (!navigator.serial) {
    throw new Error('Este explorador no tiene Serial, usa Chrome o actualiza para ver si funciona.');
  }

  if (typeof args === 'number') {
    args = {
      ...DEFAULT_CONSTRUCTOR_OBJECT,
      baudRate: args,
    };
  } else if (typeof args === 'undefined') {
    args = DEFAULT_CONSTRUCTOR_OBJECT;
  } else if (typeof args === 'object') {
    // constructor object, override defaults
    args = {
      ...DEFAULT_CONSTRUCTOR_OBJECT,
      ...args,
    };
  }

  const configuration = args;
  console.log(configuration);
  return createConnectionInstance(configuration);
}
