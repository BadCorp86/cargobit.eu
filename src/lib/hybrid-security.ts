// ============================================
// CARGOBIT HYBRID SECURITY LAYER
// Combines Permission Matrix + Risk Scoring
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  SystemRole, 
  Permission, 
  hasPermission, 
  hasAnyPermission,
  ROLE_PERMISSIONS 
} from '@/types/permissions';
import { 
  calculateCombinedRiskScore,
  calculateUserRiskScore,
  calculateTransactionRiskScore,
  RiskScore,
  RiskLevel,
  CombinedRiskScore,
  TransactionRiskContext,
} from '@/lib/risk-scoring';
import { db } from '@/lib/db';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface SecurityContext {
  userId: string;
  email: string;
  roles: SystemRole[];
  companyId?: string;
  companyRole?: 'owner' | 'admin' | 'member';
  isVerified: boolean;
  riskScore: number;
  activeSecurityFlags: number;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  code: 'PERMISSION_DENIED' | 'RISK_TOO_HIGH' | 'VERIFICATION_REQUIRED' | 'ACCOUNT_RESTRICTED' | 'ALLOWED';
  requiredPermission?: Permission;
  missingVerifications?: string[];
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskFactors?: string[];
}

export interface HybridSecurityResult {
  permissionCheck: PermissionCheckResult;
  riskCheck?: {
    passed: boolean;
    score: number;
    level: RiskLevel;
    recommendation: string;
    factors: string[];
  };
  auditId?: string;
}

// ============================================
// COMPACT PERMISSION MATRIX
// Based on user specification
// ============================================

export const COMPACT_PERMISSION_MATRIX = {
  // Action definitions
  ACTIONS: {
    CREATE_TRANSPORT: 'transport:create',
    VIEW_TRANSPORT: 'transport:read',
    ACCEPT_OFFER: 'offer:accept',
    MAKE_OFFER: 'offer:create',
    ASSIGN_DRIVER: 'transport:assign_driver',
    UPDATE_STATUS: 'transport:update_status',
    VIEW_WALLET: 'wallet:read',
    INITIATE_PAYOUT: 'wallet:withdraw',
    MANAGE_VEHICLES: 'vehicle:write',
    MANAGE_USERS: 'user:write',
    MANAGE_PLANS: 'system:manage_plans',
  } as const,

  // Role -> Action matrix (true = allowed, false = denied)
  MATRIX: {
    ADMIN: {
      CREATE_TRANSPORT: false,
      VIEW_TRANSPORT: true,        // ✅ (alle)
      ACCEPT_OFFER: false,
      MAKE_OFFER: false,
      ASSIGN_DRIVER: false,
      UPDATE_STATUS: false,
      VIEW_WALLET: true,           // ✅ (alle)
      INITIATE_PAYOUT: true,       // ✅ (alle)
      MANAGE_VEHICLES: false,
      MANAGE_USERS: true,          // ✅
      MANAGE_PLANS: true,          // ✅
    },
    SUPPORT: {
      CREATE_TRANSPORT: false,
      VIEW_TRANSPORT: true,        // ✅ (read)
      ACCEPT_OFFER: false,
      MAKE_OFFER: false,
      ASSIGN_DRIVER: false,
      UPDATE_STATUS: false,
      VIEW_WALLET: true,           // ✅ (read)
      INITIATE_PAYOUT: false,
      MANAGE_VEHICLES: false,
      MANAGE_USERS: false,
      MANAGE_PLANS: false,
    },
    SHIPPER: {
      CREATE_TRANSPORT: true,      // ✅
      VIEW_TRANSPORT: true,        // ✅ (own)
      ACCEPT_OFFER: true,          // ✅
      MAKE_OFFER: false,
      ASSIGN_DRIVER: false,
      UPDATE_STATUS: false,
      VIEW_WALLET: true,           // ✅ (own)
      INITIATE_PAYOUT: true,       // ✅ (own)
      MANAGE_VEHICLES: false,
      MANAGE_USERS: false,
      MANAGE_PLANS: false,
    },
    DISPATCHER: {
      CREATE_TRANSPORT: false,
      VIEW_TRANSPORT: true,        // ✅ (company)
      ACCEPT_OFFER: false,
      MAKE_OFFER: true,            // ✅
      ASSIGN_DRIVER: true,         // ✅
      UPDATE_STATUS: true,         // ✅
      VIEW_WALLET: true,           // ✅ (company)
      INITIATE_PAYOUT: false,
      MANAGE_VEHICLES: true,       // ✅
      MANAGE_USERS: false,
      MANAGE_PLANS: false,
    },
    DRIVER: {
      CREATE_TRANSPORT: false,
      VIEW_TRANSPORT: true,        // ✅ (own)
      ACCEPT_OFFER: false,
      MAKE_OFFER: true,            // ✅ (optional)
      ASSIGN_DRIVER: false,
      UPDATE_STATUS: true,         // ✅ (own)
      VIEW_WALLET: false,
      INITIATE_PAYOUT: false,
      MANAGE_VEHICLES: false,
      MANAGE_USERS: false,
      MANAGE_PLANS: false,
    },
    MARKETER: {
      CREATE_TRANSPORT: false,
      VIEW_TRANSPORT: false,
      ACCEPT_OFFER: false,
      MAKE_OFFER: false,
      ASSIGN_DRIVER: false,
      UPDATE_STATUS: false,
      VIEW_WALLET: false,
      INITIATE_PAYOUT: false,
      MANAGE_VEHICLES: false,
      MANAGE_USERS: false,
      MANAGE_PLANS: false,
    },
  } as const,
} as const;

