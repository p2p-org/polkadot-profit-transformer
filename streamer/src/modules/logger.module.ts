import { environment } from '../environment'
import pino, { Logger } from 'pino'

const { LOG_LEVEL } = environment

export interface ILoggerModule {
	trace(msg: string): void;
	debug(msg: string): void;
	info(msg: string): void;
	warn(msg: string): void;
	error(msg: string, err?: any): void;
}

export class LoggerModule implements ILoggerModule{
	private static instance: LoggerModule

	private logger: Logger
	private constructor() {
		this.logger = pino({
			level: LOG_LEVEL,
			prettyPrint: true
		})
	}

	static async init(): Promise<void> {
		if (!LoggerModule.instance) {
			LoggerModule.instance = new LoggerModule()
		}
	}
	static inject(): Logger {
		if (!LoggerModule.instance?.logger) {
			throw new Error(`You haven't initialized LoggerModule`)
		}

		return LoggerModule.instance.logger
	}

	trace(msg: string): void {
		this.logger.trace(msg)
	}

	debug(msg: string): void {
		this.logger.debug(msg)
	}

	info(msg: string): void {
		this.logger.info(msg)
	}

	warn(msg: string): void {
		this.logger.warn(msg)
	}

	error(msg: string, err?: any): void {
		this.logger.error(msg, err)
	}
}
