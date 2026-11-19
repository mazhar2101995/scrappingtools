export type DiagnosticCheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_TESTED' | 'NOT_APPLICABLE';
export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type StoreReadinessState =
  | 'CONNECTED_READY'
  | 'CONNECTED_LIMITED'
  | 'ACTION_REQUIRED'
  | 'DISCONNECTED'
  | 'CHECKING'
  | 'UNKNOWN';

export type StoreCapabilityType =
  | 'PRODUCT_PULL'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'INVENTORY_SYNC'
  | 'PRICE_SYNC'
  | 'MEDIA_SYNC'
  | 'WEBHOOK_REVERSE_SYNC'
  | 'SCHEDULED_SYNC';

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: DiagnosticCheckStatus;
  severity: DiagnosticSeverity;
  timestamp: string;
  errorCode?: string | null;
  message: string;
  actionRequired?: string | null;
  capability: StoreCapabilityType | 'CORE_CONNECTIVITY';
  details?: Record<string, any>;
}

export interface StoreCapabilityStatus {
  supported: boolean;
  verified: boolean;
  status: 'READY' | 'LIMITED' | 'BLOCKED' | 'NOT_SUPPORTED';
  reason?: string;
  missingPrerequisites?: string[];
}

export interface StoreDiagnosticsReport {
  storeId: string;
  storeName: string;
  platformType: string;
  readinessState: StoreReadinessState;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    unverified: number;
  };
  capabilities: Record<StoreCapabilityType, StoreCapabilityStatus>;
  checks: DiagnosticCheck[];
  executedAt?: string;
  lastCheckedAt: string;
  lastSuccessfulCheckAt?: string | null;
}
