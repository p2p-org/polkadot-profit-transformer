import { environment } from '../environment'
import pino, { Logger } from 'pino'

const { LOG_LEVEL } = environment

export class LoggerModule {
	private static instance: LoggerModule

	private logger: Logger
	private constructor() {
		this.logger = pino({
			level: LOG_LEVEL,
			prettyPrint: true,
			formatters: {
				log(object) {
					console.log('object', object)
					return object
				},
				bindings(bindings) {
					console.log('bindings', bindings)
					return {
						...bindings,
						caller: LoggerModule.instance.logger.caller
					}
				}
			}
		})

		this.logger.bindings()
	}

	static async init(): Promise<void> {
		if (!LoggerModule.instance) {
			LoggerModule.instance = new LoggerModule()
		}
	}
	static inject(): Logger {
		if (!LoggerModule.instance.logger) {
			throw new Error(`You haven't initialized LoggerModule`)
		}

		return LoggerModule.instance.logger
	}
}
