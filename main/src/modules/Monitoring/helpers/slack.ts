import { Service } from 'typedi'
import '@polkadot/api-augment'
import { environment } from '@/environment'
import needle from 'needle'

@Service()
export class MonitoringSlackHelper {
  public async sendMessage(message: string): Promise<void> {
    await this.sendMessageSlack(message);
    await this.sendMessageOpsGenie(message);
  }

  public async sendMessageSlack(message: string): Promise<void> {
    const headers = { 'content-type': 'application/json' }
    try {
      await needle.post(
        environment.SLACK_WEBHOOK || '',
        JSON.stringify({ text: `[${environment.NETWORK}]: ${message.substr(0, 200)}` }),
        { headers, timeout: 1000 * 20 },
      )
    } catch (e) {
      console.error('Slack send error', e)
    }
  }

  public async sendMessageOpsGenie(message: string): Promise<void> {
    const headers = {
      'content-type': 'application/json',
      'Authorization': `GenieKey ${environment.OPSGENIE_KEY || ''}`
    }
    try {
      await needle.post(
        "https://api.opsgenie.com/v2/alerts",
        JSON.stringify({
          message: "MBELT3 indexer problem",
          description: `[${environment.NETWORK}]: ${message.substr(0, 200)}`,
          tags: ["mbelt3", environment.NETWORK],
          entity: "MBELT3",
          priority: "P2"
        }),
        { headers, timeout: 1000 * 20 },
      )
    } catch (e) {
      console.error('OpsGenie send error', e)
    }
  }
}
