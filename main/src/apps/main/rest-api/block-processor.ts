import express from 'express'

import prom from 'prom-client'
import { environment } from '../environment'

export type RestApi = ReturnType<typeof BlockProcessorApi>

export const BlockProcessorApi = (/* deps: { blocksPreloader: BlocksPreloader } */) => {
  // const { blocksPreloader } = deps

  const port = process.env.REST_API_PORT || environment.REST_API_PORT
  return {
    init: async () => {
      const app = express()

      app.get('/metrics', async function (req, res) {
        res.set('Content-Type', prom.register.contentType)
        res.end(await prom.register.metrics())
      })

      app.get('/health', (req, res) => {
        res.json({ status: 'live' })
      })

      app.listen(port, () => {
        console.log(`server started at http://localhost:${port}`)
      })
    },
  }
}
