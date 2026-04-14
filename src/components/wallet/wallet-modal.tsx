'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Euro,
  Calendar,
  AlertTriangle,
  CreditCard,
  Building2,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payment_in' | 'payment_out' | 'commission' | 'fee' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  date: string;
}

const mockTransactions: Transaction[] = [
  { id: '1', type: 'payment_in', amount: 450, status: 'completed', description: 'Transport #4521 abgeschlossen', date: '2024-01-15' },
  { id: '2', type: 'commission', amount: -22.5, status: 'completed', description: 'Plattformgebühr (5%)', date: '2024-01-15' },
  { id: '3', type: 'withdrawal', amount: -500, status: 'pending', description: 'Auszahlung an DE89370400440532013000', date: '2024-01-14' },
  { id: '4', type: 'payment_in', amount: 280, status: 'completed', description: 'Transport #4518 abgeschlossen', date: '2024-01-13' },
  { id: '5', type: 'deposit', amount: 1000, status: 'completed', description: 'Einzahlung per Überweisung', date: '2024-01-10' },
  { id: '6', type: 'refund', amount: 150, status: 'completed', description: 'Rückerstattung Transport #4500', date: '2024-01-08' },
];

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [iban, setIban] = useState('DE89370400440532013000');
  const [bic, setBic] = useState('COBADEFFXXX');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const balance = 1250.50;
  const availableBalance = 1150.50;
  const pendingBalance = 100.00;

  const handleDeposit = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setDepositAmount('');
    setActiveTab('overview');
  };

  const handleWithdraw = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setWithdrawAmount('');
    setActiveTab('overview');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
      case 'payment_in':
      case 'refund':
        return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
      case 'withdrawal':
      case 'payment_out':
      case 'commission':
      case 'fee':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      default:
        return <Euro className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500/10 text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Abgeschlossen</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Ausstehend</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Fehlgeschlagen</Badge>;
    }
  };

  const getTypeLabel = (type: Transaction['type']) => {
    const labels: Record<Transaction['type'], string> = {
      deposit: 'Einzahlung',
      withdrawal: 'Auszahlung',
      payment_in: 'Zahlungseingang',
      payment_out: 'Zahlungsausgang',
      commission: 'Provision',
      fee: 'Gebühr',
      refund: 'Rückerstattung',
    };
    return labels[type];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon className="w-5 h-5" />
            Wallet
          </DialogTitle>
          <DialogDescription>
            Verwalten Sie Ihr Guthaben und Transaktionen
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="deposit">Einzahlung</TabsTrigger>
            <TabsTrigger value="withdraw">Auszahlung</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Balance Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Gesamtguthaben</div>
                    <div className="text-2xl font-bold text-primary">€{balance.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Verfügbar</div>
                    <div className="text-2xl font-bold text-green-600">€{availableBalance.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Ausstehend</div>
                    <div className="text-2xl font-bold text-yellow-600">€{pendingBalance.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Payout Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Auszahlungseinstellungen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{iban}</span>
                    </div>
                    <Button variant="ghost" size="sm">Ändern</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Wöchentliche Auszahlung</span>
                    </div>
                    <Badge variant="secondary">Automatisch</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Letzte Transaktionen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {getTypeIcon(tx.type)}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{tx.description}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{getTypeLabel(tx.type)}</span>
                              <span>•</span>
                              <span>{tx.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                          </div>
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deposit Tab */}
            <TabsContent value="deposit" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Einzahlung vornehmen</CardTitle>
                  <CardDescription>
                    Überweisen Sie Geld auf Ihr CargoBit-Konto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-2">Bankverbindung</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">IBAN:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm">DE12 3456 7890 1234 5678 90</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard('DE12345678901234567890')}>
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">BIC:</span>
                        <code className="text-sm">COBADEFFXXX</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Kontoinhaber:</span>
                        <code className="text-sm">CargoBit GmbH</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Verwendungszweck:</span>
                        <code className="text-sm text-primary font-medium">CB-{Date.now().toString().slice(-8)}</code>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium">Wichtiger Hinweis</div>
                        <div className="text-muted-foreground">
                          Geben Sie immer den angezeigten Verwendungszweck an, damit Ihre Einzahlung automatisch zugeordnet werden kann.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Geplante Einzahlung (optional)</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Betrag eingeben"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gebühren: Kostenlos für Einzahlungen über €100, sonst €1.50
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Withdraw Tab */}
            <TabsContent value="withdraw" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auszahlung beantragen</CardTitle>
                  <CardDescription>
                    Lassen Sie Ihr Guthaben auf Ihr Bankkonto auszahlen
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Verfügbar zur Auszahlung</div>
                        <div className="text-2xl font-bold text-green-600">€{availableBalance.toFixed(2)}</div>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Auszahlungsbetrag</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Betrag eingeben"
                        className="pl-10"
                        max={availableBalance}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ziel-IBAN</Label>
                    <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Auszahlungsbetrag</span>
                      <span>€{(parseFloat(withdrawAmount) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Gebühr (0.5%)</span>
                      <span>-€{((parseFloat(withdrawAmount) || 0) * 0.005).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Auszahlung</span>
                      <span>€{((parseFloat(withdrawAmount) || 0) * 0.995).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium">Bearbeitungszeit</div>
                        <div className="text-muted-foreground">
                          Auszahlungen werden innerhalb von 1-3 Werktagen bearbeitet.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleWithdraw}
                    disabled={isProcessing || !withdrawAmount || parseFloat(withdrawAmount) > availableBalance}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Auszahlung beantragen
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
