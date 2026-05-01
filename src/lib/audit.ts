import { db } from "@/server/db/client";
import { auditLogs, type AuditAction, type AuditTargetType } from "@/server/db/schema/audit";
import { logger } from "@/lib/log";

const log = logger("audit");

export interface RecordAuditParams {
    actorId?: string | null;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string | null;
    details?: Record<string, unknown> | null;
    headers?: Headers | null;
}

/**
 * Best-effort audit log writer. Extracts IP and user-agent from headers when
 * provided. Never throws — failures are logged as warnings.
 */
export const recordAudit = (params: RecordAuditParams): void => {
    const { actorId, action, targetType, targetId, details, headers } = params;

    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (headers) {
        const forwarded = headers.get("x-forwarded-for");
        if (forwarded) {
            ipAddress = forwarded.split(",")[0]?.trim() ?? null;
        }
        userAgent = headers.get("user-agent");
    }

    void db
        .insert(auditLogs)
        .values({
            actorId: actorId ?? null,
            action,
            targetType,
            targetId: targetId ?? null,
            details: details ?? null,
            ipAddress,
            userAgent,
        })
        .catch((err: unknown) => {
            log.warn("failed to write audit log", {
                action,
                targetType,
                targetId: targetId ?? undefined,
                error: err instanceof Error ? err.message : String(err),
            });
        });
};
