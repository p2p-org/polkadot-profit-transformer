import express from 'express'

import { BlocksPreloader } from '../../../modules/streamer/blocks-preloader'
import prom from 'prom-client'
import { environment } from '../environment'

export type StakingProcessorRestApi = ReturnType<typeof StakingProcessorRestApi>

export const StakingProcessorRestApi = (/* deps: { blocksPreloader: BlocksPreloader } */) => {
  // const { blocksPreloader } = deps

  const port = environment.REST_API_PORT
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

      // app.get('/processEra/:eraId', async (req, res) => {
      //   if (isNaN(Number(req.params.eraId))) return res.json({ error: 'blockId must be a number' })
      //   // await stakingProcessor.process(Number(req.params.eraId))
      //   // rabbitMQ.send(QUEUES.Staking, req.params.eraId)
      //   return res.json({ result: 'ok' })
      // })
      app.listen(port, () => {
        console.log(`server started at http://localhost:${port}`)
      })
    },
  }
}
