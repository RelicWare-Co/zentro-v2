import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Category } from "../types";

interface CategoryTabsProps {
  activeCategoryId: string;
  categories: Category[];
  onCategoryChange: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategoryId,
  onCategoryChange,
}: CategoryTabsProps) {
  const allCategories = [{ id: "all", name: "Todos" }, ...categories];
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex w-max gap-x-1.5 pb-2">
        {allCategories.map((category) => (
          <Button
            className={`h-8 rounded-lg px-4 font-medium text-sm transition-all ${
              activeCategoryId === category.id
                ? "border-transparent bg-[var(--color-voltage)] text-black shadow-sm hover:bg-[#c9e605]"
                : "border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            variant={activeCategoryId === category.id ? "default" : "outline"}
          >
            {category.name}
          </Button>
        ))}
      </div>
      <ScrollBar className="invisible" orientation="horizontal" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"
      />
    </ScrollArea>
  );
}
