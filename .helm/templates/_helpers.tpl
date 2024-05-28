{{- define "app.fullname" -}}
{{- printf "%s-%s-%s-%s" .Chart.Name .Values.environment .Values.chain .Values.role }}
{{- end -}}
{{- define "app.migrate" -}}
{{- printf "%s-%s-%s-migrate" .Chart.Name .Values.environment .Values.chain }}
{{- end -}}
{{- define "app.replicas" -}}
{{- $mappedName := (printf "%v/%v/%v" .Values.chain .Values.role .Values.environment) -}}
{{- if hasKey .Values.replicasByName $mappedName -}}
{{- range $key, $value := .Values.replicasByName -}}
{{- if eq $key $mappedName -}}
{{- $value }}
{{- end -}}
{{- end -}}
{{- else -}}
{{- .Values.replicas }}
{{- end }}
{{- end -}}