const { BlocksService } = require('../../../services/blocks/blocks')
const { getOneSchema, getStatusSchema, postDeleteBlocksSchema, postTrimSchema } = require('./schemas')

const apiBlocks = async (app) => {
  const blocksService = new BlocksService(app)

  app.get('/update/:blockId', { schema: getOneSchema }, async (request) => {
    const {
      params: { blockId }
    } = request

    if (blockId == null) {
      const err = new Error()
      err.code = 400
      err.message = 'param :blockId is required'
      throw err
    }

    await blocksService.updateOneBlock(blockId)

    return { result: true }
  })

  app.get('/status', { schema: getStatusSchema }, async () => {
    return await blocksService.getBlocksStatus()
  })

  app.post('/delete', { schema: postDeleteBlocksSchema }, async (request) => {
    const { body } = request
    return await blocksService.removeBlocks(body.block_numbers)
  })

  app.get('/update_trim/:blockId', { schema: postTrimSchema }, async (request) => {
    const {
      params: { blockId }
    } = request
    return await blocksService.trimAndUpdateToFinalized(parseInt(blockId))
  })
}

module.exports = apiBlocks
