{{- define "app.fullname" -}}
{{- printf "%s-%s-%s" .Chart.Name .Values.environment .Values.name }}
{{- end -}}
