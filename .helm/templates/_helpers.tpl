{{- define "app.fullname" -}}
{{- printf "%s-%s" .Chart.Name .Values.environment  }}
{{- end -}}
{{- define "streamer.fullname" -}}
{{- printf "%s-%s-streamer" .Chart.Name .Values.environment  }}
{{- end -}}

{{- define "env" -}}
{{- printf "%s" .Values.environment  }}
{{- end -}}
{{- define "chart.name" -}}
{{- printf "%s" .Chart.Name  }}
{{- end -}}

{{- define "pg_connection_string" -}}
{{- printf "postgresql://%s:%s@%s:%s/%s" .Values.db.user .Values.db.password .Values.db.host .Values.db.port .Values.db.db }}
{{- end -}}
