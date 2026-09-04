import type { ProfileEnvironment } from "@/lib/types";
import { ENVIRONMENT_LABELS } from "@/lib/profileSafety";
import { Tag, type TagTone } from "@/components/common/Tag";

const TONES: Record<ProfileEnvironment, TagTone> = {
  local: "success",
  shared: "warning",
  production: "danger",
};

export function EnvironmentPill({
  environment,
  size,
}: {
  environment: ProfileEnvironment;
  size?: "sm" | "md";
}) {
  return (
    <Tag tone={TONES[environment]} size={size} data-testid="environment-badge">
      {ENVIRONMENT_LABELS[environment].toUpperCase()}
    </Tag>
  );
}
