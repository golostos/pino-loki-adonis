import build from 'pino-abstract-transport'
import { PinoLog, PinoLokiOptionsContract } from './@types'
import { LogPusher } from './LogPusher'
import { MessagePort, parentPort } from 'node:worker_threads';

export default async function (options: PinoLokiOptionsContract) {
  options.timeout ??= 30000
  options.silenceErrors ??= false
  options.batching ??= true
  options.interval ??= 5
  options.replaceTimestamp ??= false
  options.portWait ??= false
  options.propsToLabels ??= []
  const logPusher = new LogPusher(options)

  return build((source: any) => {
    let port: MessagePort
    const portWait = new Promise((resolve) => {
      const interval = setInterval(() => {
        if (port) {
          clearInterval(interval)
          resolve(port)
        }
      }, 5)
    })
    if (parentPort && options.portWait) parentPort.on('message', (message) => {
      if (typeof message === 'object' && message?.port instanceof MessagePort) {
        port = message.port
      }
    });

    let pinoLogBuffer: PinoLog[] = []

    if (options.batching) {
      setInterval(() => {
        if (pinoLogBuffer.length === 0) {
          return;
        }
        logPusher.push(pinoLogBuffer, port);
        pinoLogBuffer = [];
      }, options.interval * 1e3);
    }
    source.on('data', async function (obj: PinoLog) {
      if (options.portWait) await portWait;
      if (options.batching) {
        pinoLogBuffer.push(obj);
        return;
      }
      logPusher.push(obj, port);
    })
  })
}