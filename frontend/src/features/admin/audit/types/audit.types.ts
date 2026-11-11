export interface AuditEvent {
  id: number;
  requestId: string | null;
  actorUserId: number | null;
  actorUsername: string | null;
  targetUserId: number | null;
  module: string;
  action: string;
  result: string;
  reasonCode: string | null;
  entityType: string | null;
  entityId: string | null;
  detailsJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