// ============================================
// ACTION TYPE DEFINITIONS
// ============================================

export type SecurityAction = keyof typeof COMPACT_PERMISSION_MATRIX.ACTIONS;

export interface ActionContext {
  action: SecurityAction;
  resourceType: 'transport' | 'offer' | 'wallet' | 'vehicle' | 'user' | 'driver';
  resourceId?: string;
  transactionContext?: Partial<TransactionRiskContext>;
}

// ============================================
// STEP 1: PERMISSION CHECK (Binary, Hard)
// ============================================

export function checkPermission(
  roles: SystemRole[],
  action: SecurityAction
): PermissionCheckResult {
  // Check each role - if any role allows the action, grant access
  for (const role of roles) {
    const rolePermissions = COMPACT_PERMISSION_MATRIX.MATRIX[role as keyof typeof COMPACT_PERMISSION_MATRIX.MATRIX];
    
    if (rolePermissions && rolePermissions[action] === true) {
      return {
        allowed: true,
        code: 'ALLOWED',
      };
    }
  }

  // No role allows this action
  return {
    allowed: false,
    reason: `Keine der Rollen [${roles.join(', ')}] hat Berechtigung für ${action}`,
    code: 'PERMISSION_DENIED',
    requiredPermission: COMPACT_PERMISSION_MATRIX.ACTIONS[action] as Permission,
  };
}

// ============================================
// STEP 2: RISK CHECK (Dynamic, Context-Sensitive)
// ============================================

export async function performRiskCheck(
  securityContext: SecurityContext,
  actionContext: ActionContext
): Promise<{
  passed: boolean;
  score: number;
  level: RiskLevel;
  recommendation: string;
  factors: string[];
  combinedScore?: CombinedRiskScore;
}> {
  // Build transaction context
  const transactionContext: TransactionRiskContext = {
    transactionType: mapActionToTransactionType(actionContext.action),
    amount: actionContext.transactionContext?.amount || 0,
    currency: actionContext.transactionContext?.currency || 'EUR',
    isNewIban: actionContext.transactionContext?.isNewIban || false,
    isInternational: actionContext.transactionContext?.isInternational || false,
    isHazmat: actionContext.transactionContext?.isHazmat || false,
    isRecurringPartner: actionContext.transactionContext?.isRecurringPartner || false,
    hasEscrow: actionContext.transactionContext?.hasEscrow || false,
    hasInsurance: actionContext.transactionContext?.hasInsurance || false,
    tunnelCodes: actionContext.transactionContext?.tunnelCodes,
    adrExpired: actionContext.transactionContext?.adrExpired,
  };

  // Calculate combined risk score
  const combinedScore = await calculateCombinedRiskScore(
    securityContext.userId,
    securityContext.companyId || null,
    transactionContext
  );

  // Determine if action passes risk check
  const passed = combinedScore.level !== 'RED';
  
  let recommendation = '';
  switch (combinedScore.level) {
    case 'GREEN':
      recommendation = 'Aktion normal durchlassen';
      break;
    case 'YELLOW':
      recommendation = 'Aktion erlauben, aber mit extra Logging und ggf. Delay';
      break;
    case 'RED':
      recommendation = 'Aktion blockieren, manuelle Prüfung erforderlich';
      break;
  }

  return {
    passed,
    score: combinedScore.score,
    level: combinedScore.level,
    recommendation,
    factors: combinedScore.factors.map(f => `${f.name} (${f.impact > 0 ? '+' : ''}${f.impact})`),
    combinedScore,
  };
}

