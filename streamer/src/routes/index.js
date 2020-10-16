const oas = require('fastify-swagger')

const apiRoutes = async (app, options) => {
  app.register(oas, require('./swagger'))
  app.register(require('./api/blocks'), { prefix: 'blocks' })
  app.get('/', async (request, reply) => {
    return { api: 'v1.0' }
  })
}

module.exports = apiRoutes
