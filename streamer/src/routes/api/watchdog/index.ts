import { restartFromBlockId, getStatus } from '../../../services/watchdog/watchdog'
import { getStatusSchema, watchdogRestartSchema } from './schemas'
import { FastifyInstance } from 'fastify'

const apiBlocks = async (app: FastifyInstance) => {
  app.get('/status', { schema: getStatusSchema }, async () => {
    return getStatus()
  })

  app.get('/restart/:blockId', { schema: watchdogRestartSchema }, async (request) => {
    const {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      params: { blockId }
    } = request
    return restartFromBlockId(+blockId)
  })
}

module.exports = apiBlocks
