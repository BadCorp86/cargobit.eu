'use client';

// ============================================
// CARGOBIT RISK DASHBOARD - RISK PROFILE DETAIL
// Detailseite für User / Company / Transaction
// ============================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  Shield,
  Users,
  Building2,
  Truck,
  ArrowLeft,
  Clock,
  Flag,
  Unlock,
  Ticket,
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Info,
  BarChart3,
  FileWarning,
  Ban,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';
type EntityType = 'USER' | 'COMPANY' | 'TRANSACTION';

interface RiskProfile {
  id: string;
  type: EntityType;
  name: string;
  score: number;
  level: RiskLevel;
  lastUpdated: string;
  createdAt: string;

  // Summary
  triggeredRulesCount: number;
  activeSecurityFlags: number;
  linkedTickets: number;

  // Sub-scores
  userScore: number;
  companyScore: number;
  transactionScore: number;

  // Status
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
}

interface TriggeredRule {
  id: string;
  name: string;
  description: string;
  weight: number;
  lastTriggered: string;
  triggerCount: number;
  category: string;
}

interface ScoreHistoryPoint {
  timestamp: string;
  score: number;
  level: RiskLevel;
  change: number;
  reason: string;
}

interface RiskEventDetail {
  id: string;
  timestamp: string;
  ruleName: string;
  weight: number;
  context: Record<string, unknown>;
  resultingScore: number;
}

interface SecurityFlag {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  createdBy: string;
  reason: string;
  active: boolean;
}

// ============================================
// MOCK DATA
// ============================================

function getMockProfile(id: string): RiskProfile {
  return {
    id,
    type: 'USER',
    name: 'Max Mustermann',
    score: 78,
    level: 'RED',
    lastUpdated: new Date().toISOString(),
    createdAt: '2024-01-15T10:00:00Z',
    triggeredRulesCount: 4,
    activeSecurityFlags: 2,
    linkedTickets: 1,
    userScore: 45,
    companyScore: 18,
    transactionScore: 15,
    status: 'ACTIVE',
  };
}

function getMockTriggeredRules(): TriggeredRule[] {
  return [
    {
      id: 'rule_1',
      name: 'user_fraud_flag',
      description: 'Kürzlicher Betrugsverdacht',
      weight: 30,
      lastTriggered: new Date().toISOString(),
      triggerCount: 1,
      category: 'SECURITY',
    },
    {
      id: 'rule_2',
      name: 'user_kyc_missing',
      description: 'KYC-Verifizierung nicht abgeschlossen',
      weight: 20,
      lastTriggered: new Date(Date.now() - 86400000).toISOString(),
      triggerCount: 3,
      category: 'DOCUMENT',
    },
    {
      id: 'rule_3',
      name: 'user_new_iban',
      description: 'Neue IBAN in den letzten 48h',
      weight: 15,
      lastTriggered: new Date(Date.now() - 172800000).toISOString(),
      triggerCount: 1,
      category: 'USER',
    },
    {
      id: 'rule_4',
      name: 'user_many_cancellations',
      description: 'Hohe Stornierungsrate',
      weight: 10,
      lastTriggered: new Date(Date.now() - 259200000).toISOString(),
      triggerCount: 2,
      category: 'BEHAVIOR',
    },
  ];
}

function getMockScoreHistory(): ScoreHistoryPoint[] {
  const history: ScoreHistoryPoint[] = [];
  let score = 25;
  for (let i = 29; i >= 0; i--) {
    const change = Math.floor(Math.random() * 20) - 5;
    score = Math.max(0, Math.min(100, score + change));
    const date = new Date();
    date.setDate(date.getDate() - i);
    history.push({
      timestamp: date.toISOString(),
      score,
      level: score <= 30 ? 'GREEN' : score <= 60 ? 'YELLOW' : 'RED',
      change,
      reason: change > 10 ? 'Major event' : change < -10 ? 'Mitigation applied' : 'Normal fluctuation',
    });
  }
  return history;
}

function getMockEvents(): RiskEventDetail[] {
  return [
    {
      id: 'evt_1',
      timestamp: new Date().toISOString(),
      ruleName: 'user_fraud_flag',
      weight: 30,
      context: { ip: '192.168.1.1', country: 'DE', action: 'PAYOUT_REQUEST' },
      resultingScore: 78,
    },
    {
      id: 'evt_2',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      ruleName: 'user_kyc_missing',
      weight: 20,
      context: { kyc_status: 'pending' },
      resultingScore: 48,
    },
    {
      id: 'evt_3',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      ruleName: 'user_new_iban',
      weight: 15,
      context: { iban_age_hours: 12, previous_iban: 'DE89...' },
      resultingScore: 28,
    },
  ];
}

