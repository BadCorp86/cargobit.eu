/**
 * CargoBit Admin API - OpenAPI Specification
 * 
 * Generates OpenAPI 3.0 documentation for the Admin API.
 * Includes Bearer Authentication with JWT tokens.
 */

// ============================================
// TYPES
// ============================================

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  security: Array<{
    [key: string]: string[];
  }>;
  components: {
    securitySchemes: {
      [key: string]: {
        type: string;
        scheme: string;
        bearerFormat: string;
        description: string;
      };
    };
    schemas: {
      [key: string]: object;
    };
    responses: {
      [key: string]: object;
    };
  };
  paths: {
    [path: string]: {
      [method: string]: {
        tags: string[];
        summary: string;
        description?: string;
        security?: Array<{ [key: string]: string[] }>;
        parameters?: object[];
        requestBody?: object;
        responses: {
          [code: string]: {
            description: string;
            content?: {
              [contentType: string]: {
                schema: object;
              };
            };
          };
        };
      };
    };
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

// ============================================
// ADMIN API SCHEMAS
// ============================================

const schemas = {
  // Admin Authentication
  AdminLoginStep1Request: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@cargobit.eu' },
      password: { type: 'string', format: 'password', example: '••••••••' },
    },
  },
  AdminLoginStep1Response: {
    type: 'object',
    properties: {
      requires2fa: { type: 'boolean', example: true },
      email: { type: 'string', example: 'admin@cargobit.eu' },
    },
  },
  AdminLoginStep2Request: {
    type: 'object',
    required: ['email', 'code'],
    properties: {
      email: { type: 'string', format: 'email' },
      code: { type: 'string', example: '123456', minLength: 6, maxLength: 6 },
    },
  },
  AdminLoginTokenResponse: {
    type: 'object',
    properties: {
      accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
      tokenType: { type: 'string', example: 'bearer' },
      expiresIn: { type: 'integer', example: 28800 },
      admin: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clx123abc' },
          email: { type: 'string', example: 'admin@cargobit.eu' },
          role: { type: 'string', enum: ['ADMIN', 'FINANCE', 'SUPPORT'], example: 'ADMIN' },
        },
      },
    },
  },
  AdminMeResponse: {
    type: 'object',
    properties: {
      admin: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'FINANCE', 'SUPPORT'] },
          is2faEnabled: { type: 'boolean' },
        },
      },
    },
  },

  // Admin Roles
  AdminRole: {
    type: 'string',
    enum: ['ADMIN', 'FINANCE', 'SUPPORT'],
    description: 'Admin user role with specific permissions',
  },

  // Payment Schemas
  PaymentListResponse: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/Payment' },
      },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
      hasMore: { type: 'boolean' },
    },
  },
  Payment: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      paymentIntentId: { type: 'string' },
      chargeId: { type: 'string' },
      jobId: { type: 'string' },
      currency: { type: 'string', example: 'EUR' },
      status: {
        type: 'string',
        enum: ['SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED', 'CANCELLED'],
      },
      amountCents: { type: 'integer' },
      amountEur: { type: 'number' },
      platformFeeCents: { type: 'integer' },
      refundedCents: { type: 'integer' },
      refundableCents: { type: 'integer' },
      shipper: { $ref: '#/components/schemas/PaymentUser' },
      transporter: { $ref: '#/components/schemas/PaymentUser' },
      refunds: {
        type: 'array',
        items: { $ref: '#/components/schemas/Refund' },
      },
      walletTransactions: {
        type: 'array',
        items: { $ref: '#/components/schemas/WalletTransaction' },
      },
      auditTrail: {
        type: 'array',
        items: { $ref: '#/components/schemas/AuditEvent' },
      },
      createdAt: { type: 'string', format: 'date-time' },
      paidAt: { type: 'string', format: 'date-time' },
    },
  },
  PaymentUser: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
    },
  },
  Refund: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      refundId: { type: 'string' },
      amountCents: { type: 'integer' },
      amountEur: { type: 'number' },
      reason: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'SUCCEEDED', 'FAILED'] },
      createdAt: { type: 'string', format: 'date-time' },
      processedAt: { type: 'string', format: 'date-time' },
    },
  },
  WalletTransaction: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      walletId: { type: 'string' },
      walletOwnerType: { type: 'string', enum: ['shipper', 'transporter', 'company', 'platform'] },
      type: { type: 'string', enum: ['DEPOSIT', 'PAYOUT', 'FEE', 'COMMISSION', 'PAYMENT_IN', 'PAYMENT_OUT', 'REFUND'] },
      amount: { type: 'number' },
      currency: { type: 'string' },
      description: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  AuditEvent: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      eventType: { type: 'string' },
      oldStatus: { type: 'string' },
      newStatus: { type: 'string' },
      admin: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
        },
      },
      metadata: { type: 'object' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Refund Request
  RefundRequest: {
    type: 'object',
    required: ['jobId', 'type', 'reason'],
    properties: {
      jobId: { type: 'string', example: 'job_abc123' },
      type: {
        type: 'string',
        enum: ['full', 'partial', 'platform_fee_only'],
        description: 'Type of refund to process',
      },
      amountEur: {
        type: 'number',
        description: 'Required for partial refunds',
        example: 50.00,
      },
      reason: {
        type: 'string',
        example: 'Service not rendered',
        minLength: 10,
      },
    },
  },
  RefundResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'refund_initiated' },
      refundId: { type: 'string' },
      stripeRefundId: { type: 'string' },
      amountCents: { type: 'integer' },
      amountEur: { type: 'number' },
      currency: { type: 'string' },
      refundStatus: { type: 'string' },
      processedBy: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
        },
      },
    },
  },

  // Dispute Schemas
  DisputeListResponse: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/Dispute' },
      },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
      hasMore: { type: 'boolean' },
    },
  },
  Dispute: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      jobId: { type: 'string' },
      createdById: { type: 'string' },
      createdBy: { type: 'string' },
      reason: { type: 'string', enum: ['DAMAGE', 'DELAY', 'WRONG_DELIVERY', 'PRICE_DISPUTE', 'OTHER'] },
      subject: { type: 'string' },
      description: { type: 'string' },
      disputedAmountCents: { type: 'integer' },
      disputedAmountEur: { type: 'number' },
      status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
      assignedTo: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      resolvedAt: { type: 'string', format: 'date-time' },
    },
  },
  DisputeDetail: {
    allOf: [
      { $ref: '#/components/schemas/Dispute' },
      {
        type: 'object',
        properties: {
          shipper: { $ref: '#/components/schemas/PaymentUser' },
          transporter: { $ref: '#/components/schemas/PaymentUser' },
          messages: {
            type: 'array',
            items: { $ref: '#/components/schemas/DisputeMessage' },
          },
          resolution: { type: 'string', enum: ['refund_full', 'refund_partial', 'reject', 'other'] },
          resolutionNote: { type: 'string' },
          refundAmountCents: { type: 'integer' },
        },
      },
    ],
  },
  DisputeMessage: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      senderId: { type: 'string' },
      senderEmail: { type: 'string' },
      senderRole: { type: 'string', enum: ['shipper', 'transporter', 'admin'] },
      message: { type: 'string' },
      attachments: {
        type: 'array',
        items: { type: 'string' },
      },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  ResolveDisputeRequest: {
    type: 'object',
    required: ['resolution'],
    properties: {
      resolution: {
        type: 'string',
        enum: ['refund_full', 'refund_partial', 'reject', 'other'],
      },
      refundAmountCents: {
        type: 'integer',
        description: 'Required for refund_partial',
      },
      note: { type: 'string' },
    },
  },

  // Error Response
  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Unauthorized - No token provided' },
    },
  },

  // Unauthorized Response
  UnauthorizedResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Unauthorized - Invalid token' },
    },
  },

  // Forbidden Response
  ForbiddenResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Forbidden - Insufficient role' },
    },
  },
};

