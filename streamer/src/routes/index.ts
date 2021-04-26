import oas from 'fastify-swagger'
import { FastifyInstance } from 'fastify'

export default async (app: FastifyInstance): Promise<void> => {
  app.register(oas, require('./swagger'))
  app.register(require('./api/blocks'), { prefix: 'blocks' })
  app.register(require('./api/watchdog'), { prefix: 'watchdog' })
  app.get('/', async () => {
    return { api: 'v1.0' }
  })
}
