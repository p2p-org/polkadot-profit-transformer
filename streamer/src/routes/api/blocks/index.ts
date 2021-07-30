import { BlocksService } from '../../../services/blocks/blocks'
import { getOneSchema, getStatusSchema, postDeleteBlocksSchema, postTrimSchema } from './schemas'
import { FastifyInstance } from 'fastify'
import { HttpError } from '../../../common/errors'

const apiBlocks = async (app: FastifyInstance) => {
  const blocksService = BlocksService.inject()

  app.get('/update/:blockId', { schema: getOneSchema }, async (request) => {
    const {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      params: { blockId }
    } = request

    if (blockId == null) {
      throw new HttpError('param :blockId is required', 400)
    }

    await blocksService.processBlock(parseInt(blockId))

    return { result: true }
  })

  app.get('/status', { schema: getStatusSchema }, async () => {
    return await blocksService.getBlocksStatus()
  })

  app.post('/delete', { schema: postDeleteBlocksSchema }, async (request) => {
    const { body } = request
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await blocksService.removeBlocks(body.block_numbers)
  })

  app.get('/update_trim/:blockId', { schema: postTrimSchema }, async (request) => {
    const {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      params: { blockId }
    } = request
    return await blocksService.trimAndUpdateToFinalized(parseInt(blockId))
  })
}

module.exports = apiBlocks
