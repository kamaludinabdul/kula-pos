import React from 'react';
import { Search, ScanBarcode } from 'lucide-react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import CategoryTabs from './CategoryTabs';

const ProductFilter = ({
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    categories,
    searchInputRef,
    onOpenScanner,
    onEnter
}) => {
    return (
        <div className="space-y-3 p-4 bg-slate-50/50">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Cari produk... (F2)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white shadow-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                // Trigger search/add action
                                if (onEnter) onEnter(searchQuery);
                            }
                        }}
                    />
                </div>
                <Button variant="outline" size="icon" onClick={onOpenScanner} title="Scan Barcode (Enter)">
                    <ScanBarcode className="h-4 w-4" />
                </Button>
            </div>

            <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
            />
        </div>
    );
};

export default ProductFilter;
