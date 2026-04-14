'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  Package,
  Wallet,
  Star,
  TrendingUp,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Plus,
  FileText,
  Users,
  BarChart3,
  Calendar,
  Bell,
  Settings,
  LogOut,
  User,
  Building2,
  Bot,
  Globe,
  Moon,
  Sun,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore, type User as UserType } from '@/lib/auth-store';

interface DashboardProps {
  onLogout: () => void;
  onNewTransport: () => void;
}

export function Dashboard({ onLogout, onNewTransport }: DashboardProps) {
  const { user } = useAuthStore();

  if (!user) return null;

  const renderDashboardByRole = () => {
    switch (user.role) {
      case 'SHIPPER_PRIVATE':
      case 'SHIPPER_COMPANY':
        return <ShipperDashboard user={user} onNewTransport={onNewTransport} />;
      case 'DRIVER_SELF_EMPLOYED':
        return <DriverDashboard user={user} />;
      case 'DISPATCHER':
        return <DispatcherDashboard user={user} />;
      case 'ADMIN':
        return <AdminDashboard user={user} />;
      default:
        return <ShipperDashboard user={user} onNewTransport={onNewTransport} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">CargoBit</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Globe className="w-5 h-5" />
              </Button>
              
              {/* User menu */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="font-medium">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {user.role.includes('SHIPPER') ? (
                    <User className="w-5 h-5 text-primary" />
                  ) : user.role === 'DRIVER_SELF_EMPLOYED' ? (
                    <Truck className="w-5 h-5 text-primary" />
                  ) : user.role === 'DISPATCHER' ? (
                    <Users className="w-5 h-5 text-primary" />
                  ) : (
                    <Settings className="w-5 h-5 text-primary" />
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onLogout}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboardByRole()}
      </main>
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    SHIPPER_PRIVATE: 'Privatkunde',
    SHIPPER_COMPANY: 'Firmenkunde',
    DRIVER_SELF_EMPLOYED: 'Fahrer',
    DISPATCHER: 'Disponent',
    ADMIN: 'Administrator',
    SUPPORT: 'Support',
    MARKETER: 'Marketer',
  };
  return labels[role] || role;
}

// Shipper Dashboard
function ShipperDashboard({ user, onNewTransport }: { user: UserType; onNewTransport: () => void }) {
  const stats = [
    { label: 'Aktive Transporte', value: '3', icon: <Truck className="w-5 h-5" />, color: 'text-blue-500' },
    { label: 'Warte auf Angebote', value: '2', icon: <Clock className="w-5 h-5" />, color: 'text-yellow-500' },
    { label: 'Abgeschlossen', value: '24', icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-500' },
    { label: 'Wallet', value: '€1,250.00', icon: <Wallet className="w-5 h-5" />, color: 'text-primary' },
  ];

  const recentTransports = [
    { id: 1, route: 'Berlin → München', status: 'in_transit', driver: 'Thomas W.', price: 450 },
    { id: 2, route: 'Hamburg → Köln', status: 'pending', driver: null, price: null },
    { id: 3, route: 'Frankfurt → Stuttgart', status: 'delivered', driver: 'Anna S.', price: 320 },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Willkommen zurück, {user.firstName}!</h1>
          <p className="text-muted-foreground">Hier ist Ihre Übersicht</p>
        </div>
        <Button onClick={onNewTransport} className="gap-2">
          <Plus className="w-4 h-4" />
          Neuen Transport anlegen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transports */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Letzte Transporte</CardTitle>
            <CardDescription>Ihre aktuellen und kürzlichen Transporte</CardDescription>
          </div>
          <Button variant="outline" size="sm">Alle anzeigen</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransports.map((transport) => (
              <div key={transport.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{transport.route}</div>
                    <div className="text-sm text-muted-foreground">
                      {transport.driver ? `Fahrer: ${transport.driver}` : 'Warte auf Angebote'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={transport.status === 'in_transit' ? 'default' : transport.status === 'pending' ? 'secondary' : 'outline'}>
                    {transport.status === 'in_transit' ? 'Unterwegs' : transport.status === 'pending' ? 'Ausstehend' : 'Geliefert'}
                  </Badge>
                  {transport.price && (
                    <div className="font-semibold">€{transport.price}</div>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <div className="font-semibold">Wallet aufladen</div>
                <div className="text-sm text-muted-foreground">Guthaben hinzufügen</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="font-semibold">Dokumente</div>
                <div className="text-sm text-muted-foreground">CMR, Rechnungen & mehr</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <div className="font-semibold">Statistiken</div>
                <div className="text-sm text-muted-foreground">Ihre Transport-Analyse</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Driver Dashboard
function DriverDashboard({ user }: { user: UserType }) {
  const stats = [
    { label: 'Verfügbarer Verdienst', value: '€3,420', icon: <Wallet className="w-5 h-5" />, color: 'text-green-500' },
    { label: 'Abgeschlossene Touren', value: '342', icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-blue-500' },
    { label: 'Bewertung', value: '4.9 ⭐', icon: <Star className="w-5 h-5" />, color: 'text-yellow-500' },
    { label: 'Diese Woche', value: '8 Touren', icon: <Truck className="w-5 h-5" />, color: 'text-primary' },
  ];

  const availableJobs = [
    { id: 1, route: 'Berlin → München', distance: '585 km', price: 650, type: 'Paletten', pickup: 'Heute 14:00' },
    { id: 2, route: 'Hamburg → Bremen', distance: '120 km', price: 180, type: 'Stückgut', pickup: 'Morgen 08:00' },
    { id: 3, route: 'Köln → Frankfurt', distance: '190 km', price: 320, type: 'Kühl', pickup: 'Morgen 10:00' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hallo, {user.firstName}!</h1>
          <p className="text-muted-foreground">Bereit für neue Aufträge?</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <MapPin className="w-4 h-4" />
            Standort aktualisieren
          </Button>
          <Button className="gap-2">
            <Truck className="w-4 h-4" />
            Verfügbar machen
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next Job */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Nächster Auftrag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Berlin → Dresden</div>
              <div className="text-muted-foreground">Abholung: Heute um 10:00 Uhr</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">€280</div>
                <div className="text-sm text-muted-foreground">195 km</div>
              </div>
              <Button className="gap-2">
                Tour starten
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Verfügbare Aufträge</CardTitle>
          <CardDescription>Neue Aufträge in Ihrer Nähe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{job.route}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{job.type}</span>
                      <span>•</span>
                      <span>{job.distance}</span>
                      <span>•</span>
                      <span>{job.pickup}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-semibold text-primary">€{job.price}</div>
                  <Button size="sm">Annehmen</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Dispatcher Dashboard
function DispatcherDashboard({ user }: { user: UserType }) {
  const fleetStats = [
    { label: 'Fahrzeuge', value: '12', active: '8 unterwegs' },
    { label: 'Fahrer', value: '15', active: '10 aktiv' },
    { label: 'Heutige Touren', value: '18', active: '12 offen' },
    { label: 'Umsatz Monat', value: '€45.200', active: '+12%' },
  ];

  const alerts = [
    { type: 'warning', message: 'Fahrer Thomas W. meldet Verspätung auf Tour B-284' },
    { type: 'info', message: 'Neuer Auftrag: Berlin → München für morgen 08:00' },
    { type: 'success', message: 'Tour B-281 erfolgreich abgeschlossen' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dispatcher Dashboard</h1>
          <p className="text-muted-foreground">{user.companyName || 'Ihre Flotte'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Users className="w-4 h-4" />
            Fahrer verwalten
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Tour planen
          </Button>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {fleetStats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.active}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fleet Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Flottenübersicht</CardTitle>
            <CardDescription>Aktueller Status aller Fahrzeuge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'Truck-01 (MAN)', driver: 'Thomas W.', status: 'Unterwegs', route: 'Berlin → München' },
                { name: 'Truck-02 (DAF)', driver: 'Anna S.', status: 'Beladen', route: 'Hamburg → Köln' },
                { name: 'Truck-03 (VOLVO)', driver: 'Peter M.', status: 'Verfügbar', route: 'Berlin' },
                { name: 'Truck-04 (SCANIA)', driver: 'Klaus R.', status: 'Unterwegs', route: 'Frankfurt → Stuttgart' },
                { name: 'Truck-05 (IVECO)', driver: null, status: 'Inaktiv', route: 'Werkstatt' },
              ].map((truck, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      truck.status === 'Unterwegs' ? 'bg-green-500 animate-pulse' :
                      truck.status === 'Beladen' ? 'bg-yellow-500' :
                      truck.status === 'Verfügbar' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <div className="font-medium text-sm">{truck.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {truck.driver || 'Kein Fahrer'} • {truck.route}
                      </div>
                    </div>
                  </div>
                  <Badge variant={truck.status === 'Verfügbar' ? 'default' : 'secondary'}>
                    {truck.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Warnungen & Benachrichtigungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.type === 'warning' ? 'bg-yellow-500/10' :
                  alert.type === 'success' ? 'bg-green-500/10' : 'bg-blue-500/10'
                }`}>
                  {alert.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                  ) : alert.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Bell className="w-5 h-5 text-blue-500 shrink-0" />
                  )}
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Calendar Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Kapazitätskalender
          </CardTitle>
          <CardDescription>Planen Sie Ihre Kapazitäten für die kommenden Wochen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
            Kapazitätskalender - Drag & Drop Planung
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard({ user }: { user: UserType }) {
  const systemStats = [
    { label: 'Benutzer gesamt', value: '12,458', change: '+234' },
    { label: 'Aktive Transporte', value: '3,842', change: '+89' },
    { label: 'Umsatz (Monat)', value: '€234,500', change: '+18%' },
    { label: 'Ausstehende Verifizierungen', value: '47', change: '-12' },
  ];

  const recentActivity = [
    { type: 'user', message: 'Neuer Benutzer: max.mueller@email.de', time: 'vor 2 Min.' },
    { type: 'transport', message: 'Transport #4521 abgeschlossen', time: 'vor 5 Min.' },
    { type: 'payment', message: 'Auszahlung €2,500 an driver@cargobit.eu', time: 'vor 12 Min.' },
    { type: 'verification', message: 'Identitätsverifizierung genehmigt: Anna Schmidt', time: 'vor 25 Min.' },
    { type: 'alert', message: 'Support-Ticket #892: Streitfall bei Transport #4518', time: 'vor 30 Min.' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Systemübersicht und Verwaltung</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            Einstellungen
          </Button>
          <Button className="gap-2">
            <Bot className="w-4 h-4" />
            KI-Status
          </Button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {systemStats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <span className={`text-sm ${
                  stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stat.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.type === 'user' ? 'bg-blue-500/10' :
                    activity.type === 'transport' ? 'bg-green-500/10' :
                    activity.type === 'payment' ? 'bg-yellow-500/10' :
                    activity.type === 'verification' ? 'bg-purple-500/10' :
                    'bg-red-500/10'
                  }`}>
                    {activity.type === 'user' && <User className="w-5 h-5 text-blue-500" />}
                    {activity.type === 'transport' && <Truck className="w-5 h-5 text-green-500" />}
                    {activity.type === 'payment' && <Wallet className="w-5 h-5 text-yellow-500" />}
                    {activity.type === 'verification' && <CheckCircle2 className="w-5 h-5 text-purple-500" />}
                    {activity.type === 'alert' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schnellaktionen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="w-4 h-4" />
                Benutzer verwalten
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <AlertTriangle className="w-4 h-4" />
                Streitfälle (3)
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Verifizierungen (47)
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <BarChart3 className="w-4 h-4" />
                Berichte
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System-Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Server</span>
                  <Badge variant="default">Online</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Datenbank</span>
                  <Badge variant="default">Online</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">KI Service</span>
                  <Badge variant="default">Online</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Payment Gateway</span>
                  <Badge variant="default">Online</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
