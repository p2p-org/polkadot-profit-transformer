import { DemocracyProposalModel, DemocracyReferendaModel } from './models/democracyModels'
import { TechnicalCommiteeProposalModel } from './models/technicalCommiteeModels'

import { Knex } from 'knex'
import { Logger } from '../../logger/logger'
import { PreimageModel } from './models/preimageModel'

export type GovernanceRepository = ReturnType<typeof GovernanceRepository>

export const GovernanceRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    technicalCommittee: {
      save: async (proposal: TechnicalCommiteeProposalModel): Promise<void> => {
        await TechnicalCommiteeProposalModel(knex).insert(proposal).onConflict(['hash', 'extrinsic_id', 'event_id']).merge()
      },
      findProposalIdByHash: async (hash: string): Promise<number> => {
        const proposal = await TechnicalCommiteeProposalModel(knex).where({ hash }).first()
        if (!proposal) throw new Error('Can not find tech comm proposal by hash: ' + hash)
        return Number(proposal.id)
      },
    },
    democracy: {
      referenda: {
        save: async (referenda: DemocracyReferendaModel): Promise<void> => {
          await DemocracyReferendaModel(knex).insert(referenda).onConflict(['id', 'event_id', 'extrinsic_id']).merge()
        },
      },
      proposal: {
        save: async (proposal: DemocracyProposalModel): Promise<void> => {
          await DemocracyProposalModel(knex).insert(proposal).onConflict(['id', 'event_id', 'extrinsic_id']).merge()
        },
      },
    },
    preimages: {
      save: async (preimage: PreimageModel): Promise<void> => {
        logger.info({ preimage }, 'save preimage in db')
        await PreimageModel(knex).insert(preimage).onConflict(['proposal_hash', 'block_id', 'event_id']).merge()
      },
    },
  }
}
