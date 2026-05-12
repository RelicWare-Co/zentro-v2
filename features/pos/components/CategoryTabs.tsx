import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Category } from "../types";

interface CategoryTabsProps {
	categories: Category[];
	activeCategoryId: string;
	onCategoryChange: (categoryId: string) => void;
}

export function CategoryTabs({
	categories,
	activeCategoryId,
	onCategoryChange,
}: CategoryTabsProps) {
	return (
		<ScrollArea className="w-full whitespace-nowrap">
			<div className="flex w-max gap-x-1.5 pb-2">
				{categories.map((category) => (
					<Button
						key={category.id}
						variant={activeCategoryId === category.id ? "default" : "outline"}
						onClick={() => onCategoryChange(category.id)}
						className={`rounded-lg px-4 h-8 text-sm font-medium transition-all ${
							activeCategoryId === category.id
								? "bg-[var(--color-voltage)] text-black hover:bg-[#c9e605] border-transparent shadow-sm"
								: "bg-transparent border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
							}`}
					>
						{category.name}
					</Button>
				))}
			</div>
			<ScrollBar orientation="horizontal" className="invisible" />
			<div
				aria-hidden="true"
				className="absolute right-0 top-0 bottom-0 z-10 w-12 pointer-events-none bg-gradient-to-l from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"
			/>
		</ScrollArea>
	);
}
