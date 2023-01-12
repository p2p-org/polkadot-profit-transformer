import { Service } from 'typedi'
import '@polkadot/api-augment'
import { environment } from '@/environment'
import needle from 'needle'

@Service()
export class MonitoringSlackHelper {

  public async sendMessage(message: string): Promise<void> {
    const headers = { 'content-type': 'application/json' }
    try {
      await needle.post(
        environment.SLACK_WEBHOOK || '',
        JSON.stringify({ 'text': `[${environment.NETWORK}]: ${message.substr(0, 200)}` }),
        { headers, timeout: 1000 * 20 }
      )
    } catch (e) {
      console.error('Slack send error', e)
    }
  }

}

