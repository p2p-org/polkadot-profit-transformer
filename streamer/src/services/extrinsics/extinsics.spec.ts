import { ExtrinsicsService } from './extrinsics'
import { KafkaModule } from '@modules/kafka'

jest.mock('@modules/kafka')

KafkaModule.inject = jest.fn(() => new KafkaModule())

test('extractExtrinsics', async () => {
	const sendExtrinsicsData = jest.spyOn(KafkaModule.prototype, 'sendExtrinsicsData')
	const events = [{
		phase: {
			isApplyExtrinsic: true,
			asApplyExtrinsic: {
				eq(idx: number) {
					return idx % 2
				}
			}
		}
	}]

	const extrinsics = [{
		method: {
			method: 'set',
			section: 'assadf'
		},
		era: {
			isMortalEra: true,
			asMortalEra: {
				period: {
					toNumber() {
						return 1
					}
				},
				phase: {
					toNumber() {
						return 2
					}
				}
			}
		},
		isSigned: true,
		signer: {
			toString() {
				return 'asdfasdf'
			}
		},
		tip: {
			toNumber() {
				return 1
			}
		},
		nonce: {
			toNumber() {
				return 2
			}
		},
		toHuman() {
			return 'abba'
		}
	}, {
		method: {
			method: 'set',
			section: 'assadf'
		},
		era: {
			isMortalEra: false,
			asMortalEra: null
		},
		isSigned: false,
		signer: null,
		tip: {
			toNumber() {
				return 1
			}
		},
		nonce: {
			toNumber() {
				return 2
			}
		},
		toHuman() {
			return 'abba'
		}
	}, {
		method: {
			method: 'batch',
			section: 'assadf',
			args: [[{
				section: 'asdfasd',
				method: 'asdasdasd',
				toHuman() {
					return 'asdasd'
				},
				args: []
			}]]
		},
		era: {
			isMortalEra: true,
			asMortalEra: {
				period: {
					toNumber() {
						return 1
					}
				},
				phase: {
					toNumber() {
						return 2
					}
				}
			}
		},
		isSigned: true,
		signer: {
			toString() {
				return 'asdfasdf'
			}
		},
		tip: {
			toNumber() {
				return 1
			}
		},
		nonce: {
			toNumber() {
				return 2
			}
		},
		toHuman() {
			return 'abba'
		}
	}, {
		method: {
			method: 'batch',
			section: 'assadf',
			args: [[{
				section: 'asdfasd',
				method: 'asdasdasd',
				toHuman() {
					return 'asdasd'
				},
				args: []
			}]]
		},
		era: {
			isMortalEra: false,
			asMortalEra: null
		},
		isSigned: false,
		signer: null,
		tip: {
			toNumber() {
				return 1
			}
		},
		nonce: {
			toNumber() {
				return 2
			}
		},
		toHuman() {
			return 'abba'
		}
	}]

	const service = new ExtrinsicsService()
	await service.extractExtrinsics(
		5,
		5,
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		5,
		events,
		extrinsics
	)
	const serviceCopy = new ExtrinsicsService()

	expect(service).toBe(serviceCopy)
	expect(sendExtrinsicsData).toHaveBeenCalledTimes(1)
})
