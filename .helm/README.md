# Upgrade
```
# Prod
helm diff upgrade --install mbelt-prod charts/mbelt -f ./charts/mbelt/values.prod.yaml --namespace mbelt

# Stage
helm diff upgrade --install mbelt-stage charts/mbelt -f ./charts/mbelt/values.stage.yaml --namespace mbelt-stage
```
