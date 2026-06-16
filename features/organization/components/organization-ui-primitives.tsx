import { Badge } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  formatJoinLinkStatusLabel,
  type OrganizationJoinLinkStatus,
} from "@/lib/organization-shared";

/** Dark carbon card container (replaces the shadcn Card composition). */
export function OrgCard({
  title,
  description,
  icon: Icon,
  iconClassName = "text-[var(--color-voltage)]",
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-6 text-[var(--color-photon)] ${className}`}
    >
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-semibold">
          {Icon ? <Icon className={`size-4 ${iconClassName}`} /> : null}
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
      {children ? <div className="mt-6 space-y-4">{children}</div> : null}
    </div>
  );
}

export function Detail(props: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">
        {props.label}
      </p>
      <p
        className={
          props.mono
            ? "truncate font-mono text-sm text-zinc-400"
            : "truncate font-medium text-sm text-white"
        }
      >
        {props.value}
      </p>
    </div>
  );
}

export function JoinLinkStatusBadge(props: {
  status: OrganizationJoinLinkStatus;
}) {
  let className: string;
  if (props.status === "active") {
    className = "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  } else if (props.status === "used") {
    className = "border-sky-500/30 bg-sky-500/10 text-sky-200";
  } else if (props.status === "revoked") {
    className = "border-red-500/30 bg-red-500/10 text-red-200";
  } else {
    className = "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return (
    <Badge className={className} tt="none" variant="outline">
      {formatJoinLinkStatusLabel(props.status)}
    </Badge>
  );
}
