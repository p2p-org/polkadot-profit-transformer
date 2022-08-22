# Upgrade
```
# Polkadot
helm diff upgrade --install mbelt-prod-polkadot .helm -f .helm/values.prod.polkadot.yaml --namespace mbelt

# Kusama
helm diff upgrade --install mbelt-prod-kusama .helm -f .helm/values.prod.kusama.yaml --namespace mbelt

# Moonbeam
helm diff upgrade --install mbelt-prod-moonbeam .helm -f .helm/values.prod.moonbeam.yaml --namespace mbelt

# Moonriver
helm diff upgrade --install mbelt-prod-moonriver .helm -f .helm/values.prod.moonriver.yaml --namespace mbelt
```

```
# Mbelt3
## Preloader
helm diff upgrade --install mbelt3-preloader .helm -f .helm/mbelt3.preloader.yaml --namespace mbelt3

## Block processor
helm diff upgrade --install mbelt3-block-processor .helm -f .helm/mbelt3.block-processor.yaml --namespace mbelt3

## Staking processor
helm diff upgrade --install mbelt3-staking-processor .helm -f .helm/mbelt3.staking-processor.yaml --namespace mbelt3
```

```
# Stage
## Preloader
helm diff upgrade --install mbelt-stage-preloader .helm -f .helm/values.stage.preloader.yaml --namespace mbelt-stage

## Block processor
helm diff upgrade --install mbelt-stage-block-processor .helm -f .helm/values.stage.block-processor.yaml --namespace mbelt-stage

## Staking processor
helm diff upgrade --install mbelt-stage-staking-processor .helm -f .helm/values.stage.staking-processor.yaml --namespace mbelt-stage
```
