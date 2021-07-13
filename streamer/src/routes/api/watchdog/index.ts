import { WatchdogService } from '../../../services/watchdog/watchdog'
import { getStatusSchema, watchdogRestartSchema } from './schemas'
import { FastifyInstance } from 'fastify'

const apiBlocks = async (app: FastifyInstance) => {
  app.get('/status', { schema: getStatusSchema }, async () => {
    const watchdogService = WatchdogService.getInstance()
    return watchdogService.getStatus()
  })

  app.get('/restart/:blockId', { schema: watchdogRestartSchema }, async (request) => {
    const {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      params: { blockId }
    } = request
    const watchdogService = WatchdogService.getInstance()
    return watchdogService.restartFromBlockId(+blockId)
  })
}

module.exports = apiBlocks
