# Mbelt3
```
## Polkadot
### Preloader
helm diff upgrade --install mbelt3-polkadot-preloader .helm -f .helm/polkadot.mbelt3.preloader.yaml -n mbelt3
### Block processor
helm diff upgrade --install mbelt3-polkadot-block-processor .helm -f .helm/polkadot.mbelt3.block-processor.yaml -n mbelt3
### Staking processor
helm diff upgrade --install mbelt3-polkadot-staking-processor .helm -f .helm/polkadot.mbelt3.staking-processor.yaml -n mbelt3
### Monitoring
helm diff upgrade --install mbelt3-polkadot-monitoring .helm -f .helm/polkadot.mbelt3.monitoring.yaml -n mbelt3

## Kusama
### Preloader
helm diff upgrade --install mbelt3-kusama-preloader .helm -f .helm/kusama.mbelt3.preloader.yaml -n mbelt3
### Block processor
helm diff upgrade --install mbelt3-kusama-block-processor .helm -f .helm/kusama.mbelt3.block-processor.yaml -n mbelt3
### Staking processor
helm diff upgrade --install mbelt3-kusama-staking-processor .helm -f .helm/kusama.mbelt3.staking-processor.yaml -n mbelt3
### Monitoring
helm diff upgrade --install mbelt3-kusama-monitoring .helm -f .helm/kusama.mbelt3.monitoring.yaml -n mbelt3

## Moonbeam
### Preloader
helm diff upgrade --install mbelt3-moonbeam-preloader .helm -f .helm/moonbeam.mbelt3.preloader.yaml -n mbelt3
### Block processor
helm diff upgrade --install mbelt3-moonbeam-block-processor .helm -f .helm/moonbeam.mbelt3.block-processor.yaml -n mbelt3
### Staking processor
helm diff upgrade --install mbelt3-moonbeam-staking-processor .helm -f .helm/moonbeam.mbelt3.staking-processor.yaml -n mbelt3
### Monitoring
helm diff upgrade --install mbelt3-moonbeam-monitoring .helm -f .helm/moonbeam.mbelt3.monitoring.yaml -n mbelt3

## Moonriver
### Preloader
helm diff upgrade --install mbelt3-moonriver-preloader .helm -f .helm/moonriver.mbelt3.preloader.yaml -n mbelt3
### Block processor
helm diff upgrade --install mbelt3-moonriver-block-processor .helm -f .helm/moonriver.mbelt3.block-processor.yaml -n mbelt3
### Staking processor
helm diff upgrade --install mbelt3-moonriver-staking-processor .helm -f .helm/moonriver.mbelt3.staking-processor.yaml -n mbelt3
### Monitoring
helm diff upgrade --install mbelt3-moonriver-monitoring .helm -f .helm/moonriver.mbelt3.monitoring.yaml -n mbelt3
```

```
# Stage
## Polkadot
### Preloader
helm diff upgrade --install mbelt-stage-polkadot-preloader .helm -f .helm/polkadot.stage.preloader.yaml -n mbelt-stage
### Block processor
helm diff upgrade --install mbelt-stage-polkadot-block-processor .helm -f .helm/polkadot.stage.block-processor.yaml -n mbelt-stage
### Staking processor
helm diff upgrade --install mbelt-stage-polkadot-staking-processor .helm -f .helm/polkadot.stage.staking-processor.yaml -n mbelt-stage

## Kusama
### Preloader
helm diff upgrade --install mbelt-stage-kusama-preloader .helm -f .helm/kusama.stage.preloader.yaml -n mbelt-stage
### Block processor
helm diff upgrade --install mbelt-stage-kusama-block-processor .helm -f .helm/kusama.stage.block-processor.yaml -n mbelt-stage
### Staking processor
helm diff upgrade --install mbelt-stage-kusama-staking-processor .helm -f .helm/kusama.stage.staking-processor.yaml -n mbelt-stage

## Moonbeam
### Preloader
helm diff upgrade --install mbelt-stage-moonbeam-preloader .helm -f .helm/moonbeam.stage.preloader.yaml -n mbelt-stage
### Block processor
helm diff upgrade --install mbelt-stage-moonbeam-block-processor .helm -f .helm/moonbeam.stage.block-processor.yaml -n mbelt-stage
### Staking processor
helm diff upgrade --install mbelt-stage-moonbeam-staking-processor .helm -f .helm/moonbeam.stage.staking-processor.yaml -n mbelt-stage

## Moonriver
### Preloader
helm diff upgrade --install mbelt-stage-moonriver-preloader .helm -f .helm/moonriver.stage.preloader.yaml -n mbelt-stage
### Block processor
helm diff upgrade --install mbelt-stage-moonriver-block-processor .helm -f .helm/moonriver.stage.block-processor.yaml -n mbelt-stage
### Staking processor
helm diff upgrade --install mbelt-stage-moonriver-staking-processor .helm -f .helm/moonriver.stage.staking-processor.yaml -n mbelt-stage

# Manta
helm diff upgrade --install mbelt3-manta-balances-processor .helm -f .helm/manta.mbelt3.balances-processor.yaml -n mbelt3
helm diff upgrade --install mbelt3-manta-block-processor .helm -f .helm/manta.mbelt3.block-processor.yaml -n mbelt3
helm diff upgrade --install mbelt3-manta-identity-processor .helm -f .helm/manta.mbelt3.identity-processor.yaml -n mbelt3
helm diff upgrade --install mbelt3-manta-monitoring .helm -f .helm/manta.mbelt3.monitoring.yaml -n mbelt3
helm diff upgrade --install mbelt3-manta-preloader .helm -f .helm/manta.mbelt3.preloader.yaml -n mbelt3
helm diff upgrade --install mbelt3-manta-staking-processor .helm -f .helm/manta.mbelt3.staking-processor.yaml -n mbelt3
```
