# Upgrade
```
# Polkadot
helm diff upgrade --install mbelt-prod-polkadot .helm -f .helm/values.prod.polkadot.yaml -n mbelt

# Kusama
helm diff upgrade --install mbelt-prod-kusama .helm -f .helm/values.prod.kusama.yaml -n mbelt

# Moonbeam
helm diff upgrade --install mbelt-prod-moonbeam .helm -f .helm/values.prod.moonbeam.yaml -n mbelt

# Moonriver
helm diff upgrade --install mbelt-prod-moonriver .helm -f .helm/values.prod.moonriver.yaml -n mbelt
```

```
# Mbelt3
## Preloader
helm diff upgrade --install mbelt3-preloader .helm -f .helm/mbelt3.preloader.yaml -n mbelt3

## Block processor
helm diff upgrade --install mbelt3-block-processor .helm -f .helm/mbelt3.block-processor.yaml -n mbelt3

## Staking processor
helm diff upgrade --install mbelt3-staking-processor .helm -f .helm/mbelt3.staking-processor.yaml -n mbelt3
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
```
