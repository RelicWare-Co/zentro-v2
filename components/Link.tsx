import type { ReactNode } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { cn } from "@/lib/utils";

export function Link({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/" ? urlPathname === href : urlPathname.startsWith(href);
  return (
    <a href={href} className={cn(isActive ? "is-active" : undefined, className)}>
      {children}
    </a>
  );
}
