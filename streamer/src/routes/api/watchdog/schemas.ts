import { errorResponse } from '../../swagger/defaultSchema'

// Tags
const tags = ['watchdog']

// Params
const paramsJsonSchema = {
  type: 'object',
  properties: {
    blockId: { type: 'number' }
  },
  required: ['blockId']
}

// Methods

const getStatusSchema = {
  tags,
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        last_era_checked: { type: 'number' },
        current_height: { type: 'number' },
        finished_at: { type: 'number' }
      }
    }
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

export {
  getStatusSchema,
  watchdogRestartSchema
}