function getMockSecurityFlags(): SecurityFlag[] {
  return [
    {
      id: 'flag_1',
      type: 'FRAUD_SUSPECTED',
      severity: 'HIGH',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      reason: 'Unusual payout pattern detected',
      active: true,
    },
    {
      id: 'flag_2',
      type: 'DOCUMENT_ISSUE',
      severity: 'MEDIUM',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      createdBy: 'admin_123',
      reason: 'KYC documents expired',
      active: true,
    },
  ];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getRiskColor = (level: RiskLevel) => {
  switch (level) {
    case 'GREEN':
      return 'text-green-600';
    case 'YELLOW':
      return 'text-yellow-600';
    case 'RED':
      return 'text-red-600';
  }
};

const getRiskBg = (level: RiskLevel) => {
  switch (level) {
    case 'GREEN':
      return 'bg-green-100 border-green-300';
    case 'YELLOW':
      return 'bg-yellow-100 border-yellow-300';
    case 'RED':
      return 'bg-red-100 border-red-300';
  }
};

const getEntityIcon = (type: EntityType) => {
  switch (type) {
    case 'USER':
      return Users;
    case 'COMPANY':
      return Building2;
    case 'TRANSACTION':
      return Truck;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSeverityColor = (severity: SecurityFlag['severity']) => {
  switch (severity) {
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-200';
  }
};

// ============================================
// SCORE HISTORY CHART
// ============================================

function ScoreHistoryChart({ data }: { data: ScoreHistoryPoint[] }) {
  const chartHeight = 250;
  const chartWidth = 700;
  const padding = 50;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const getX = (index: number) => padding + (index / (data.length - 1)) * graphWidth;
  const getY = (value: number) => padding + graphHeight - (value / 100) * graphHeight;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.score)}`).join(' ');

  // Threshold lines
  const greenThreshold = getY(30);
  const yellowThreshold = getY(60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Score History
        </CardTitle>
        <CardDescription>Entwicklung des Risk-Scores über Zeit</CardDescription>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
          {/* Threshold zones */}
          <rect x={padding} y={padding} width={graphWidth} height={greenThreshold - padding} fill="#fee2e2" opacity="0.5" />
          <rect x={padding} y={greenThreshold} width={graphWidth} height={yellowThreshold - greenThreshold} fill="#fef9c3" opacity="0.5" />
          <rect x={padding} y={yellowThreshold} width={graphWidth} height={padding + graphHeight - yellowThreshold} fill="#dcfce7" opacity="0.5" />

          {/* Threshold lines */}
          <line x1={padding} y1={greenThreshold} x2={chartWidth - padding} y2={greenThreshold} stroke="#ef4444" strokeDasharray="6" />
          <line x1={padding} y1={yellowThreshold} x2={chartWidth - padding} y2={yellowThreshold} stroke="#eab308" strokeDasharray="6" />

          {/* Labels */}
          <text x={chartWidth - padding + 5} y={greenThreshold + 4} className="text-xs fill-red-500">60</text>
          <text x={chartWidth - padding + 5} y={yellowThreshold + 4} className="text-xs fill-yellow-500">30</text>

          {/* Main line */}
          <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />

          {/* Data points with major changes */}
          {data.filter(d => Math.abs(d.change) >= 10).map((d, i) => {
            const dataIndex = data.indexOf(d);
            return (
              <g key={i}>
                <circle cx={getX(dataIndex)} cy={getY(d.score)} r="5" fill="#ef4444" />
                <text x={getX(dataIndex)} y={getY(d.score) - 10} className="text-xs fill-red-500" textAnchor="middle">
                  {d.change > 0 ? '+' : ''}{d.change}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {[0, 7, 14, 21, 29].map(i => {
            if (data[i]) {
              const date = new Date(data[i].timestamp);
              return (
                <text key={i} x={getX(i)} y={chartHeight - 15} className="text-xs fill-muted-foreground" textAnchor="middle">
                  {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface RiskProfileDetailProps {
  entityId?: string;
  onBack?: () => void;
}

export function RiskProfileDetail({ entityId = 'usr_7a8b9c', onBack }: RiskProfileDetailProps) {
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [triggeredRules, setTriggeredRules] = useState<TriggeredRule[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryPoint[]>([]);
  const [events, setEvents] = useState<RiskEventDetail[]>([]);
  const [securityFlags, setSecurityFlags] = useState<SecurityFlag[]>([]);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);

  useEffect(() => {
    // Load mock data
    setProfile(getMockProfile(entityId));
    setTriggeredRules(getMockTriggeredRules());
    setScoreHistory(getMockScoreHistory());
    setEvents(getMockEvents());
    setSecurityFlags(getMockSecurityFlags());
  }, [entityId]);

  if (!profile) {
    return <div>Loading...</div>;
  }

  const EntityIcon = getEntityIcon(profile.type);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex items-center gap-3">
            <EntityIcon className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <p className="text-muted-foreground font-mono">{profile.id}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.status === 'ACTIVE' ? (
            <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Flag className="h-4 w-4 mr-1" />
                  Security Flag setzen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Security Flag erstellen</DialogTitle>
                  <DialogDescription>
                    Setze ein Security-Flag für {profile.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Flag Type</Label>
                    <Select defaultValue="FRAUD_SUSPECTED">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FRAUD_SUSPECTED">Fraud Suspected</SelectItem>
                        <SelectItem value="PAYMENT_ISSUE">Payment Issue</SelectItem>
                        <SelectItem value="DOCUMENT_ISSUE">Document Issue</SelectItem>
                        <SelectItem value="SUSPICIOUS_ACTIVITY">Suspicious Activity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select defaultValue="HIGH">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea placeholder="Grund für das Flag..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowFlagDialog(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={() => setShowFlagDialog(false)}>
                    <Flag className="h-4 w-4 mr-1" />
                    Flag setzen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Unlock className="h-4 w-4 mr-1" />
                  Entsperren
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entity entsperren</DialogTitle>
                  <DialogDescription>
                    Alle aktiven Security-Flags entfernen
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground">
                    Dies wird alle aktiven Security-Flags entfernen und den Risk-Score neu berechnen.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>Cancel</Button>
                  <Button onClick={() => setShowUnlockDialog(false)}>
                    <Unlock className="h-4 w-4 mr-1" />
                    Entsperren
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Main Score Display */}
      <div className={`p-6 rounded-lg border-2 ${getRiskBg(profile.level)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getRiskColor(profile.level)}`}>
                {profile.score}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Risk Score</div>
            </div>
            <div className="space-y-2">
              <Badge
                variant={profile.level === 'RED' ? 'destructive' : profile.level === 'YELLOW' ? 'secondary' : 'default'}
                className="text-lg px-4 py-1"
              >
                {profile.level}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last updated: {formatDate(profile.lastUpdated)}
              </div>
              <Badge variant="outline" className="mt-2">
                Status: {profile.status}
              </Badge>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Score Breakdown</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold">{profile.userScore}</div>
                <div className="text-xs text-muted-foreground">User (40%)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{profile.companyScore}</div>
                <div className="text-xs text-muted-foreground">Company (30%)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{profile.transactionScore}</div>
                <div className="text-xs text-muted-foreground">Transaction (30%)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Triggered Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.triggeredRulesCount}</div>
            <p className="text-xs text-muted-foreground">Aktiv ausgelöste Regeln</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-orange-500" />
              Security Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.activeSecurityFlags}</div>
            <p className="text-xs text-muted-foreground">Aktive Flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ticket className="h-4 w-4 text-blue-500" />
              Support Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.linkedTickets}</div>
            <p className="text-xs text-muted-foreground">Verknüpfte Tickets</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Triggered Rules</TabsTrigger>
          <TabsTrigger value="history">Score History</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="flags">Security Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Triggered Rules</CardTitle>
              <CardDescription>Aktuell ausgelöste Risikoregeln</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Trigger Count</TableHead>
                    <TableHead>Last Triggered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggeredRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {rule.name}
                        </code>
                      </TableCell>
                      <TableCell>{rule.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${rule.weight > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {rule.weight > 0 ? '+' : ''}{rule.weight}
                        </span>
                      </TableCell>
                      <TableCell>{rule.triggerCount}x</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(rule.lastTriggered)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <ScoreHistoryChart data={scoreHistory} />
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
              <CardDescription>Alle Risk-Events für diese Entity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead className="text-right">Resulting Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.ruleName}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${event.weight > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {event.weight > 0 ? '+' : ''}{event.weight}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {JSON.stringify(event.context).slice(0, 50)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {event.resultingScore}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle>Security Flags</CardTitle>
              <CardDescription>Aktive und historische Security-Flags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className={`p-4 rounded-lg border ${flag.active ? getSeverityColor(flag.severity) : 'bg-muted'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{flag.type}</span>
                          <Badge variant="outline">{flag.severity}</Badge>
                          {flag.active && <Badge variant="destructive">Active</Badge>}
                        </div>
                        <p className="text-sm">{flag.reason}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created: {formatDate(flag.createdAt)}</span>
                          <span>By: {flag.createdBy}</span>
                        </div>
                      </div>
                      {!flag.active && (
                        <Button size="sm" variant="outline">
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RiskProfileDetail;
