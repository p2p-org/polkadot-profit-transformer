import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { EventModel } from '@/models/event.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { GearSmartcontractsDatabaseHelper } from './helpers/database'
import { GearSmartcontractModel } from '@/models/gear_smartcontract.model'
import { GearSmartcontractMessageModel } from '@/models/gear_smartcontract_message.model'

export enum JudgementStatus {
  REQUESTED = 'requested',
  GIVEN = 'given',
  UNREQUESTED = 'unrequested',
}

@Service()
export class GearSmartcontractsProcessorService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly databaseHelper: GearSmartcontractsDatabaseHelper,
  ) {

  }

  public async processEvent(event: EventModel): Promise<void> {
    this.logger.info({
      event: 'GearSmartcontractsProcessor.processEvent',
      data: event
    })
    console.log(JSON.stringify(event))

    /*
    switch (event.method) {
      case 'NewAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment NewAccount`)
        await this.onNewAccount(event)
        break
      case 'KilledAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment KilledAccount`)
        await this.onKilledAccount(event)
        break
      case 'JudgementRequested':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementRequested`)
        await this.onJudgementEvent({ event, status: JudgementStatus.REQUESTED })
        break
      case 'JudgementGiven':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementGiven`)
        await this.onJudgementEvent({ event, status: JudgementStatus.GIVEN })
        break
      case 'JudgementUnrequested':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementUnrequested`)
        await this.onJudgementEvent({ event, status: JudgementStatus.UNREQUESTED })
        break
      default:
        this.logger.error({
          event: 'GearSmartcontractsProcessor.processEvent',
          message: `failed to process undefined entry with event type "${event.event}"`
        })
        break
    }
    */
  }


  public async processExtrinsic(extrinsic: ExtrinsicModel): Promise<void> {
    this.logger.info({
      event: 'GearSmartcontractsProcessor.processExtrinsic',
      extrinsic_id: extrinsic.extrinsic_id,
      section: extrinsic.section,
      method: extrinsic.method
    })

    switch (extrinsic.method) {
      case 'uploadProgram':
        await this.uploadProgram(extrinsic)
        break

      case 'sendMessage':
        await this.sendMessage(extrinsic)
        break

      default:
        this.logger.error({
          event: 'GearSmartcontractsProcessor.processExtrinsic',
          message: `failed to process undefined entry with extrnisic type "${extrinsic.method}"`
        })
    }
  }


  /*

  import { GearApi } from '@gear-js/api';
  import { getProgramMetadata, GearMetadata } from '@gear-js/api';

  const gearApi = await GearApi.create();

  const programId = "0xc7743acb974627d439701713b22fd5a117c67a2fb1a5cd01b19a4494b4a2b380";
  const programMetadataFile = './meta-marketplace.txt'
  // meta-marketplace.txt - https://github.com/osipov-mit/send-gear-transactions/blob/master/programs/meta-marketplace.txt

  const metaHex = fs.readFileSync(programMetadataFile, 'utf-8');
  const programMetadata  = getProgramMetadata(isHex(metaHex) ? metaHex : `0x${metaHex}`);
  //works fine

  const programState = await gearApi.programState.read({ programId: programId }, programMetadata);
  //works fine

  const initPayload = "0x0003d9cdceabcde8c14d4ea73d1a8970ca014c0350198b89b238c1d21854f98e50";
  const initPayloadDecoded = programMetadata.createType(programMetadata.types.init.input, initPayload);
  
  const handlePayload = "0x0003d9cdceabcde8c14d4ea73d1a8970ca014c0350198b89b238c1d21854f98e50";
  const handlePayloadDecoded = programMetadata.createType(programMetadata.types.handle.input, handlePayload);
*/


  private async uploadProgram(extrinsic: ExtrinsicModel) {
    const events = await this.databaseHelper.getExtrinsicEvents(extrinsic, ['CodeChanged', 'ProgramChanged'])

    const smartcontract: GearSmartcontractModel = {
      block_id: extrinsic.block_id,
      extrinsic_id: extrinsic.extrinsic_id,
      account_id: extrinsic.signer,
      program_id: events[0].event.data[0],
      expiration: events[0].event.data[1].active.expirationm,
      gas_limit: extrinsic.extrinsic.args.gas_limit,
      init_payload: extrinsic.extrinsic.args.init_payload,
      code: extrinsic.extrinsic.args.code,
    }

    this.logger.info({
      event: 'GearSmartcontractsProcessor.uploadProgram',
      program_id: smartcontract.program_id,
    })

    await this.databaseHelper.saveGearSmartcontract(smartcontract)
  }

  private async sendMessage(extrinsic: ExtrinsicModel) {
    //const events = await this.databaseHelper.getExtrinsicEvents(extrinsic, ['CodeChanged', 'ProgramChanged'])

    const smartcontractMessage: GearSmartcontractMessageModel = {
      block_id: extrinsic.block_id,
      extrinsic_id: extrinsic.extrinsic_id,
      account_id: extrinsic.signer,
      program_id: extrinsic.extrinsic.args.destination,
      gas_limit: extrinsic.extrinsic.args.gas_limit,
      payload: extrinsic.extrinsic.args.payload,
      value: extrinsic.extrinsic.args.value,
    }

    this.logger.info({
      event: 'GearSmartcontractsProcessor.sendMessage',
      program_id: smartcontractMessage.program_id,
      account_id: smartcontractMessage.account_id,
    })

    await this.databaseHelper.saveGearSmartcontractMessage(smartcontractMessage)
  }
}