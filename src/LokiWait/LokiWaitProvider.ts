import { ServiceProvider } from '@adonisjs/fold'
import LokiWait from '.'
import type Logger from 'adonis-types/Framework/Logger/Facade'

export default class LokiWaitProvider extends ServiceProvider {
  register() {
    this.app.singleton('LokiWait', () => {
      const logger: Logger = this.app.use('Logger')
      return new LokiWait(logger)
    })
  }
}