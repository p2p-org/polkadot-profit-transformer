import WatchdogService from '../../../services/watchdog/watchdog'
const { getStatusSchema, watchdogRestartSchema } = require('./schemas')

const apiBlocks = async (app) => {
  app.get('/status', { schema: getStatusSchema }, async () => {
    const watchdogService = WatchdogService.getInstance(app)
    return watchdogService.getStatus()
  })

  app.get('/restart/:blockId', { schema: watchdogRestartSchema }, async (request) => {
    const {
      params: { blockId }
    } = request
    const watchdogService = WatchdogService.getInstance(app)
    return watchdogService.restartFromBlockId(+blockId)
  })
}

module.exports = apiBlocks
