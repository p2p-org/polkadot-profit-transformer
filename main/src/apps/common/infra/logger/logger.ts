import pino from 'pino'
import { environment } from '@apps/main/environment'
import pretty from 'pino-pretty'

const streams = [{ stream: pretty() }]

export const logger = pino(
  {
    name: environment.NETWORK + '.' + environment.MODE,
    level: environment.LOG_LEVEL,
  },
  // pino.multistream(streams),
)
