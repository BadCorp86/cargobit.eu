#!/usr/bin/env python3
"""
Generate D) Incident-Playbook PDF
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Colors from palette
ACCENT = colors.HexColor('#4e2ab9')
TEXT_PRIMARY = colors.HexColor('#1d1d1b')
TEXT_MUTED = colors.HexColor('#8d8a81')
BG_SURFACE = colors.HexColor('#e5e3dd')
BG_PAGE = colors.HexColor('#f2f1ee')
ALERT_RED = colors.HexColor('#DC2626')
ALERT_AMBER = colors.HexColor('#D97706')
ALERT_GREEN = colors.HexColor('#059669')

# Register fonts
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

def create_incident_playbook():
    output_path = '/home/z/my-project/download/woche1-blocker/D_incident_playbook.pdf'
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontName='DejaVuSans-Bold',
        fontSize=24,
        textColor=ACCENT,
        spaceAfter=10,
        alignment=TA_CENTER
    )
    
    h1_style = ParagraphStyle(
        'H1Style',
        parent=styles['Heading1'],
        fontName='DejaVuSans-Bold',
        fontSize=14,
        textColor=ACCENT,
        spaceBefore=20,
        spaceAfter=10
    )
    
    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontName='DejaVuSans-Bold',
        fontSize=12,
        textColor=TEXT_PRIMARY,
        spaceBefore=15,
        spaceAfter=8
    )
    
    h3_style = ParagraphStyle(
        'H3Style',
        parent=styles['Heading3'],
        fontName='DejaVuSans-Bold',
        fontSize=11,
        textColor=TEXT_PRIMARY,
        spaceBefore=10,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='DejaVuSans',
        fontSize=10,
        textColor=TEXT_PRIMARY,
        leading=14,
        spaceAfter=6
    )
    
    alert_style = ParagraphStyle(
        'AlertStyle',
        parent=styles['Normal'],
        fontName='DejaVuSans-Bold',
        fontSize=10,
        textColor=ALERT_RED,
        leading=14,
        spaceAfter=4
    )
    
    story = []
    
    # Title
    story.append(Paragraph("Incident-Playbook", title_style))
    story.append(Paragraph("Woche 1 - Kritische Blocker", 
                          ParagraphStyle('Subtitle', parent=body_style, alignment=TA_CENTER, textColor=TEXT_MUTED)))
    story.append(Spacer(1, 30))
    
    # Quick Reference
    story.append(Paragraph("1. Schnellreferenz", h1_style))
    
    quick_ref_data = [
        ['Incident', 'Schwere', 'Erste Massnahme', 'Escalation'],
        ['Postgres nicht erreichbar', 'CRITICAL', 'Connection String prufen', 'DBA / Neon Support'],
        ['Redis Rate Limit fail', 'HIGH', 'Circuit Breaker aktivieren', 'DevOps'],
        ['Stripe Webhook Fehler', 'HIGH', 'Signature validieren', 'Payment Team'],
        ['Audit Log Integritat', 'MEDIUM', 'Hash-Chain verifizieren', 'Security'],
        ['Backup fehlgeschlagen', 'HIGH', 'Manuelles Backup', 'DevOps'],
    ]
    
    quick_ref_table = Table(quick_ref_data, colWidths=[140, 60, 150, 100])
    quick_ref_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_SURFACE]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        # Color code severity
        ('TEXTCOLOR', (1, 1), (1, 1), ALERT_RED),
        ('TEXTCOLOR', (1, 2), (1, 2), ALERT_AMBER),
        ('TEXTCOLOR', (1, 3), (1, 3), ALERT_AMBER),
        ('TEXTCOLOR', (1, 4), (1, 4), colors.HexColor('#D97706')),
        ('TEXTCOLOR', (1, 5), (1, 5), ALERT_AMBER),
    ]))
    story.append(quick_ref_table)
    story.append(Spacer(1, 20))
    
    # Emergency Contacts
    story.append(Paragraph("2. Notfall-Kontakte", h1_style))
    
    contacts_data = [
        ['Rolle', 'Name', 'Telefon', 'Verfugbarkeit'],
        ['Incident Commander', '[Name]', '[Nummer]', '24/7'],
        ['DBA / Database', '[Name]', '[Nummer]', 'Business Hours'],
        ['DevOps / Infrastructure', '[Name]', '[Nummer]', 'Business Hours'],
        ['Security', '[Name]', '[Nummer]', 'Business Hours'],
        ['Neon Support', 'support@neon.tech', 'Slack', '24/7'],
        ['Upstash Support', 'support@upstash.com', '-', 'Business Hours'],
        ['Stripe Support', 'dashboard.stripe.com/support', '-', '24/7'],
    ]
    
    contacts_table = Table(contacts_data, colWidths=[120, 120, 100, 110])
    contacts_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_SURFACE]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(contacts_table)
    
    story.append(PageBreak())
    
    # Incident 1: PostgreSQL
    story.append(Paragraph("3. Incident Playbooks", h1_style))
    
    story.append(Paragraph("3.1 PostgreSQL Ausfall", h2_style))
    
    story.append(Paragraph("Symptome", h3_style))
    symptoms = [
        "Verbindungsfehler: 'connection refused' oder 'timeout'",
        "Langsame Queries (>5s)",
        "Hohe CPU/RAM-Auslastung auf DB-Instanz",
        "Fehlgeschlagene Transaktionen"
    ]
    for s in symptoms:
        story.append(Paragraph(f"  - {s}", body_style))
    
    story.append(Paragraph("Diagnose-Schritte", h3_style))
    diag_data = [
        ['Schritt', 'Befehl/Aktion', 'Erwartetes Ergebnis'],
        ['1. Connection prufen', 'psql $DATABASE_URL -c "SELECT 1"', 'Erfolgreich'],
        ['2. Connection Pool Status', 'Prisma Studio > Connections', '< Pool Size'],
        ['3. Long Running Queries', 'SELECT * FROM pg_stat_activity WHERE state = \'active\';', 'Keine >30s'],
        ['4. Disk Space', 'SELECT pg_size_pretty(pg_database_size(\'cargobit\'));', '<80%'],
        ['5. Neon Console', 'console.neon.tech > Metrics', 'Normal'],
    ]
    diag_table = Table(diag_data, colWidths=[100, 200, 150])
    diag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E40AF')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EFF6FF')]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(diag_table)
    
    story.append(Paragraph("Losungsstrategien", h3_style))
    solutions_data = [
        ['Problem', 'Losung', 'Zeit'],
        ['Connection Pool erschopft', 'App neu starten, pool_size erhoehen', '5 min'],
        ['Slow Query', 'EXPLAIN ANALYZE, Index erstellen', '15 min'],
        ['Disk Full', 'Neon: Auto-Scale aktivieren', '10 min'],
        ['Region-Ausfall', 'Failover zu Backup-Region', '30 min'],
        ['Complete DB Loss', 'Restore von S3 Backup', '60 min'],
    ]
    solutions_table = Table(solutions_data, colWidths=[140, 230, 80])
    solutions_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ALERT_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#D1FAE5')]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(solutions_table)
    
    story.append(Spacer(1, 15))
    
    # Incident 2: Redis
    story.append(Paragraph("3.2 Redis Rate Limiting Ausfall", h2_style))
    
    story.append(Paragraph("Symptome", h3_style))
    redis_symptoms = [
        "Alle Requests werden blockiert (429)",
        "Keine Requests werden blockiert",
        "Hohe Latenz bei Rate Limit Checks",
        "Redis Connection Errors in Logs"
    ]
    for s in redis_symptoms:
        story.append(Paragraph(f"  - {s}", body_style))
    
    story.append(Paragraph("Diagnose-Schritte", h3_style))
    redis_diag_data = [
        ['Schritt', 'Befehl/Aktion', 'Erwartetes Ergebnis'],
        ['1. Redis Erreichbarkeit', 'redis-cli -u $REDIS_URL PING', 'PONG'],
        ['2. Memory Usage', 'redis-cli INFO memory', 'used_memory < maxmemory'],
        ['3. Connection Count', 'redis-cli INFO clients', 'connected_clients < limit'],
        ['4. Key Count', 'redis-cli DBSIZE', 'Erwarteter Wert'],
        ['5. Upstash Console', 'console.upstash.com', 'Status OK'],
    ]
    redis_diag_table = Table(redis_diag_data, colWidths=[100, 200, 150])
    redis_diag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FEE2E2')]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(redis_diag_table)
    
    story.append(Paragraph("Circuit Breaker Fallback", h3_style))
    story.append(Paragraph(
        "Bei Redis-Ausfall sollte die App automatisch in den Fallback-Modus wechseln. "
        "Konfiguration in .env: RATE_LIMIT_FALLBACK=allow_all (nur fur kurze Zeit!) "
        "oder RATE_LIMIT_FALLBACK=deny_all (sicherer, aber User-Impact).",
        body_style
    ))
    
    story.append(PageBreak())
    
    # Incident 3: Stripe Webhooks
    story.append(Paragraph("3.3 Stripe Webhook Fehler", h2_style))
    
    story.append(Paragraph("Symptome", h3_style))
    stripe_symptoms = [
        "Webhooks schlagen fehl mit 400 Bad Request",
        "Payments nicht in DB aktualisiert",
        "Stripe Dashboard zeigt fehlgeschlagene Webhooks",
        "Replay-Angriffe vermutet"
    ]
    for s in stripe_symptoms:
        story.append(Paragraph(f"  - {s}", body_style))
    
    story.append(Paragraph("Diagnose-Schritte", h3_style))
    stripe_diag_data = [
        ['Schritt', 'Aktion', 'Erwartetes Ergebnis'],
        ['1. Stripe Dashboard', 'Developers > Webhooks', 'Endpoint aktiv'],
        ['2. Recent Deliveries', 'Click Endpoint > Recent', '200 Status'],
        ['3. Secret prufen', 'Env: STRIPE_WEBHOOK_SECRET', 'whsec_xxx'],
        ['4. Raw Body', 'Code Review: express.raw()', 'Vor JSON.parse'],
        ['5. Idempotency', 'processedEvents Tabelle', 'Keine Duplikate'],
    ]
    stripe_diag_table = Table(stripe_diag_data, colWidths=[100, 180, 170])
    stripe_diag_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EDE9FE')]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(stripe_diag_table)
    
    story.append(Paragraph("Replay-Angriff Erkennung", h3_style))
    story.append(Paragraph(
        "Wenn dieselbe Event-ID mehrfach verarbeitet wird: "
        "1. Prufe processedEvents Tabelle auf Duplikate. "
        "2. Bei >1 Eintrag mit gleicher ID: Moglicher Replay-Angriff. "
        "3. Webhook-Secret sofort rotieren! "
        "4. Stripe Support kontaktieren.",
        body_style
    ))
    
    story.append(Spacer(1, 15))
    
    # Incident 4: Audit Logs
    story.append(Paragraph("3.4 Audit Log Integritatsverletzung", h2_style))
    
    story.append(Paragraph("Symptome", h3_style))
    audit_symptoms = [
        "Hash-Chain Verifikation schlagt fehl",
        "Fehlende Eintrage in audit_log Tabelle",
        "Verdacht auf Manipulation"
    ]
    for s in audit_symptoms:
        story.append(Paragraph(f"  - {s}", body_style))
    
    story.append(Paragraph("Verifikations-Befehl", h3_style))
    story.append(Paragraph(
        "SELECT verify_audit_integrity() -- Gibt TRUE zuruck wenn OK, FALSE wenn verletzt",
        body_style
    ))
    
    story.append(Paragraph("Massnahmen bei Integritatsverletzung", h3_style))
    audit_actions = [
        "1. Sofort Security-Team informieren",
        "2. Alle Zugriffe auf audit_log Tabelle loggen",
        "3. S3 Archive mit Datenbank abgleichen",
        "4. Forensische Analyse der Abweichungen",
        "5. Bei Bestatigung: Incident Report erstellen"
    ]
    for a in audit_actions:
        story.append(Paragraph(f"  {a}", body_style))
    
    story.append(PageBreak())
    
    # Incident 5: Backup Failure
    story.append(Paragraph("3.5 Backup Fehlgeschlagen", h2_style))
    
    story.append(Paragraph("Symptome", h3_style))
    backup_symptoms = [
        "Cron-Job fehlgeschlagen (Email Alert)",
        "Keine neuen Backups in S3",
        "S3 Bucket fast leer oder veraltet"
    ]
    for s in backup_symptoms:
        story.append(Paragraph(f"  - {s}", body_style))
    
    story.append(Paragraph("Manuelles Backup", h3_style))
    manual_backup = [
        "# Sofort manuell ausfuhren:",
        "pg_dump -Fc $DATABASE_URL > /tmp/manual_backup_$(date +%F).dump",
        "aws s3 cp /tmp/manual_backup_*.dump s3://cargobit-backups/manual/",
        "",
        "# Restore testen (auf separater DB!):",
        "pg_restore -d $TEST_DB_URL /tmp/manual_backup_*.dump"
    ]
    for line in manual_backup:
        story.append(Paragraph(f"  {line}", body_style))
    
    story.append(Spacer(1, 20))
    
    # Escalation Matrix
    story.append(Paragraph("4. Escalation-Matrix", h1_style))
    
    escalation_data = [
        ['Schwere', 'Beispiel', 'Response Time', 'Kontaktieren'],
        ['P1 - CRITICAL', 'DB komplett ausgefallen', '<5 min', 'Incident Commander + DBA'],
        ['P2 - HIGH', 'Redis nicht erreichbar', '<15 min', 'DevOps on-call'],
        ['P3 - MEDIUM', 'Backup fehlgeschlagen', '<1 Stunde', 'DevOps'],
        ['P4 - LOW', 'Performance Degradation', '<4 Stunden', 'Dev Team'],
    ]
    
    escalation_table = Table(escalation_data, colWidths=[80, 150, 80, 140])
    escalation_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_SURFACE]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        # P1 red background
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#FEE2E2')),
        ('TEXTCOLOR', (0, 1), (0, 1), ALERT_RED),
    ]))
    story.append(escalation_table)
    
    story.append(Spacer(1, 20))
    
    # Post-Incident
    story.append(Paragraph("5. Post-Incident Prozess", h1_style))
    
    post_incident = [
        "1. Incident in Jira/Linear dokumentieren",
        "2. Root Cause Analysis (RCA) innerhalb 48h",
        "3. Action Items erstellen und priorisieren",
        "4. Runbook aktualisieren falls notwendig",
        "5. Postmortem-Meeting planen (bei P1/P2)",
        "6. Lessons Learned im Team teilen"
    ]
    for item in post_incident:
        story.append(Paragraph(f"  {item}", body_style))
    
    story.append(Spacer(1, 15))
    
    # Template
    story.append(Paragraph("Postmortem Template", h2_style))
    template_items = [
        "- **Datum**: [Incident Datum]",
        "- **Dauer**: [Start] - [Ende] ([Gesamtzeit])",
        "- **Schwere**: [P1/P2/P3/P4]",
        "- **Zusammenfassung**: [Was ist passiert?]",
        "- **Auswirkung**: [Welche User/Systeme betroffen?]",
        "- **Ursache**: [Warum ist es passiert?]",
        "- **Losung**: [Was wurde getan?]",
        "- **Action Items**: [Was wird getan um Wiederholung zu verhindern?]",
    ]
    for item in template_items:
        story.append(Paragraph(item, body_style))
    
    # Build PDF
    doc.build(story)
    print(f"Created: {output_path}")
    return output_path

if __name__ == "__main__":
    create_incident_playbook()
