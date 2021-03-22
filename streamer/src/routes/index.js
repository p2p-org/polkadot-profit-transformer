const oas = require('fastify-swagger')

const apiRoutes = async (app) => {
  app.register(oas, require('./swagger'))
  app.register(require('./api/blocks'), { prefix: 'blocks' })
  app.get('/', async () => {
    return { api: 'v1.0' }
  })
}

module.exports = apiRoutes
