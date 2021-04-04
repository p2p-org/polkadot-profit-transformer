export interface IConfigService {
	bootstrapConfig(): Promise<true | undefined>;
}
