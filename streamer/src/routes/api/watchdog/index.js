import { restartFromBlockId, getStatus } from '../../../services/watchdog/watchdog'
const { getStatusSchema, watchdogRestartSchema } = require('./schemas')

const apiBlocks = async (app) => {
  app.get('/status', { schema: getStatusSchema }, async () => {
    return getStatus()
  })

  app.get('/restart/:blockId', { schema: watchdogRestartSchema }, async (request) => {
    const {
      params: { blockId }
    } = request
    return restartFromBlockId(+blockId)
  })
}

module.exports = apiBlocks