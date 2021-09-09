import pino, { Bindings, LogFn } from 'pino'

export type Logger = {
  trace: LogFn
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
  fatal: LogFn
  child(bindings: Bindings): pino.Logger
}

export const LoggerFactory = (deps: { logLevel: string }): Logger => {
  const logger = pino({
    level: deps.logLevel
    //prettyPrint: true
  })
  return {
    trace(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.trace(msg, args)
    },

    debug(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.info(msg, args)
    },

    info(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.info(msg, args)
    },

    warn(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.warn(msg, args)
    },

    error(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.error(msg, args)
    },

    fatal(...params: Parameters<LogFn>): void {
      const [msg, ...args] = params
      logger.fatal(msg, args)
    },

    child(bindings: Bindings): pino.Logger {
      return logger.child(bindings)
    }
  }
}
