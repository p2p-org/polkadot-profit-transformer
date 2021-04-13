const oas = require('fastify-swagger')

const apiRoutes = async (app) => {
  app.register(oas, require('./swagger'))
  app.register(require('./api/blocks'), { prefix: 'blocks' })
  app.register(require('./api/watchdog'), { prefix: 'watchdog' })
  app.get('/', async () => {
    return { api: 'v1.0' }
  })
}

module.exports = apiRoutes
