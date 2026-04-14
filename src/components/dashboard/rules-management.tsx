'use client';

// ============================================
// CARGOBIT RISK DASHBOARD - RULES MANAGEMENT
// Regeln-Liste, Edit-View, Test-Funktion (ADMIN/SECURITY only)
// ============================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { Slider } from '@/components/ui/slider';
import {
  AlertTriangle,
  Shield,
  Settings,
  Plus,
  Search,
  Filter,
  Edit,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Code,
  Zap,
  Save,
  RotateCcw,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type EntityType = 'USER' | 'COMPANY' | 'TRANSACTION';
type RuleCategory = 'USER' | 'COMPANY' | 'TRANSACTION' | 'BEHAVIOR' | 'DOCUMENT' | 'SECURITY';

interface RiskRule {
  id: string;
  name: string;
  description: string;
  entityType: EntityType;
  category: RuleCategory;
  condition: RuleCondition;
  weight: number;
  priority: number;
  active: boolean;
  triggerCount: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
}

interface RuleCondition {
  field?: string;
  equals?: string | number | boolean;
  not_equals?: string | number | boolean;
  greater_than?: number;
  less_than?: number;
  greater_than_or_equal?: number;
  less_than_or_equal?: number;
  contains_any?: (string | number)[];
  and?: RuleCondition[];
  or?: RuleCondition[];
}

interface TestResult {
  matched: boolean;
  evaluatedFields: Record<string, unknown>;
  conditionPath: string[];
}

// ============================================
// MOCK DATA
// ============================================

function getMockRules(): RiskRule[] {
  return [
    {
      id: 'user_kyc_missing',
      name: 'KYC_UNVOLLSTAENDIG',
      description: 'KYC-Verifizierung nicht abgeschlossen',
      entityType: 'USER',
      category: 'DOCUMENT',
      condition: { field: 'kyc_status', equals: 'missing' },
      weight: 20,
      priority: 10,
      active: true,
      triggerCount: 156,
      lastTriggered: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'user_new_iban',
      name: 'NEUE_IBAN',
      description: 'Neue IBAN in den letzten 48h',
      entityType: 'USER',
      category: 'USER',
      condition: { field: 'iban_age_hours', less_than: 48 },
      weight: 15,
      priority: 8,
      active: true,
      triggerCount: 89,
      lastTriggered: new Date(Date.now() - 3600000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'user_fraud_flag',
      name: 'FRAUD_FLAG',
      description: 'Betrugsverdacht in den letzten 90 Tagen',
      entityType: 'USER',
      category: 'SECURITY',
      condition: { field: 'fraud_flag_days', less_than: 90 },
      weight: 30,
      priority: 18,
      active: true,
      triggerCount: 12,
      lastTriggered: new Date(Date.now() - 86400000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'user_high_rating',
      name: 'HOHE_BEWERTUNG',
      description: 'Exzellente Bewertung über 4.7',
      entityType: 'USER',
      category: 'BEHAVIOR',
      condition: { field: 'rating_avg', greater_than: 4.7 },
      weight: -10,
      priority: 3,
      active: true,
      triggerCount: 234,
      lastTriggered: new Date(Date.now() - 1800000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'tx_high_amount',
      name: 'HOHER_BETRAG',
      description: 'Betrag über 50.000 EUR',
      entityType: 'TRANSACTION',
      category: 'TRANSACTION',
      condition: { field: 'amount', greater_than: 50000 },
      weight: 20,
      priority: 10,
      active: true,
      triggerCount: 45,
      lastTriggered: new Date(Date.now() - 7200000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'tx_intl_hazmat',
      name: 'INTERNATIONAL_GEFAHRGUT',
      description: 'Internationaler Gefahrgut-Transport',
      entityType: 'TRANSACTION',
      category: 'TRANSACTION',
      condition: {
        and: [
          { field: 'international', equals: true },
          { field: 'hazmat', equals: true },
        ],
      },
      weight: 20,
      priority: 10,
      active: true,
      triggerCount: 23,
      lastTriggered: new Date(Date.now() - 14400000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'company_kyb_missing',
      name: 'KYB_FEHLT',
      description: 'KYB-Verifizierung fehlt',
      entityType: 'COMPANY',
      category: 'DOCUMENT',
      condition: { field: 'kyb_status', equals: 'missing' },
      weight: 20,
      priority: 10,
      active: true,
      triggerCount: 67,
      lastTriggered: new Date(Date.now() - 10800000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'company_fraud_flags',
      name: 'FRAUD_FLAGS',
      description: 'Aktive Fraud-Flags',
      entityType: 'COMPANY',
      category: 'SECURITY',
      condition: { field: 'fraud_flags', greater_than: 0 },
      weight: 25,
      priority: 15,
      active: true,
      triggerCount: 8,
      lastTriggered: new Date(Date.now() - 21600000).toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      isSystem: true,
    },
    {
      id: 'custom_vip_user',
      name: 'VIP_KUNDE',
      description: 'VIP-Kunde mit langer Historie',
      entityType: 'USER',
      category: 'USER',
      condition: {
        and: [
          { field: 'account_age_days', greater_than: 730 },
          { field: 'completed_transports', greater_than: 100 },
          { field: 'rating_avg', greater_than: 4.5 },
        ],
      },
      weight: -15,
      priority: 5,
      active: true,
      triggerCount: 12,
      lastTriggered: new Date(Date.now() - 86400000).toISOString(),
      createdAt: '2024-03-15T00:00:00Z',
      updatedAt: '2024-03-15T00:00:00Z',
      isSystem: false,
    },
  ];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEntityTypeColor = (type: EntityType) => {
  switch (type) {
    case 'USER':
      return 'bg-blue-100 text-blue-800';
    case 'COMPANY':
      return 'bg-purple-100 text-purple-800';
    case 'TRANSACTION':
      return 'bg-orange-100 text-orange-800';
  }
};

const getCategoryColor = (category: RuleCategory) => {
  switch (category) {
    case 'SECURITY':
      return 'bg-red-100 text-red-800';
    case 'DOCUMENT':
      return 'bg-yellow-100 text-yellow-800';
    case 'BEHAVIOR':
      return 'bg-green-100 text-green-800';
    case 'USER':
      return 'bg-blue-100 text-blue-800';
    case 'COMPANY':
      return 'bg-purple-100 text-purple-800';
    case 'TRANSACTION':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ============================================
// JSON CONDITION EDITOR
// ============================================

function ConditionEditor({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
}) {
  const conditionJson = JSON.stringify(condition, null, 2);

  const handleChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
    } catch {
      // Invalid JSON, don't update
    }
  };

  return (
    <div className="space-y-2">
      <Label>Condition (JSON)</Label>
      <Textarea
        value={conditionJson}
        onChange={(e) => handleChange(e.target.value)}
        className="font-mono text-sm min-h-[150px]"
        placeholder='{"field": "kyc_status", "equals": "missing"}'
      />
      <p className="text-xs text-muted-foreground">
        Unterstützte Operatoren: equals, not_equals, greater_than, less_than, contains_any, and, or
      </p>
    </div>
  );
}

// ============================================
// RULE TEST PANEL
// ============================================

function RuleTestPanel({
  rule,
  onTest,
}: {
  rule: RiskRule;
  onTest: (context: Record<string, unknown>) => TestResult;
}) {
  const [testContext, setTestContext] = useState<string>(
    JSON.stringify(
      {
        kyc_status: 'missing',
        iban_age_hours: 12,
        rating_avg: 4.8,
        amount: 75000,
        international: true,
        hazmat: false,
      },
      null,
      2
    )
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const runTest = () => {
    try {
      const context = JSON.parse(testContext);
      const result = onTest(context);
      setTestResult(result);
    } catch {
      setTestResult({
        matched: false,
        evaluatedFields: {},
        conditionPath: ['Error: Invalid JSON context'],
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Test Context (JSON)</Label>
        <Textarea
          value={testContext}
          onChange={(e) => setTestContext(e.target.value)}
          className="font-mono text-sm min-h-[100px]"
        />
      </div>
      <Button onClick={runTest} className="w-full">
        <Play className="h-4 w-4 mr-2" />
        Test Rule
      </Button>
      {testResult && (
        <div
          className={`p-4 rounded-lg border ${
            testResult.matched
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {testResult.matched ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium">
              {testResult.matched ? 'Condition MATCHED' : 'Condition NOT matched'}
            </span>
          </div>
          <div className="text-sm space-y-1">
            <div className="font-medium">Evaluated Fields:</div>
            <code className="text-xs bg-white/50 p-1 rounded block">
              {JSON.stringify(testResult.evaluatedFields, null, 2)}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EDIT RULE DIALOG
// ============================================

function EditRuleDialog({
  rule,
  onSave,
  onDelete,
}: {
  rule: RiskRule;
  onSave: (rule: RiskRule) => void;
  onDelete: (ruleId: string) => void;
}) {
  const [editedRule, setEditedRule] = useState<RiskRule>(rule);
  const [activeTab, setActiveTab] = useState<'edit' | 'test'>('edit');

  const handleSave = () => {
    onSave(editedRule);
  };

  const testRule = (context: Record<string, unknown>): TestResult => {
    // Simple condition evaluation
    const evaluate = (condition: RuleCondition): boolean => {
      if (condition.and) {
        return condition.and.every(evaluate);
      }
      if (condition.or) {
        return condition.or.some(evaluate);
      }
      if (condition.field) {
        const fieldValue = context[condition.field];
        if (condition.equals !== undefined) return fieldValue === condition.equals;
        if (condition.not_equals !== undefined) return fieldValue !== condition.not_equals;
        if (condition.greater_than !== undefined && typeof fieldValue === 'number') {
          return fieldValue > condition.greater_than;
        }
        if (condition.less_than !== undefined && typeof fieldValue === 'number') {
          return fieldValue < condition.less_than;
        }
        if (condition.greater_than_or_equal !== undefined && typeof fieldValue === 'number') {
          return fieldValue >= condition.greater_than_or_equal;
        }
        if (condition.less_than_or_equal !== undefined && typeof fieldValue === 'number') {
          return fieldValue <= condition.less_than_or_equal;
        }
      }
      return false;
    };

    return {
      matched: evaluate(editedRule.condition),
      evaluatedFields: context,
      conditionPath: [editedRule.name],
    };
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5" />
          Edit Rule: {rule.name}
        </DialogTitle>
        <DialogDescription>
          {rule.isSystem ? (
            <span className="flex items-center gap-1 text-orange-500">
              <AlertCircle className="h-4 w-4" />
              System Rule - Limited editing
            </span>
          ) : (
            'Custom Rule - Full editing available'
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'edit' ? 'default' : 'outline'}
          onClick={() => setActiveTab('edit')}
        >
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          variant={activeTab === 'test' ? 'default' : 'outline'}
          onClick={() => setActiveTab('test')}
        >
          <Play className="h-4 w-4 mr-1" />
          Test
        </Button>
      </div>

      {activeTab === 'edit' ? (
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rule ID</Label>
              <Input value={rule.id} disabled className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Input value={rule.entityType} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={editedRule.description}
              onChange={(e) => setEditedRule({ ...editedRule, description: e.target.value })}
              disabled={rule.isSystem}
            />
          </div>

          <ConditionEditor
            condition={editedRule.condition}
            onChange={(condition) => setEditedRule({ ...editedRule, condition })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight: {editedRule.weight}</Label>
              <Slider
                value={[editedRule.weight]}
                onValueChange={([value]) => setEditedRule({ ...editedRule, weight: value })}
                min={-30}
                max={50}
                step={5}
                disabled={rule.isSystem}
              />
              <p className="text-xs text-muted-foreground">
                Positive = erhöht Risiko, Negative = senkt Risiko
              </p>
            </div>
            <div className="space-y-2">
              <Label>Priority: {editedRule.priority}</Label>
              <Slider
                value={[editedRule.priority]}
                onValueChange={([value]) => setEditedRule({ ...editedRule, priority: value })}
                min={0}
                max={20}
                step={1}
                disabled={rule.isSystem}
              />
              <p className="text-xs text-muted-foreground">
                Höhere Priorität wird zuerst ausgewertet
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Active</Label>
            <Switch
              id="active"
              checked={editedRule.active}
              onCheckedChange={(active) => setEditedRule({ ...editedRule, active })}
            />
          </div>
        </div>
      ) : (
        <div className="py-4">
          <RuleTestPanel rule={editedRule} onTest={testRule} />
        </div>
      )}

      <DialogFooter className="flex justify-between">
        <div>
          {!rule.isSystem && (
            <Button variant="destructive" onClick={() => onDelete(rule.id)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditedRule(rule)}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================
// CREATE RULE DIALOG
// ============================================

function CreateRuleDialog({
  onCreate,
}: {
  onCreate: (rule: Omit<RiskRule, 'id' | 'triggerCount' | 'lastTriggered' | 'createdAt' | 'updatedAt' | 'isSystem'>) => void;
}) {
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    entityType: 'USER' as EntityType,
    category: 'USER' as RuleCategory,
    condition: { field: '', equals: '' },
    weight: 10,
    priority: 5,
    active: true,
  });

  const handleCreate = () => {
    onCreate(newRule);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Rule
        </DialogTitle>
        <DialogDescription>
          Definiere eine neue Risikoregel
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Rule Name</Label>
            <Input
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="z.B. VIP_KUNDE"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select
              value={newRule.entityType}
              onValueChange={(value) => setNewRule({ ...newRule, entityType: value as EntityType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="COMPANY">COMPANY</SelectItem>
                <SelectItem value="TRANSACTION">TRANSACTION</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={newRule.description}
            onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            placeholder="Beschreibe die Regel..."
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={newRule.category}
            onValueChange={(value) => setNewRule({ ...newRule, category: value as RuleCategory })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">USER</SelectItem>
              <SelectItem value="COMPANY">COMPANY</SelectItem>
              <SelectItem value="TRANSACTION">TRANSACTION</SelectItem>
              <SelectItem value="BEHAVIOR">BEHAVIOR</SelectItem>
              <SelectItem value="DOCUMENT">DOCUMENT</SelectItem>
              <SelectItem value="SECURITY">SECURITY</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ConditionEditor
          condition={newRule.condition}
          onChange={(condition) => setNewRule({ ...newRule, condition })}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Weight: {newRule.weight}</Label>
            <Slider
              value={[newRule.weight]}
              onValueChange={([value]) => setNewRule({ ...newRule, weight: value })}
              min={-30}
              max={50}
              step={5}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority: {newRule.priority}</Label>
            <Slider
              value={[newRule.priority]}
              onValueChange={([value]) => setNewRule({ ...newRule, priority: value })}
              min={0}
              max={20}
              step={1}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="active-new">Active</Label>
          <Switch
            id="active-new"
            checked={newRule.active}
            onCheckedChange={(active) => setNewRule({ ...newRule, active })}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Rule
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RulesManagement() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    setRules(getMockRules());
  }, []);

  const filteredRules = rules.filter((rule) => {
    const matchesType = filterType === 'all' || rule.entityType === filterType;
    const matchesCategory = filterCategory === 'all' || rule.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesCategory && matchesSearch;
  });

  const handleSaveRule = (updatedRule: RiskRule) => {
    setRules(rules.map((r) => (r.id === updatedRule.id ? updatedRule : r)));
    setEditingRule(null);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(rules.filter((r) => r.id !== ruleId));
    setEditingRule(null);
  };

  const handleCreateRule = (
    newRule: Omit<RiskRule, 'id' | 'triggerCount' | 'lastTriggered' | 'createdAt' | 'updatedAt' | 'isSystem'>
  ) => {
    const rule: RiskRule = {
      ...newRule,
      id: `custom_${Date.now()}`,
      triggerCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystem: false,
    };
    setRules([...rules, rule]);
    setShowCreateDialog(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Rules Management
          </h1>
          <p className="text-muted-foreground">
            Verwalte Risk-Regeln • ADMIN / SECURITY only
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Rule
            </Button>
          </DialogTrigger>
          <CreateRuleDialog onCreate={handleCreateRule} />
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{rules.length}</div>
            <p className="text-xs text-muted-foreground">Total Rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{rules.filter((r) => r.active).length}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{rules.filter((r) => r.isSystem).length}</div>
            <p className="text-xs text-muted-foreground">System Rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{rules.filter((r) => !r.isSystem).length}</div>
            <p className="text-xs text-muted-foreground">Custom Rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="COMPANY">COMPANY</SelectItem>
                <SelectItem value="TRANSACTION">TRANSACTION</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="COMPANY">COMPANY</SelectItem>
                <SelectItem value="TRANSACTION">TRANSACTION</SelectItem>
                <SelectItem value="BEHAVIOR">BEHAVIOR</SelectItem>
                <SelectItem value="DOCUMENT">DOCUMENT</SelectItem>
                <SelectItem value="SECURITY">SECURITY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Rules</CardTitle>
          <CardDescription>
            {filteredRules.length} Regeln angezeigt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Triggers</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule) => (
                <TableRow key={rule.id} className={!rule.active ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rule.name}
                      </code>
                      {rule.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {rule.description}
                  </TableCell>
                  <TableCell>
                    <Badge className={getEntityTypeColor(rule.entityType)}>
                      {rule.entityType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryColor(rule.category)}>
                      {rule.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-bold ${
                        rule.weight > 0 ? 'text-red-500' : 'text-green-500'
                      }`}
                    >
                      {rule.weight > 0 ? '+' : ''}
                      {rule.weight}
                    </span>
                  </TableCell>
                  <TableCell>
                    {rule.active ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {rule.triggerCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.lastTriggered ? formatDate(rule.lastTriggered) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setEditingRule(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      {editingRule?.id === rule.id && (
                        <EditRuleDialog
                          rule={editingRule}
                          onSave={handleSaveRule}
                          onDelete={handleDeleteRule}
                        />
                      )}
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default RulesManagement;
