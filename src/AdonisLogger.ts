import _ from 'lodash';
import { pino, Logger } from 'pino';
import { MessageChannel } from 'node:worker_threads';
import type { Worker } from 'node:worker_threads';
import { nanoid } from 'nanoid';
import { ioc } from '@adonisjs/fold';
import type LokiWait from './LokiWait';

export type PinoConfig = {
  driver: "loki" | "task";
  name: string;
  level: "info" | "fatal" | "error" | "warn" | "debug";
  url: string;
  timestamp: string;
  interval?: number;
  batching?: boolean;
  portWait?: boolean;
}

const lokiWait: LokiWait = ioc.use('LokiWait')

/**
 * Winston console transport driver for @ref('Logger').
 * All the logs will be written to `stdout` or
 * `stderr` based upon the log level.
 */
export default class PinoLokiAdonis {
  private config: PinoConfig
  private logger: Logger

  setConfig(config: PinoConfig) {
    /**
     * Merging user config with defaults.
     */
    this.config = {
      name: 'app',
      level: 'info',
      timestamp: new Date().toLocaleTimeString(),
      ...config
    }

    const lokiUrl = new URL(this.config.url)
    const transport = pino.transport({
      targets: [
        {
          target: "pino-loki-adonis",
          options: {
            batching: this.config.batching ?? true,
            portWait: this.config.portWait ?? false,
            interval: this.config.interval ?? 5,
            host: lokiUrl.origin,
            basicAuth: {
              username: lokiUrl.username,
              password: lokiUrl.password,
            },
            labels: {
              application: this.config.name,
              tag: this.config.name,
            },
            propsToLabels: ['code', 'group']
          },
          level: "info",
        }, {
          target: "pino-pretty",
          options: { destination: 1 },
          level: "info"
        }
      ]
    });

    if (this.config.portWait) {
      const channel = new MessageChannel();
      lokiWait.channel = channel;
      channel.port2.on('message', message => lokiWait.addLokiRequest(message));
      const worker: Worker = transport.worker
      worker.postMessage({ port: channel.port1 }, [channel.port1]);
    }

    this.logger = pino(transport)
  }

  /**
   * A list of available log levels
   */
  get levels(): ("info" | "fatal" | "error" | "warn" | "debug")[] {
    return ['fatal', 'error', 'fatal', 'error', 'warn', 'info', 'info', 'debug']
  }

  /**
   * Returns the current level for the driver
   */
  get level(): string {
    return this.logger?.level || 'info'
  }

  /**
   * Update driver log level at runtime
   */
  set level(level: string) {
    if (this.logger) this.logger.level = level
  }

  /**
   * Log message for a given level.
   */
  log(level: number, msg: string | object, ...meta: any[]) {
    const levelName = this.levels[level]
    if (msg instanceof Object && !Array.isArray(msg)) {
      const lokiLogId = nanoid()
      msg = { ...msg, lokiLogId }
      if (this.config?.portWait) lokiWait.addLokiRequest({ id: lokiLogId, status: 'STARTING' })
    }
    if (this.logger)
      this.logger[levelName](msg, ...meta)
  }
}
