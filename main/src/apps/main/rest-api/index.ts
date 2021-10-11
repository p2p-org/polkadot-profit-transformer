import { BlockProcessor } from './../../../modules/streamer/block-processor'
import { BlocksPreloader, PRELOADER_STATUS } from './../../../modules/streamer/blocks-preloader'
import express from 'express'
import { Environment } from '../environment'

export type RestApi = ReturnType<typeof RestApi>

export const RestApi = (deps: { environment: Environment; blocksPreloader: BlocksPreloader; blockProcessor: BlockProcessor }) => {
  const { environment, blockProcessor, blocksPreloader } = deps
  const app = express()
  const port = environment.REST_API_PORT
  return {
    init: async () => {
      app.get('/health', (req, res) => {
        res.json('{status: live}')
      })
      app.get('/status', (req, res) => {
        return res.json({
          status: blocksPreloader.status(),
          currentBlockId: blocksPreloader.status() === PRELOADER_STATUS.IN_PROGRESS ? blocksPreloader.currentBlock() : null,
        })
      })
      app.get('/rewind/:blockId', (req, res) => {
        if (isNaN(Number(req.params.blockId))) return res.json({ error: 'blockId must be a number' })
        blocksPreloader.rewind(Number(req.params.blockId))
        return res.json({ result: 'ok' })
      })
      app.get('/processBlock/:blockId', async (req, res) => {
        if (isNaN(Number(req.params.blockId))) return res.json({ error: 'blockId must be a number' })
        await blockProcessor(Number(req.params.blockId))
        return res.json({ result: 'ok' })
      })
      app.listen(port, () => {
        console.log(`server started at http://localhost:${port}`)
      })
    },
  }
}