// ============================================
// COMMON RESPONSES
// ============================================

const commonResponses = {
  Unauthorized: {
    description: 'Unauthorized - Missing or invalid token',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/UnauthorizedResponse' },
      },
    },
  },
  Forbidden: {
    description: 'Forbidden - Insufficient role or permissions',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ForbiddenResponse' },
      },
    },
  },
  BadRequest: {
    description: 'Bad Request - Invalid input',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  NotFound: {
    description: 'Not Found',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  InternalError: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
};

// ============================================
// PATHS
// ============================================

const paths: OpenAPISpec['paths'] = {
  // ============================================
  // AUTH ENDPOINTS (No auth required)
  // ============================================
  '/api/admin/auth/login-step1': {
    post: {
      tags: ['Auth'],
      summary: 'Admin Login Step 1 - Verify credentials',
      description: 'Verifies email and password. Returns whether 2FA is required for the account.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AdminLoginStep1Request' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Credentials verified',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminLoginStep1Response' },
            },
          },
        },
        '401': {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
  },
  '/api/admin/auth/login-step2': {
    post: {
      tags: ['Auth'],
      summary: 'Admin Login Step 2 - Verify 2FA and get token',
      description: 'Verifies 2FA code (if enabled) and issues JWT access token.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AdminLoginStep2Request' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminLoginTokenResponse' },
            },
          },
        },
        '401': {
          description: 'Invalid 2FA code',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
  },
  '/api/admin/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current admin user',
      description: 'Returns the currently authenticated admin user.',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Current admin user',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminMeResponse' },
            },
          },
        },
        '401': commonResponses.Unauthorized,
      },
    },
  },
  '/api/admin/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Admin logout',
      description: 'Invalidates the current session.',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Logged out successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Logged out successfully' },
                },
              },
            },
          },
        },
        '401': commonResponses.Unauthorized,
      },
    },
  },

  // ============================================
  // PAYMENTS ENDPOINTS (ADMIN, FINANCE)
  // ============================================
  '/api/admin/payments': {
    get: {
      tags: ['Payments'],
      summary: 'List all payments',
      description: 'Returns a paginated list of payments. Requires ADMIN or FINANCE role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by payment intent or email' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
      ],
      responses: {
        '200': {
          description: 'List of payments',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentListResponse' },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
      },
    },
  },
  '/api/admin/payments/{id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get payment details',
      description: 'Returns detailed payment information including refunds, wallet transactions, and audit trail. Requires ADMIN or FINANCE role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Payment ID' },
      ],
      responses: {
        '200': {
          description: 'Payment details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Payment' },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
  },

  // ============================================
  // REFUND ENDPOINTS (ADMIN, FINANCE)
  // ============================================
  '/api/admin/refund': {
    get: {
      tags: ['Refunds'],
      summary: 'Calculate refund amounts',
      description: 'Returns refund calculation for a job. Requires ADMIN or FINANCE role with payments:read permission.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'jobId', in: 'query', required: true, schema: { type: 'string' }, description: 'Job ID' },
      ],
      responses: {
        '200': {
          description: 'Refund calculation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                  paymentStatus: { type: 'string' },
                  totalPaidEur: { type: 'number' },
                  platformFeeEur: { type: 'number' },
                  transporterAmountEur: { type: 'number' },
                  alreadyRefundedEur: { type: 'number' },
                  maxRefundableEur: { type: 'number' },
                },
              },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
    post: {
      tags: ['Refunds'],
      summary: 'Process a refund',
      description: 'Initiates a refund for a job. Requires ADMIN or FINANCE role with refunds:create permission.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RefundRequest' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Refund initiated',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefundResponse' },
            },
          },
        },
        '400': commonResponses.BadRequest,
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
  },

  // ============================================
  // DISPUTES ENDPOINTS (ADMIN, SUPPORT)
  // ============================================
  '/api/admin/disputes': {
    get: {
      tags: ['Disputes'],
      summary: 'List all disputes',
      description: 'Returns a paginated list of disputes. Requires ADMIN or SUPPORT role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
        { name: 'reason', in: 'query', schema: { type: 'string' }, description: 'Filter by reason' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
      ],
      responses: {
        '200': {
          description: 'List of disputes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DisputeListResponse' },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
      },
    },
  },
  '/api/admin/disputes/{disputeId}': {
    get: {
      tags: ['Disputes'],
      summary: 'Get dispute details',
      description: 'Returns detailed dispute information including messages. Requires ADMIN or SUPPORT role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'disputeId', in: 'path', required: true, schema: { type: 'string' }, description: 'Dispute ID' },
      ],
      responses: {
        '200': {
          description: 'Dispute details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DisputeDetail' },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
  },
  '/api/admin/disputes/{disputeId}/resolve': {
    post: {
      tags: ['Disputes'],
      summary: 'Resolve a dispute',
      description: 'Resolves a dispute with optional refund. Requires ADMIN or SUPPORT role with disputes:write permission.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'disputeId', in: 'path', required: true, schema: { type: 'string' }, description: 'Dispute ID' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ResolveDisputeRequest' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Dispute resolved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string', example: 'RESOLVED' },
                  resolution: { type: 'string' },
                  refundAmountCents: { type: 'integer' },
                },
              },
            },
          },
        },
        '400': commonResponses.BadRequest,
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
  },

  // ============================================
  // USERS ENDPOINTS (ADMIN, SUPPORT)
  // ============================================
  '/api/admin/users': {
    get: {
      tags: ['Users'],
      summary: 'List users',
      description: 'Returns a paginated list of users. Requires ADMIN or SUPPORT role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name or email' },
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
        { name: 'role', in: 'query', schema: { type: 'string' }, description: 'Filter by role' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
      ],
      responses: {
        '200': {
          description: 'List of users',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { type: 'object' } },
                  total: { type: 'integer' },
                },
              },
            },
          },
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
      },
    },
  },
  '/api/admin/users/{userId}': {
    get: {
      tags: ['Users'],
      summary: 'Get user details',
      description: 'Returns detailed user information. Requires ADMIN or SUPPORT role.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' },
      ],
      responses: {
        '200': {
          description: 'User details',
        },
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
    patch: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Updates user status or other fields. Requires ADMIN role or SUPPORT with appropriate permissions.',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ACTIVE', 'BLOCKED', 'SUSPENDED'] },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'User updated',
        },
        '400': commonResponses.BadRequest,
        '401': commonResponses.Unauthorized,
        '403': commonResponses.Forbidden,
        '404': commonResponses.NotFound,
      },
    },
  },

  // ============================================
  // STATS ENDPOINTS
  // ============================================
  '/api/admin/stats': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get admin dashboard statistics',
      description: 'Returns key metrics for the admin dashboard.',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Dashboard statistics',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  totalPayments: { type: 'integer' },
                  totalRevenueEur: { type: 'number' },
                  pendingDisputes: { type: 'integer' },
                  activeUsers: { type: 'integer' },
                  activeJobs: { type: 'integer' },
                },
              },
            },
          },
        },
        '401': commonResponses.Unauthorized,
      },
    },
  },
};

