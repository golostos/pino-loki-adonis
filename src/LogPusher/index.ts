import axios, { AxiosInstance } from 'axios'
import { PinoLog, PinoLokiOptionsContract } from '../@types'
import { LogBuilder } from '../LogBuilder'
import { MessagePort } from 'node:worker_threads';
import type { LokiRequest } from '../LokiWait';

/**
 * Responsible for pushing logs to Loki
 */
export class LogPusher {
  private options: PinoLokiOptionsContract
  private logBuilder: LogBuilder
  private client: AxiosInstance

  constructor(options: PinoLokiOptionsContract) {
    this.options = options
    this.client = axios.create({
      baseURL: this.options.host,
      timeout: this.options.timeout,
    })

    if (this.options.basicAuth) {
      this.client.defaults.auth = this.options.basicAuth
    }
    const propsToLabels = options.propsToLabels || []
    this.logBuilder = new LogBuilder(propsToLabels)
  }

  /**
   * Handle push failures
   */
  private handleFailure(err: any) {
    if (this.options.silenceErrors === true) {
      return '';
    }
    if (err.response) {
      return `Attempting to send log to Loki failed with status '${err.response.status}: ${err.response.statusText}' returned reason: ${JSON.stringify(err.response.data)}`
    }
    if (err.isAxiosError === true) {
      return `Attempting to send log to Loki failed. Got an axios error, error code: '${err.code}' message: ${err.message}`
    }
    return "Got unknown error when trying to send log to Loki, error output:" + err;
  }

  /**
   * Push one or multiples logs entries to Loki
   */
  public async push(logs: PinoLog[] | PinoLog, port: MessagePort | undefined) {
    if (!Array.isArray(logs)) {
      logs = [logs];
    }
    const lokiLogs = logs.map(
      (log) => this.logBuilder.build(log, this.options.replaceTimestamp, this.options.labels)
    );
    try {
      const response = await this.client.post(`/loki/api/v1/push`, { streams: lokiLogs });
      if (port) logs.forEach(log => {
        if (typeof log.lokiLogId === 'string' && log.lokiLogId.length) {
          const message: LokiRequest = {
            id: log.lokiLogId,
            status: 'FINISHED',
            log
          }
          port.postMessage(message)
        }
      });
      return response;
    } catch (err) {
      const errorMsg = this.handleFailure(err);
      if (port) logs.forEach(log => {
        if (typeof log.lokiLogId === 'string' && log.lokiLogId.length) {
          const message: LokiRequest = {
            id: log.lokiLogId,
            status: 'ERROR',
            message: errorMsg,
            log
          }
          port.postMessage(message)
        }
      })
      else console.error(errorMsg);
    }
  }
}
