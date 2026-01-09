import React from 'react';
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const CategoryTabs = ({ categories, activeCategory, onSelectCategory }) => {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mask-fade-right">
            <Button
                variant={activeCategory === 'Semua' ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectCategory('Semua')}
                className={cn(
                    "rounded-full h-8 text-xs font-medium transition-all min-w-[3rem]",
                    activeCategory === 'Semua'
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "border-dashed text-muted-foreground"
                )}
            >
                Semua
            </Button>
            {categories.map((cat) => {
                const catName = typeof cat.name === 'object' && cat.name?.name ? cat.name.name : cat.name;
                const isActive = activeCategory === catName;

                return (
                    <Button
                        key={cat.id}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSelectCategory(catName)}
                        className={cn(
                            "rounded-full h-8 text-xs font-medium transition-all whitespace-nowrap",
                            isActive
                                ? "bg-indigo-600 hover:bg-indigo-700"
                                : "text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                        )}
                    >
                        {catName}
                    </Button>
                );
            })}
        </div>
    );
};

export default CategoryTabs;