// ============================================
// TAGS
// ============================================

const tags: OpenAPISpec['tags'] = [
  {
    name: 'Auth',
    description: 'Admin authentication endpoints (login with 2FA, logout, token verification)',
  },
  {
    name: 'Payments',
    description: 'Payment management (requires ADMIN or FINANCE role)',
  },
  {
    name: 'Refunds',
    description: 'Refund processing (requires ADMIN or FINANCE role with refunds:create permission)',
  },
  {
    name: 'Disputes',
    description: 'Dispute resolution (requires ADMIN or SUPPORT role)',
  },
  {
    name: 'Users',
    description: 'User management (requires ADMIN or SUPPORT role)',
  },
  {
    name: 'Dashboard',
    description: 'Dashboard statistics and overview',
  },
];

// ============================================
// MAIN SPEC
// ============================================

export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'CargoBit Admin API',
      version: '2.0.0',
      description: `
# CargoBit Admin API

REST API for the CargoBit Admin Panel with Role-Based Access Control (RBAC).

## Authentication

All endpoints (except login) require a Bearer token obtained through the 2-step login process:

1. **POST /api/admin/auth/login-step1** - Submit email + password
2. **POST /api/admin/auth/login-step2** - Submit 2FA code (if enabled) → receive access token

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full access: System, Users, Finance, Disputes, Payments, Refunds |
| **FINANCE** | Payments, Refunds, Payouts, Disputes (read-only), Jobs (read-only) |
| **SUPPORT** | Disputes, Jobs, Users (block/unblock), No direct payouts/refunds |

## Security

- All requests must include \`Authorization: Bearer <token>\` header
- Tokens expire after 8 hours
- Failed login attempts trigger account lockout after 5 failures
- 2FA is recommended for all admin accounts
      `,
      contact: {
        name: 'CargoBit API Support',
        email: 'api@cargobit.eu',
      },
    },
    servers: [
      {
        url: 'https://api.cargobit.eu',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/admin/auth/login-step2. Token contains { sub: adminId, role: "ADMIN" | "FINANCE" | "SUPPORT" }',
        },
      },
      schemas,
      responses: commonResponses,
    },
    paths,
    tags,
  };
}

// Export spec as JSON string
export function getOpenAPIJson(): string {
  return JSON.stringify(generateOpenAPISpec(), null, 2);
}
