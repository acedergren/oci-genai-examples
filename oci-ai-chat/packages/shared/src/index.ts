// @acedergren/portal-shared
// Shared business logic for portal frontend and API.

// Error types and helpers
export {
	PortalError,
	ValidationError,
	AuthError,
	NotFoundError,
	RateLimitError,
	OCIError,
	DatabaseError,
	isPortalError,
	toPortalError,
	errorResponse
} from './errors.js';

// Auth & RBAC
export { PERMISSIONS, getPermissionsForRole, hasPermission } from './auth/rbac.js';
export type { Permission } from './auth/rbac.js';

// Workflow types
export {
	NodeTypeSchema,
	WorkflowStatusSchema,
	WorkflowRunStatusSchema,
	WorkflowStepStatusSchema,
	ToolNodeDataSchema,
	ConditionNodeDataSchema,
	LoopNodeDataSchema,
	ApprovalNodeDataSchema,
	AIStepNodeDataSchema,
	InputFieldSchema,
	InputNodeDataSchema,
	OutputNodeDataSchema,
	ParallelNodeDataSchema,
	WorkflowNodeSchema,
	WorkflowEdgeSchema,
	WorkflowDefinitionSchema,
	WorkflowRunSchema,
	WorkflowStepSchema,
	InsertWorkflowDefinitionSchema,
	InsertWorkflowRunSchema,
	InsertWorkflowStepSchema
} from './workflows/types.js';

export type {
	NodeType,
	WorkflowStatus,
	WorkflowRunStatus,
	WorkflowStepStatus,
	ToolNodeData,
	ConditionNodeData,
	LoopNodeData,
	ApprovalNodeData,
	AIStepNodeData,
	InputField,
	InputNodeData,
	OutputNodeData,
	ParallelNodeData,
	WorkflowNode,
	WorkflowEdge,
	WorkflowDefinition,
	WorkflowRun,
	WorkflowStep,
	InsertWorkflowDefinition,
	InsertWorkflowRun,
	InsertWorkflowStep
} from './workflows/types.js';

// Tool types
export {
	isReadOnlyOperation,
	isDestructiveOperation,
	inferApprovalLevel,
	DESTRUCTIVE_TOOL_WARNINGS,
	getToolWarning,
	requiresApproval
} from './tools/types.js';

export type {
	ToolCategory,
	ApprovalLevel,
	ToolStatus,
	ToolCall,
	ToolDefinition,
	ToolEntry,
	PendingApproval,
	ApprovalDecision,
	ToolResult
} from './tools/types.js';

// API types (Phase 8)
export {
	ApiKeyPermissionSchema,
	ApiKeyStatusSchema,
	ApiKeyContextSchema,
	ApiKeyInfoSchema,
	CreateApiKeyResultSchema,
	CreateApiKeyInputSchema,
	ToolDefinitionResponseSchema,
	ToolListResponseSchema,
	ToolDetailResponseSchema,
	ToolExecutionResponseSchema,
	WebhookEventTypeSchema,
	WebhookStatusSchema,
	WebhookSubscriptionSchema,
	CreateWebhookInputSchema,
	WebhookDeliveryStatusSchema,
	WebhookDeliverySchema,
	BlockchainAuditEntrySchema,
	BlockchainAuditRecordSchema,
	SearchResultSchema,
	SearchQuerySchema,
	SearchResponseSchema,
	GraphNodeSchema,
	GraphEdgeSchema,
	GraphQueryResultSchema,
	apiKeyRowToInfo,
	apiKeyRowToContext,
	webhookRowToSubscription,
	webhookDeliveryRowToEntity,
	auditRowToRecord,
	searchRowToResult
} from './api/types.js';

export type {
	ApiKeyPermission,
	ApiKeyStatus,
	ApiKeyContext,
	ApiKeyInfo,
	CreateApiKeyResult,
	CreateApiKeyInput,
	ToolDefinitionResponse,
	ToolListResponse,
	ToolDetailResponse,
	ToolExecutionResponse,
	WebhookEventType,
	WebhookStatus,
	WebhookSubscription,
	CreateWebhookInput,
	WebhookDeliveryStatus,
	WebhookDelivery,
	BlockchainAuditEntry,
	BlockchainAuditRecord,
	SearchResult,
	SearchQuery,
	SearchResponse,
	GraphNode,
	GraphEdge,
	GraphQueryResult,
	ApiKeyRow,
	WebhookSubscriptionRow,
	WebhookDeliveryRow,
	BlockchainAuditRow,
	SearchResultRow
} from './api/types.js';
