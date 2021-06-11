import { KafkaModule } from './kafka.module'
import { Kafka } from 'kafkajs'
import { AnyJson } from '@polkadot/types/types'
import { Compact } from '@polkadot/types'
import { BlockNumber } from '@polkadot/types/interfaces'

const bus = new Map()
jest.mock('kafkajs')

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
Kafka.prototype.producer = jest.fn(() => ({
	async connect() {
		jest.fn()
	},
	send({ topic, messages }) {
		if (bus.get(topic)) bus.get(topic).push(...messages)
		else bus.set(topic, [...messages])
	}
}))

test('KafkaModule', async () => {
	expect(KafkaModule.inject).toThrowError(`You haven't initialized KafkaModule`)
	await KafkaModule.init()
	const module = KafkaModule.inject()
	await module.sendStakingErasData({
		era: 4,
		session_start: 5,
		total_reward: '5',
		total_stake: '5',
		total_reward_points: 5
	})

	await module.sendSessionData(5, [{
		account_id: 'a',
		era: 5,
		total: '1',
		own: '5',
		nominators_count: 5,
		reward_points: 5,
		reward_dest: 'a',
		reward_account_id: 'asas',
		prefs: { a: 'asdasd' }
	}], [{
		account_id: 'asd',
		era: 5,
		validator: 'asd',
		is_clipped: false,
		value: '5',
		reward_dest: 'asd',
		reward_account_id: 'asd'
	}], 555)

	await module.sendExtrinsicsData('123', [{
		id: '12321',
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		block_id: 555,
		parent_id: '12321',
		session_id: 555,
		era: 555,
		section: 555,
		method: 555,
		mortal_period: null,
		mortal_phase: null,
		is_signed: true,
		signer: '12321',
		tip: 555,
		nonce: 555,
		ref_event_ids: '12321',
		version: 555,
		extrinsic: 555,
		args: 555
	}])

	await module.sendBlockData({
		block: {
			header: {
				number: 5,
				hash: 'string',
				author: 'string',
				session_id: 5,
				currentEra: 5,
				era: 5,
				stateRoot: 'string',
				extrinsicsRoot: 'string',
				parentHash: 'string',
				last_log: 'string',
				digest: 'string'
			}
		},
		events: [],
		block_time: 5
	})
})
