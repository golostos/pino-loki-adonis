import { ServiceProvider } from '@adonisjs/fold'
import LokiWait from './LokiWait'

export default class LokiWaitProvider extends ServiceProvider {
  register() {
    this.app.singleton('LokiWait', () => {
      return new LokiWait()
    })
  }
}