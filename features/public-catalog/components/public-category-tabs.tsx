import { Button, ScrollArea } from "@mantine/core";
import { cn } from "@/lib/utils";

interface CategoryTab {
  id: string;
  name: string;
}

interface PublicCategoryTabsProps {
  activeCategoryId: string;
  categories: CategoryTab[];
  onCategoryChange: (categoryId: string) => void;
}

export function PublicCategoryTabs({
  categories,
  activeCategoryId,
  onCategoryChange,
}: PublicCategoryTabsProps) {
  const allCategories = [{ id: "all", name: "Todos" }, ...categories];

  return (
    <div className="relative w-full">
      <ScrollArea
        className="w-full"
        offsetScrollbars={false}
        scrollbarSize={0}
        type="never"
      >
        <div className="flex w-max gap-2 py-1">
          {allCategories.map((category) => (
            <Button
              className={cn(
                "shrink-0 rounded-full font-medium transition-colors",
                activeCategoryId === category.id
                  ? "border-[var(--color-voltage)]! bg-[var(--color-voltage)]/10! text-[var(--color-voltage)]!"
                  : "border-zinc-800! bg-transparent! text-zinc-400! hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              size="sm"
              variant="outline"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[var(--color-page-bg)] via-[var(--color-page-bg)]/80 to-transparent"
      />
    </div>
  );
}
