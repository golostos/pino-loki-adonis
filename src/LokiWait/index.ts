import { MessageChannel } from 'node:worker_threads'
type RequestStatus = 'STARTING' | 'FINISHED' | 'ERROR'
type LokiRequest = {
  id: string;
  status: RequestStatus;
  message?: string;
}

export default class LokiWait {
  lokiRequests = new Map<string, RequestStatus>()
  messageChannel: MessageChannel | null = null

  get requests() {
    return this.lokiRequests;
  }
  get channel() {
    return this.messageChannel
  }

  set channel(messageChannel: MessageChannel) {
    this.messageChannel = messageChannel
  }

  addLokiRequest(request: LokiRequest) {
    if (request.status === 'ERROR') console.error('Loki sending error: ' + request.message)
    if (request.status === 'FINISHED') this.requests.delete(request.id)
    else this.requests.set(request.id, request.status)
  }

  awaitRequests() {
    return new Promise<void>((resolve) => {
      let interval: NodeJS.Timer;
      const stopFunction = () => {
        if (this.channel?.port2) {
          const timeout = setTimeout(process.exit, 1000);
          this.channel.port2.close()
          this.channel.port2.on('close', () => {
            clearTimeout(timeout)
          })
        }
        clearInterval(interval);
        resolve();
      }
      interval = setInterval(() => {
        if (this.requests.size) {
          if (![...this.requests.values()].some(status => status === 'STARTING')) {            
            stopFunction()
          }
        } else {
          stopFunction()
        }
      }, 5)
    })
  }
}