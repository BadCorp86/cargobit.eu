#!/usr/bin/env python3
"""
Generate Woche-1-Checkliste PDF
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem
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

# Register fonts
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

def create_checklist():
    output_path = '/home/z/my-project/download/woche1-blocker/A_woche1_checkliste.pdf'
    
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
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    h1_style = ParagraphStyle(
        'H1Style',
        parent=styles['Heading1'],
        fontName='DejaVuSans-Bold',
        fontSize=14,
        textColor=ACCENT,
        spaceBefore=20,
        spaceAfter=10,
        borderWidth=0,
        borderPadding=0
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
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='DejaVuSans',
        fontSize=10,
        textColor=TEXT_PRIMARY,
        leading=14,
        spaceAfter=6
    )
    
    story = []
    
    # Title
    story.append(Paragraph("Woche 1 - Blocker Checkliste", title_style))
    story.append(Paragraph("CargoBit Payment System - Produktionsreife Implementierung", 
                          ParagraphStyle('Subtitle', parent=body_style, alignment=TA_CENTER, textColor=TEXT_MUTED)))
    story.append(Spacer(1, 30))
    
    # Overview
    story.append(Paragraph("1. Ubersicht", h1_style))
    story.append(Paragraph(
        "Diese Checkliste enthalt alle kritischen Aufgaben fur Woche 1. Jede Aufgabe ist einem Tag zugeordnet "
        "und enthalt konkrete Schritte, Fallstricke und Akzeptanzkriterien. Die Reihenfolge ist optimiert fur "
        "minimale Abhangigkeiten und maximale Parallelisierung.",
        body_style
    ))
    
    # Day-by-day checklist
    story.append(Paragraph("2. Tagliche Aufgaben", h1_style))
    
    # Day 1: PostgreSQL Migration
    story.append(Paragraph("Tag 1: PostgreSQL Migration", h2_style))
    
    day1_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['Postgres Instanz erstellen (Neon/Supabase)', '[ ]', '', 'Freies Tier ausreichend'],
        ['DATABASE_URL in .env setzen', '[ ]', '', 'postgresql://...'],
        ['Prisma Schema prufen', '[ ]', '', 'Enum-Konflikte beheben'],
        ['Migration mit prisma migrate diff erzeugen', '[ ]', '', 'SQLite -> Postgres'],
        ['Migration auf Postgres anwenden', '[ ]', '', 'psql -f migrations/init.sql'],
        ['Prisma Client neu generieren', '[ ]', '', 'npx prisma generate'],
        ['Datenmigration testen', '[ ]', '', 'Null-Werte bereinigen'],
        ['Rollback-Plan dokumentieren', '[ ]', '', 'SQLite Backup behalten'],
    ]
    
    day1_table = Table(day1_data, colWidths=[220, 50, 80, 120])
    day1_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_SURFACE]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(day1_table)
    story.append(Spacer(1, 10))
    
    # Fallstricke Day 1
    story.append(Paragraph("<b>Wichtige Fallstricke:</b>", body_style))
    pitfalls1 = [
        "SQLite erlaubt Null-Werte, die Postgres nicht erlaubt - vorher bereinigen",
        "Enum-Typen mussen in Postgres explizit erstellt werden",
        "Unique Constraints konnen bei Migration fehlschlagen - Duplikate prufen",
        "FOREIGN KEY Constraints werden strenger gepruft - Referenzen validieren"
    ]
    for p in pitfalls1:
        story.append(Paragraph(f"  - {p}", body_style))
    
    story.append(Spacer(1, 15))
    
    # Day 2: Redis Rate Limiting
    story.append(Paragraph("Tag 2: Redis Rate Limiting", h2_style))
    
    day2_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['Redis Instanz starten (Docker/Cloud)', '[ ]', '', 'Upstash empfohlen'],
        ['REDIS_URL in .env setzen', '[ ]', '', 'redis://... oder rediss://'],
        ['ioredis Package installieren', '[ ]', '', 'npm install ioredis'],
        ['Token Bucket implementieren', '[ ]', '', 'Siehe Code-Vorlage'],
        ['Rate Limiter Middleware erstellen', '[ ]', '', 'Pro Endpoint konfigurierbar'],
        ['Admin-Endpoints hart limitieren', '[ ]', '', '10 req/min'],
        ['Rate Limit Headers hinzufugen', '[ ]', '', 'X-RateLimit-*'],
        ['Integration Tests schreiben', '[ ]', '', 'Concurrency testen'],
    ]
    
    day2_table = Table(day2_data, colWidths=[220, 50, 80, 120])
    day2_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSans-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVuSans'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_SURFACE]),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(day2_table)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Wichtige Fallstricke:</b>", body_style))
    pitfalls2 = [
        "Redis TTL muss gesetzt werden - sonst Speicherueberlauf",
        "Key-Prefix pro Service verwenden - Kollisionen vermeiden",
        "Bei Redis-Ausfall: Circuit Breaker mit Fallback-Strategy",
        "Sliding Window statt Fixed Window fur glatte Begrenzung"
    ]
    for p in pitfalls2:
        story.append(Paragraph(f"  - {p}", body_style))
    
    story.append(PageBreak())
    
    # Day 3: Backups + PITR
    story.append(Paragraph("Tag 3: Backups + PITR", h2_style))
    
    day3_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['Postgres PITR aktivieren', '[ ]', '', 'Neon: automatisch'],
        ['Wal-G oder pgBackRest konfigurieren', '[ ]', '', 'Self-hosted Option'],
        ['Backup-Schedule definieren', '[ ]', '', 'Täglich um 3:00 UTC'],
        ['S3 Backup-Bucket erstellen', '[ ]', '', 'Verschluesselt'],
        ['Backup-Skript schreiben', '[ ]', '', 'pg_dump + s3 cp'],
        ['Restore-Prozedur dokumentieren', '[ ]', '', 'Schritt-fur-Schritt'],
        ['Restore testen (CRITICAL!)', '[ ]', '', 'Ohne Test wertlos'],
        ['Retention Policy festlegen', '[ ]', '', '30 Tage / 90 Tage'],
    ]
    
    day3_table = Table(day3_data, colWidths=[220, 50, 80, 120])
    day3_table.setStyle(TableStyle([
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
    ]))
    story.append(day3_table)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Wichtige Fallstricke:</b>", body_style))
    pitfalls3 = [
        "WAL Retention zu kurz - PITR nicht moglich",
        "Backups ohne Verschluesselung - Datenschutzverletzung",
        "Kein Restore-Test - Backup ist wertlos bei echtem Vorfall",
        "Backup-Ziel in gleicher Region wie DB - Regionalausfall trifft beides"
    ]
    for p in pitfalls3:
        story.append(Paragraph(f"  - {p}", body_style))
    
    story.append(Spacer(1, 15))
    
    # Day 4: Stripe Webhook Validation
    story.append(Paragraph("Tag 4: Stripe Webhook Validation", h2_style))
    
    day4_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['STRIPE_WEBHOOK_SECRET setzen', '[ ]', '', 'whsec_xxx'],
        ['Raw Body Parser konfigurieren', '[ ]', '', 'express.raw()'],
        ['Signature Validation implementieren', '[ ]', '', 'stripe.webhooks.constructEvent'],
        ['Idempotency Key speichern', '[ ]', '', 'Processed Events Tabelle'],
        ['Event-Deduplication testen', '[ ]', '', 'Gleiche Event-ID zweimal senden'],
        ['Webhook-Endpoint absichern', '[ ]', '', 'Nur von Stripe aufrufbar'],
        ['Error-Handling implementieren', '[ ]', '', '5xx vs 4xx richtig setzen'],
        ['Monitoring/Alerting einrichten', '[ ]', '', 'Failed Webhooks'],
    ]
    
    day4_table = Table(day4_data, colWidths=[220, 50, 80, 120])
    day4_table.setStyle(TableStyle([
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
    ]))
    story.append(day4_table)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Wichtige Fallstricke:</b>", body_style))
    pitfalls4 = [
        "Body muss RAW sein - JSON.parse zerstort Signatur",
        "Signature MUSS immer validiert werden - keine Ausnahmen",
        "Idempotency Key ist Pflicht - Replay-Angriffe sonst moglich",
        "Webhook Timeout unter 5 Sekunden - Stripe wiederholt sonst"
    ]
    for p in pitfalls4:
        story.append(Paragraph(f"  - {p}", body_style))
    
    story.append(Spacer(1, 15))
    
    # Day 5: Audit Log Hardening
    story.append(Paragraph("Tag 5: Audit Log Hardening", h2_style))
    
    day5_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['Audit Log Tabelle erstellen', '[ ]', '', 'Mit Hash-Spalte'],
        ['Hash-Chain implementieren', '[ ]', '', 'SHA256(prev + curr)'],
        ['Write-Only Constraint setzen', '[ ]', '', 'Kein UPDATE/DELETE'],
        ['Audit Middleware erstellen', '[ ]', '', 'Alle Aktionen loggen'],
        ['S3 Export Job einrichten', '[ ]', '', 'Täglich um 4:00 UTC'],
        ['Integritatsprufung schreiben', '[ ]', '', 'Hash-Chain verifizieren'],
        ['Retention Policy (90-180 Tage)', '[ ]', '', 'Compliance-Anforderung'],
        ['Zugriffskontrolle definieren', '[ ]', '', 'Nur Compliance-Team'],
    ]
    
    day5_table = Table(day5_data, colWidths=[220, 50, 80, 120])
    day5_table.setStyle(TableStyle([
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
    ]))
    story.append(day5_table)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Wichtige Fallstricke:</b>", body_style))
    pitfalls5 = [
        "Kein UPDATE/DELETE erlauben - Trigger setzen",
        "Hash-Chain muss bei JEDEM Eintrag gepruft werden",
        "Logs mussen 90-180 Tage aufbewahrt werden (Compliance)",
        "S3 Export muss verschluesselt sein"
    ]
    for p in pitfalls5:
        story.append(Paragraph(f"  - {p}", body_style))
    
    story.append(PageBreak())
    
    # Days 6-7
    story.append(Paragraph("Tag 6-7: Testing & Deployment", h2_style))
    
    day67_data = [
        ['Aufgabe', 'Status', 'Verantwortlich', 'Notizen'],
        ['Alle Integration Tests grun', '[ ]', '', '100% Pass'],
        ['Load Tests durchfuhren', '[ ]', '', 'k6 oder Artillery'],
        ['Staging Deploy', '[ ]', '', 'Produktions-ähnlich'],
        ['Smoke Tests auf Staging', '[ ]', '', 'Kritische Pfade'],
        ['Security Scan (OWASP Top 10)', '[ ]', '', 'Automatisiert'],
        ['Code Review abgeschlossen', '[ ]', '', 'Min. 2 Reviewer'],
        ['Production Deploy', '[ ]', '', 'Blue-Green empfohlen'],
        ['Post-Deploy Monitoring', '[ ]', '', '30 Min Beobachtung'],
    ]
    
    day67_table = Table(day67_data, colWidths=[220, 50, 80, 120])
    day67_table.setStyle(TableStyle([
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
    ]))
    story.append(day67_table)
    
    story.append(Spacer(1, 30))
    
    # Summary section
    story.append(Paragraph("3. Akzeptanzkriterien fur Woche 1", h1_style))
    
    criteria_data = [
        ['Kriterium', 'Status', 'Beweis'],
        ['PostgresMigration abgeschlossen', '[ ]', 'Alle Tests grun'],
        ['Redis Rate Limiting aktiv', '[ ]', 'Load Test bestanden'],
        ['Backups funktionieren', '[ ]', 'Restore erfolgreich'],
        ['Stripe Webhooks validiert', '[ ]', 'Replay-Test bestanden'],
        ['Audit Logs immutable', '[ ]', 'Hash-Chain verifiziert'],
        ['Staging Deploy erfolgreich', '[ ]', 'Smoke Tests grun'],
        ['Production Ready', '[ ]', 'Go/No-Go Meeting'],
    ]
    
    criteria_table = Table(criteria_data, colWidths=[200, 60, 210])
    criteria_table.setStyle(TableStyle([
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
    ]))
    story.append(criteria_table)
    
    # Build PDF
    doc.build(story)
    print(f"Created: {output_path}")
    return output_path

if __name__ == "__main__":
    create_checklist()
