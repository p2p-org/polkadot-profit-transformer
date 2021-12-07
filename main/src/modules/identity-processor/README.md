# Identity Processor

Identity processor is the additional module with the purpose to update accounts identity data in DB.

# Features

Identity Processor listens and updates:

- Account creation event
- Account killed event
- Judgement status changes
- Add/Remove subaccounts events
- Identity fields changes

# How it's made

Due to simplicity we've implemented Processor Constructor in the [single file](./index.ts)

We export IdentityProcessor constructor function [here](./index.ts#L17)

Constructor returns [handlers](./index.ts#L225) to register in EventBus

Identity Processor stores data in `account_identity` table, created [here](/db/000001_init.sql#L103)

To work with this table we created Identity Repository [here](/main/src/apps/common/infra/postgresql/identity.repository.ts) and account identity Knex model [here](/main/src/apps/common/infra/postgresql/models/identity.model.ts)

We initialize Identity Repository [here](/main/src/apps/main/index.ts#L55) and pass it as a dependency into Identity Processor

We initialize Identity Processor from constructor in [main app ignitor](/main/src/apps/main/index.ts#L78)

We've defined `identityEvent` and `identityExtrinsic` events in [EventName enum](/main/src/modules/event-bus/event-bus.ts#L19)

We dispatch related events in EventBus, looking for targeted method and sections of the [events](/main/modules/streamer/block-processor.ts#L140) and [extinsics](/main/modules/streamer/block-processor.ts#L102)

Finally we register Identity Processor handlers to this events [here](/main/src/apps/main/index.ts#L82)
