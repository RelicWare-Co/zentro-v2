import { Badge } from "@/components/ui/badge";
import {
  formatJoinLinkStatusLabel,
  type OrganizationJoinLinkStatus,
} from "@/lib/organization-shared";

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
    <Badge className={className} variant="outline">
      {formatJoinLinkStatusLabel(props.status)}
    </Badge>
  );
}
