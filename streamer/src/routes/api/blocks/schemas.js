const { errorResponse } = require('../../swagger/defaultSchema')

// Tags
const tags = ['block']

// Bodies
const bodyTrimBlocksJsonSchema = {
  type: 'object',
  properties: {
    block_numbers: {
      type: 'array',
      items: {
        type: 'number',
        minimum: 1
      }
    }
  },
  required: ['block_numbers']
}

// Params
const paramsJsonSchema = {
  type: 'object',
  properties: {
    blockId: { type: 'number' }
  },
  required: ['blockId']
}

// Methods
const getOneSchema = {
  tags,
  params: paramsJsonSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        result: { type: 'boolean' }
      }
    },
    400: errorResponse,
    500: errorResponse
  }
}

const getStatusSchema = {
  tags,
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        diff_height: { type: 'number' }
      }
    }
  }
}

const postDeleteBlocksSchema = {
  tags,
  body: bodyTrimBlocksJsonSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        result: { type: 'boolean' }
      }
    },
    400: errorResponse,
    500: errorResponse
  }
}

const postTrimSchema = {
  tags,
  params: paramsJsonSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        result: { type: 'boolean' }
      }
    },
    400: errorResponse,
    500: errorResponse
  }
}

const watchdogRestartSchema = {
  tags,
  params: paramsJsonSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        result: { type: 'boolean' }
      }
    },
    400: errorResponse,
    500: errorResponse
  }
}

module.exports = {
  getOneSchema,
  getStatusSchema,
  postDeleteBlocksSchema,
  postTrimSchema,
  watchdogRestartSchema
}
