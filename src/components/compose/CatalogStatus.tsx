import { StatusDot } from "@/components/common/StatusDot";
import { Tag } from "@/components/common/Tag";
import type { ManagementStatus } from "@/lib/types";

interface CatalogStatusProps {
  managementStatus: ManagementStatus;
  managementAuthError: string | null;
}

/**
 * Where the queue and exchange names come from. A wrong Management API password is shown as
 * a failure rather than quietly downgraded to manual entry, so the user can fix it.
 */
export function CatalogStatus({ managementStatus, managementAuthError }: CatalogStatusProps) {
  if (managementAuthError) {
    return (
      <Tag tone="danger" size="xs" title={managementAuthError}>
        Auth failed
      </Tag>
    );
  }

  const live = managementStatus === "live";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-11 text-muted-foreground">
      <StatusDot size={6} tone={live ? "success" : "warning"} />
      {live ? "Live catalog" : "Manual entry"}
    </span>
  );
}
