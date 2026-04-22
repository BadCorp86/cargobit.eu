{{- define "payments.name" -}}
payments
{{- end -}}

{{- define "payments.fullname" -}}
{{ include "payments.name" . }}
{{- end -}}

{{- define "payments.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "payments.labels" -}}
app.kubernetes.io/name: {{ include "payments.name" . }}
helm.sh/chart: {{ include "payments.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
