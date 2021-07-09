import { environment } from '../environment'
import pino, { Bindings, Logger, LogFn } from 'pino'

const { LOG_LEVEL } = environment

export interface ILoggerModule {
  trace: LogFn
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
  fatal: LogFn
  child(bindings: Bindings): pino.Logger
}

export class LoggerModule implements ILoggerModule {
  private static instance: LoggerModule

  private logger: Logger
  constructor() {
    this.logger = pino({
      level: LOG_LEVEL
      // prettyPrint: true
    })
  }

  static async init(): Promise<void> {
    if (!LoggerModule.instance) {
      LoggerModule.instance = new LoggerModule()
    }
  }
  static inject(): LoggerModule {
    if (!LoggerModule.instance?.logger) {
      throw new Error(`You haven't initialized LoggerModule`)
    }

    return LoggerModule.instance
  }

  trace(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.trace(msg, args)
  }

  debug(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.info(msg, args)
  }

  info(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.info(msg, args)
  }

  warn(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.warn(msg, args)
  }

  error(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.error(msg, args)
  }

  fatal(...params: Parameters<LogFn>): void {
    const [msg, ...args] = params
    this.logger.fatal(msg, args)
  }

  child(bindings: Bindings): pino.Logger {
    return this.logger.child(bindings)
  }
}
