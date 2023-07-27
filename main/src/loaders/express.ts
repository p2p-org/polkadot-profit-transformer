import express from 'express'
import bodyParser from 'body-parser'
import prom from 'prom-client'
import { environment } from '@/environment'
import { logger } from './logger'

export const ExpressLoader = async (): Promise<express.Application> => {
  const app = express()

  if (!app) {
    throw Error('Express init failed')
  }

  // Useful if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
  // It shows the real origin IP in the heroku or Cloudwatch logs
  app.enable('trust proxy')

  // Middleware that transforms the raw string of req.body into json
  app.use(bodyParser.json({ limit: '10mb' }))
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))

  // Health Check endpoints
  app.get('/status', (req, res) => {
    res.status(200).end()
  })

  app.get('/metrics', async function (req, res) {
    res.set('Content-Type', prom.register.contentType)
    res.end(await prom.register.metrics())
  })

  app.get('/health', (req, res) => {
    res.json({ status: 'live' })
  })

  const port = environment.REST_API_PORT
  app.listen(port, () => {
    logger.info(`✌️ Server started at http://localhost:${port}`)
  })

  return app
}
