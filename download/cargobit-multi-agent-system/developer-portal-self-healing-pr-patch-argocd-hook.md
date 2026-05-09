# Self-Healing PR-Patch — ArgoCD PreSync Hook

**Ziel:** Apply-able Git Patch für ArgoCD PreSync Hook (Policy Signaturprüfung) — bereit zum Anwenden im Repository.

---

## Patch-Datei 1: Hook Job

**Dateiname:** `0002-add-argocd-policy-sign-hook.patch`

```diff
*** Begin Patch
*** Add File: argocd/hooks/policy-sign-check-hook.yaml
+# argocd/hooks/policy-sign-check-hook.yaml
+apiVersion: batch/v1
+kind: Job
+metadata:
+  name: policy-sign-check
+  namespace: governance
+spec:
+  template:
+    spec:
+      serviceAccountName: governance-hook
+      containers:
+      - name: sign-checker
+        image: ghcr.io/cargobit/gov-sign-checker:stable
+        env:
+        - name: GIT_REPO
+          value: "git@github.com:cargobit/governance.git"
+        - name: POLICY_PATH
+          value: "containment/"
+        - name: PUBLIC_KEYS_PATH
+          value: "/etc/gov/keys"
+        - name: ARGOCD_APP_NAME
+          value: "tools-service-policies"
+        volumeMounts:
+        - name: ssh-key
+          mountPath: /root/.ssh
+          readOnly: true
+        - name: public-keys
+          mountPath: /etc/gov/keys
+          readOnly: true
+      restartPolicy: Never
+      volumes:
+      - name: ssh-key
+        secret:
+          secretName: git-ssh-key
+      - name: public-keys
+        configMap:
+          name: governance-public-keys
+  backoffLimit: 1
+
*** End Patch
```

## Patch-Datei 2: Application Manifest

```diff
*** Begin Patch
*** Add File: argocd/apps/tools-service-policies.yaml
+# argocd/apps/tools-service-policies.yaml
+apiVersion: argoproj.io/v1alpha1
+kind: Application
+metadata:
+  name: tools-service-policies
+  namespace: argocd
+spec:
+  project: governance
+  source:
+    repoURL: 'git@github.com:cargobit/governance.git'
+    path: 'containment'
+  destination:
+    server: 'https://kubernetes.default.svc'
+    namespace: governance
+  syncPolicy:
+    automated:
+      prune: false
+      selfHeal: false
+    syncOptions:
+      - CreateNamespace=true
+  hooks:
+    - name: policy-sign-check
+      kind: Job
+      hook: PreSync
+      path: argocd/hooks/policy-sign-check-hook.yaml
+
*** End Patch
```

---

## Anwendungsschritte

```bash
# 1) Branch anlegen
git checkout -b ci/argocd/policy-sign-hook

# 2) Verzeichnisse erstellen
mkdir -p argocd/hooks argocd/apps

# 3) Hook Job Datei erstellen
cat > argocd/hooks/policy-sign-check-hook.yaml <<'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: policy-sign-check
  namespace: governance
spec:
  template:
    spec:
      serviceAccountName: governance-hook
      containers:
      - name: sign-checker
        image: ghcr.io/cargobit/gov-sign-checker:stable
        env:
        - name: GIT_REPO
          value: "git@github.com:cargobit/governance.git"
        - name: POLICY_PATH
          value: "containment/"
        - name: PUBLIC_KEYS_PATH
          value: "/etc/gov/keys"
        - name: ARGOCD_APP_NAME
          value: "tools-service-policies"
        volumeMounts:
        - name: ssh-key
          mountPath: /root/.ssh
          readOnly: true
        - name: public-keys
          mountPath: /etc/gov/keys
          readOnly: true
      restartPolicy: Never
      volumes:
      - name: ssh-key
        secret:
          secretName: git-ssh-key
      - name: public-keys
        configMap:
          name: governance-public-keys
  backoffLimit: 1
EOF

# 4) Application Manifest erstellen
cat > argocd/apps/tools-service-policies.yaml <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tools-service-policies
  namespace: argocd
spec:
  project: governance
  source:
    repoURL: 'git@github.com:cargobit/governance.git'
    path: 'containment'
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: governance
  syncPolicy:
    automated:
      prune: false
      selfHeal: false
    syncOptions:
      - CreateNamespace=true
  hooks:
    - name: policy-sign-check
      kind: Job
      hook: PreSync
      path: argocd/hooks/policy-sign-check-hook.yaml
EOF

# 5) Dateien hinzufügen und committen
git add argocd/hooks/policy-sign-check-hook.yaml argocd/apps/tools-service-policies.yaml
git commit -m "chore(argocd): add PreSync policy sign-check hook job"

# 6) Branch pushen
git push -u origin ci/argocd/policy-sign-hook
```

---

## PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argocd/policy-sign-hook` |
| **Commit Message** | `chore(argocd): add PreSync policy sign-check hook job` |
| **PR-Titel** | `chore(argocd): add PreSync policy sign-check hook` |

---

## PR-Beschreibung

```
## Was
Fügt einen ArgoCD PreSync Hook hinzu, der Policies aus dem Governance-Repo auf gültige Signaturen prüft.

## Warum
Nur signierte Policies dürfen automatisch deployed werden; erhöht Governance-Sicherheit.

## Voraussetzungen
- `governance-public-keys` ConfigMap und `git-ssh-key` Secret müssen vorhanden sein
- `gov-sign-checker` Image in Registry

## CI
- YAML-Lint und kubeval/kubeconform sollten grün sein

## Reviewer
- GitOps Owner
- Platform Security

## Merge-Kriterien
- CI grün
- Reviewer-Freigabe
- Hook Image verfügbar
- Secrets/ConfigMap vorhanden
```

---

## Reviewer-Checklist

```markdown
- [ ] `governance-public-keys` ConfigMap und `git-ssh-key` Secret vorhanden oder PR für deren Erstellung beigefügt
- [ ] Hook Image (`ghcr.io/cargobit/gov-sign-checker:stable`) ist in Registry verfügbar oder ersetzt
- [ ] GitOps Owner und Platform Security haben geprüft
- [ ] ArgoCD PreSync Verhalten in Staging getestet (signed vs unsigned policy)
```

---

## Hook Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| **Job** | Kubernetes Job für Signaturprüfung |
| **ServiceAccount** | `governance-hook` mit minimalen RBAC-Rechten |
| **Volumes** | SSH Key Secret + Public Keys ConfigMap |
| **Environment** | Git Repo, Policy Path, Keys Path |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
