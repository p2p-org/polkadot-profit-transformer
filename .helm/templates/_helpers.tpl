{{- define "app.fullname" -}}
{{- printf "%s-%s-%s-%s" .Chart.Name .Values.environment .Values.chain .Values.role }}
{{- end -}}
{{- define "app.migrate" -}}
{{- printf "%s-%s-%s-migrate" .Chart.Name .Values.environment .Values.chain }}
{{- end -}}