function mapActionToTransactionType(action: SecurityAction): TransactionRiskContext['transactionType'] {
  switch (action) {
    case 'INITIATE_PAYOUT':
      return 'PAYOUT';
    case 'ACCEPT_OFFER':
      return 'TRANSPORT_ACCEPT';
    case 'CREATE_TRANSPORT':
      return 'HIGH_VALUE_TRANSPORT';
    default:
      return 'TRANSPORT_ACCEPT';
  }
}

// ============================================
// STEP 3: HYBRID SECURITY CHECK
// ============================================

export async function performHybridSecurityCheck(
  securityContext: SecurityContext,
  actionContext: ActionContext
): Promise<HybridSecurityResult> {
  // STEP 1: Permission Check (hard, binary)
  const permissionResult = checkPermission(securityContext.roles, actionContext.action);
  
  if (!permissionResult.allowed) {
    // Log denied permission attempt
    await logSecurityEvent({
      userId: securityContext.userId,
      action: actionContext.action,
      allowed: false,
      reason: permissionResult.reason || 'Permission denied',
      riskScore: 0,
    });

    return {
      permissionCheck: permissionResult,
    };
  }

  // STEP 2: Risk Scoring (dynamic, context-sensitive)
  const riskCheck = await performRiskCheck(securityContext, actionContext);

  // Determine final result based on risk level
  let finalAllowed = true;
  let finalReason: string | undefined;
  let finalCode: PermissionCheckResult['code'] = 'ALLOWED';

  if (riskCheck.level === 'RED') {
    finalAllowed = false;
    finalReason = 'Aktion aufgrund von Sicherheitsbedenken blockiert';
    finalCode = 'RISK_TOO_HIGH';

    // Create support ticket for manual review
    await createManualReviewTicket(securityContext, actionContext, riskCheck);
  } else if (riskCheck.level === 'YELLOW') {
    // Allow but log
    finalReason = 'Aktion erlaubt mit erhöhter Überwachung';
    finalCode = 'ALLOWED';
  }

  // Log the security event
  const auditId = await logSecurityEvent({
    userId: securityContext.userId,
    action: actionContext.action,
    allowed: finalAllowed,
    reason: finalReason,
    riskScore: riskCheck.score,
    riskFactors: riskCheck.factors,
    resourceId: actionContext.resourceId,
    resourceType: actionContext.resourceType,
  });

  return {
    permissionCheck: {
      allowed: finalAllowed,
      reason: finalReason,
      code: finalCode,
      riskScore: riskCheck.score,
      riskLevel: riskCheck.level,
      riskFactors: riskCheck.factors,
    },
    riskCheck: {
      passed: riskCheck.passed,
      score: riskCheck.score,
      level: riskCheck.level,
      recommendation: riskCheck.recommendation,
      factors: riskCheck.factors,
    },
    auditId,
  };
}

// ============================================
// SECURITY EVENT LOGGING
// ============================================

async function logSecurityEvent(params: {
  userId: string;
  action: string;
  allowed: boolean;
  reason?: string;
  riskScore: number;
  riskFactors?: string[];
  resourceId?: string;
  resourceType?: string;
}): Promise<string> {
  const auditLog = await db.auditLog.create({
    data: {
      userId: params.userId,
      action: 'FRAUD_ALERT',
      entityType: params.resourceType || 'security_check',
      entityId: params.resourceId,
      dataBefore: JSON.stringify({
        action: params.action,
        allowed: params.allowed,
        reason: params.reason,
        riskScore: params.riskScore,
        riskFactors: params.riskFactors,
      }),
      dataAfter: null,
    },
  });

  return auditLog.id;
}

// ============================================
// MANUAL REVIEW TICKET CREATION
// ============================================

