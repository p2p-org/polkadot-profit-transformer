import { environment } from '../environment'
import pino, { BaseLogger } from 'pino'

const { LOG_LEVEL } = environment

export class LoggerModule {
	private static instance: LoggerModule

	private logger: BaseLogger
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
	static inject(): BaseLogger {
		if (!LoggerModule.instance.logger) {
			throw new Error(`You haven't initialized LoggerModule`)
		}

		return LoggerModule.instance.logger
	}
}
