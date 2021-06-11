import { ExtrinsicsService } from './extrinsics'

test('extractExtrinsics', async () => {
	const service = new ExtrinsicsService()
	await service.extractExtrinsics(
		5,
		5,
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		5,
		[],
		[]
	)
})
