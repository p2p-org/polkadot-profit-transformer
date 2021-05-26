export enum EBlockServiceError {
	SYNC_IN_PROCESS,
	BLOCK_PROCESS_ERROR,
	BLOCKHASH_NOT_FOUND,
	BLOCK_NOT_FOUND,
	KAFKA_SEND_ERROR,
	REMOVE_BLOCK_ERROR,
}

export class BlockServiceError extends Error {
	private service: string;
	private code: EBlockServiceError;
	
	constructor(code: EBlockServiceError) {
		super(EBlockServiceError[code])
		Error.captureStackTrace(this, BlockServiceError)

		this.name = this.constructor.name
		this.service = 'BlockService'
		this.code = code
	}
}
