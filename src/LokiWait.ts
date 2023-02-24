import { MessageChannel } from 'node:worker_threads'
type LokiRequest = { id: string; status: string }

export default class LokiWait {
  lokiRequests: LokiRequest[] = []
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
    const existingRequest = this.requests.find(r => r.id === request.id)
    if (existingRequest) existingRequest.status = request.status
    else this.lokiRequests.push(request);
  }
  
  awaitRequests() {
    return new Promise<void>((resolve) => {
      let interval: NodeJS.Timer;
      const stopFunction = () => {
        if (this.requests.length) {
          const timeout = setTimeout(() => {
            process.exit()
          }, 1000);
          this.channel.port2.close()
          this.channel.port2.on('close', () => {
            clearTimeout(timeout)
          })
        }
        clearInterval(interval);
        resolve();
      }
      interval = setInterval(() => {
        if (this.requests.length) {
          if (this.requests.every(request => request.status.startsWith('FINISHED'))) {
            stopFunction()
          } else if (this.requests.some(request => request.status.startsWith('ERROR'))
            && !this.requests.some(request => request.status.startsWith('STARTING'))) {
            this.requests
              .filter(request => request.status.startsWith('ERROR'))
              .forEach(request => console.error(request.status))
            stopFunction()
          }
        } else {
          stopFunction()
        }
      }, 5)
    })
  }
}