async function createManualReviewTicket(
  securityContext: SecurityContext,
  actionContext: ActionContext,
  riskCheck: { score: number; level: RiskLevel; factors: string[] }
): Promise<void> {
  // Check if there's already an open ticket for this user
  const existingTicket = await db.supportTicket.findFirst({
    where: {
      userId: securityContext.userId,
      category: 'FRAUD',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });

  if (existingTicket) return;

  // Create new ticket
  await db.supportTicket.create({
    data: {
      userId: securityContext.userId,
      subject: `Sicherheitsüberprüfung erforderlich: ${actionContext.action}`,
      description: `
Automatisch erstellt durch Security Layer.

Action: ${actionContext.action}
Risk Score: ${riskCheck.score}
Risk Level: ${riskCheck.level}
Factors: ${riskCheck.factors.join(', ')}

Bitte prüfen und ggf. Maßnahmen ergreifen.
      `.trim(),
      priority: 'HIGH',
      status: 'OPEN',
      category: 'FRAUD',
    },
  });
}

// ============================================
// MIDDLEWARE FACTORY
// ============================================

export function withHybridSecurity(
  action: SecurityAction,
  options: {
    resourceType: ActionContext['resourceType'];
    getResourceId?: (request: NextRequest) => string | Promise<string>;
    getTransactionContext?: (request: NextRequest) => Partial<TransactionRiskContext> | Promise<Partial<TransactionRiskContext>>;
  } = { resourceType: 'transport' }
) {
  return async (
    request: NextRequest,
    handler: (req: NextRequest, context: SecurityContext, securityResult: HybridSecurityResult) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    // Extract security context from request
    const securityContext = await extractSecurityContext(request);
    
    if (!securityContext) {
      return NextResponse.json({
        error: 'UnauthorizedError',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      }, { status: 401 });
    }

    // Build action context
    const actionContext: ActionContext = {
      action,
      resourceType: options.resourceType,
    };

    if (options.getResourceId) {
      actionContext.resourceId = await options.getResourceId(request);
    }

    if (options.getTransactionContext) {
      actionContext.transactionContext = await options.getTransactionContext(request);
    }

    // Perform hybrid security check
    const securityResult = await performHybridSecurityCheck(securityContext, actionContext);

    // Handle blocked requests
    if (!securityResult.permissionCheck.allowed) {
      return NextResponse.json({
        error: 'ForbiddenError',
        message: securityResult.permissionCheck.reason || 'Access denied',
        code: securityResult.permissionCheck.code,
        riskScore: securityResult.permissionCheck.riskScore,
        riskLevel: securityResult.permissionCheck.riskLevel,
      }, { status: 403 });
    }

    // Handle yellow flag (add warning header)
    const response = await handler(request, securityContext, securityResult);
    
    if (securityResult.riskCheck?.level === 'YELLOW') {
      response.headers.set('X-Security-Warning', 'elevated_risk');
      response.headers.set('X-Risk-Score', String(securityResult.riskCheck.score));
    }

    return response;
  };
}

// ============================================
// SECURITY CONTEXT EXTRACTION
// ============================================

async function extractSecurityContext(request: NextRequest): Promise<SecurityContext | null> {
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      companyUsers: { include: { company: true } },
      securityFlags: { where: { active: true } },
    },
  });

  if (!user) {
    return null;
  }

  const roles = user.roles.map(ur => ur.role.name as SystemRole);
  const companyUser = user.companyUsers[0];

  // Calculate quick risk score from flags
  const criticalFlags = user.securityFlags.filter(f => f.severity === 'CRITICAL').length;
  const highFlags = user.securityFlags.filter(f => f.severity === 'HIGH').length;
  const mediumFlags = user.securityFlags.filter(f => f.severity === 'MEDIUM').length;

  const quickRiskScore = Math.min(100, 
    (criticalFlags * 25) + (highFlags * 15) + (mediumFlags * 5)
  );

  return {
    userId: user.id,
    email: user.email,
    roles,
    companyId: companyUser?.companyId,
    companyRole: companyUser?.roleInCompany as 'owner' | 'admin' | 'member',
    isVerified: user.status === 'ACTIVE',
    riskScore: quickRiskScore,
    activeSecurityFlags: user.securityFlags.length,
  };
}

// ============================================
// EXPORTS
// ============================================

export type {
  SecurityContext,
  PermissionCheckResult,
  HybridSecurityResult,
  ActionContext,
  SecurityAction,
};

export {
  COMPACT_PERMISSION_MATRIX,
  checkPermission,
  performRiskCheck,
  performHybridSecurityCheck,
  withHybridSecurity,
};
