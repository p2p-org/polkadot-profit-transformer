{{- define "app.fullname" -}}
{{- printf "%s-%s-%s-%s" .Chart.Name .Values.environment .Values.chain .Values.role }}
{{- end -}}
