import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CategoryBarProps {
    categories: string[];
    activeCategory: string;
    onSelectCategory: (category: string) => void;
}

export function CategoryBar({ categories, activeCategory, onSelectCategory }: CategoryBarProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active category
    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeBtn = scrollContainerRef.current.querySelector(
                `[data-category="${activeCategory}"]`
            ) as HTMLElement;

            if (activeBtn) {
                const container = scrollContainerRef.current;
                const scrollLeft =
                    activeBtn.offsetLeft -
                    container.offsetWidth / 2 +
                    activeBtn.offsetWidth / 2;

                container.scrollTo({
                    left: scrollLeft,
                    behavior: "smooth",
                });
            }
        }
    }, [activeCategory]);

    return (
        <div className="sticky top-[69px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-sidebar-border shadow-sm">
            <div
                ref={scrollContainerRef}
                className="flex overflow-x-auto hide-scrollbar py-3 px-4 gap-3 snap-x"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {/* All Items Option */}
                <button
                    onClick={() => onSelectCategory("All")}
                    data-category="All"
                    className={cn(
                        "flex-none px-4 py-2 rounded-full text-sm font-bold transition-all snap-start",
                        activeCategory === "All"
                            ? "bg-primary text-primary-foreground shadow-md scale-105"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                >
                    All Items
                </button>

                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => onSelectCategory(category)}
                        data-category={category}
                        className={cn(
                            "flex-none px-4 py-2 rounded-full text-sm font-bold transition-all snap-start whitespace-nowrap",
                            activeCategory === category
                                ? "bg-primary text-primary-foreground shadow-md scale-105"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </div>
    );
}
