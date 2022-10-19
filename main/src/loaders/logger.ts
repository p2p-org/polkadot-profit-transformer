import pino from 'pino'
import pretty from 'pino-pretty'
import { environment } from '@/environment'

const streams = [{ stream: pretty() }]

export const logger = pino(
  {
    name: environment.NETWORK + '.' + environment.MODE,
    level: environment.LOG_LEVEL,
  },
  // pino.multistream(streams),
)
