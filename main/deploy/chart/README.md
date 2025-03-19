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
# staging
## Polkadot
### Preloader
helm diff upgrade --install polkadot-preloader .helm -f .helm/polkadot.staging.preloader.yaml -n mbelt-staging
### Block processor
helm diff upgrade --install polkadot-block-processor .helm -f .helm/polkadot.staging.block-processor.yaml -n mbelt-staging
### Staking processor
helm diff upgrade --install polkadot-staking-processor .helm -f .helm/polkadot.staging.staking-processor.yaml -n mbelt-staging

## Kusama
### Preloader
helm diff upgrade --install kusama-preloader .helm -f .helm/kusama.staging.preloader.yaml -n mbelt-staging
### Block processor
helm diff upgrade --install kusama-block-processor .helm -f .helm/kusama.staging.block-processor.yaml -n mbelt-staging
### Staking processor
helm diff upgrade --install kusama-staking-processor .helm -f .helm/kusama.staging.staking-processor.yaml -n mbelt-staging

## Moonbeam
### Preloader
helm diff upgrade --install moonbeam-preloader .helm -f .helm/moonbeam.staging.preloader.yaml -n mbelt-staging
### Block processor
helm diff upgrade --install moonbeam-block-processor .helm -f .helm/moonbeam.staging.block-processor.yaml -n mbelt-staging
### Staking processor
helm diff upgrade --install moonbeam-staking-processor .helm -f .helm/moonbeam.staging.staking-processor.yaml -n mbelt-staging

## Moonriver
### Preloader
helm diff upgrade --install moonriver-preloader .helm -f .helm/moonriver.staging.preloader.yaml -n mbelt-staging
### Block processor
helm diff upgrade --install moonriver-block-processor .helm -f .helm/moonriver.staging.block-processor.yaml -n mbelt-staging
### Staking processor
helm diff upgrade --install moonriver-staking-processor .helm -f .helm/moonriver.staging.staking-processor.yaml -n mbelt-staging

# Manta
helm diff upgrade --install manta-balances-processor .helm -f .helm/manta.mbelt3.balances-processor.yaml -n mbelt3
helm diff upgrade --install manta-block-processor .helm -f .helm/manta.mbelt3.block-processor.yaml -n mbelt3
helm diff upgrade --install manta-identity-processor .helm -f .helm/manta.mbelt3.identity-processor.yaml -n mbelt3
helm diff upgrade --install manta-monitoring .helm -f .helm/manta.mbelt3.monitoring.yaml -n mbelt3
helm diff upgrade --install manta-preloader .helm -f .helm/manta.mbelt3.preloader.yaml -n mbelt3
helm diff upgrade --install manta-staking-processor .helm -f .helm/manta.mbelt3.staking-processor.yaml -n mbelt3
```
