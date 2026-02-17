import React from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
    currentPage,
    totalItems = 0,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    pageSizeOptions = [10, 20, 40, 50],
    isServerSide = false,
    hasNextPage = false
}) => {
    const totalPages = isServerSide ? null : Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = isServerSide ? startItem + itemsPerPage - 1 : Math.min(currentPage * itemsPerPage, totalItems);

    if (!isServerSide && totalItems === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(val) => {
                        onItemsPerPageChange?.(Number(val));
                        onPageChange?.(1); // Reset to page 1 when changing page size
                    }}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeOptions.map(size => (
                            <SelectItem key={size} value={size.toString()}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span>entries</span>
                <span className="ml-2 hidden sm:inline">
                    {isServerSide ?
                        `(Page ${currentPage})` :
                        `(Showing ${startItem} to ${endItem} of ${totalItems})`
                    }
                </span>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                    {isServerSide ? `Page ${currentPage}` : `Page ${currentPage} of ${totalPages}`}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={isServerSide ? !hasNextPage : currentPage >= totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default Pagination;
