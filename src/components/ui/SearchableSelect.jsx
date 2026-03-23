import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"

const SearchableSelect = ({ 
    options = [], 
    value, 
    onValueChange, 
    placeholder = "Pilih item...", 
    searchPlaceholder = "Cari...",
    emptyMessage = "Tidak ada data.",
    className
}) => {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    const filteredOptions = options.filter((option) => {
        const labelStr = (option.label || "").toString().toLowerCase()
        const subLabelStr = (option.subLabel || "").toString().toLowerCase()
        const searchStr = search.toLowerCase()
        return labelStr.includes(searchStr) || subLabelStr.includes(searchStr)
    })

    const selectedOption = options.find((option) => option.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", className)}
                >
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className={cn("p-0 overflow-hidden flex flex-col", className)} 
                align="start" 
                style={{ width: 'var(--radix-popover-trigger-width)', maxHeight: '350px' }}
            >
                <div className="flex items-center border-b px-3 shrink-0 bg-white">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-slate-400" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 p-1 bg-white">
                    {filteredOptions.length === 0 && (
                        <div className="py-6 text-center text-sm text-slate-400">
                            {emptyMessage}
                        </div>
                    )}
                    {filteredOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={cn(
                                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 transition-colors",
                                value === option.value && "bg-slate-50 font-medium"
                            )}
                            onClick={() => {
                                onValueChange(option.value === value ? "" : option.value)
                                setOpen(false)
                                setSearch("")
                            }}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4 text-blue-600 shrink-0",
                                    value === option.value ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <div className="flex flex-col items-start overflow-hidden text-left">
                                <span className={cn("truncate w-full", value === option.value ? "text-blue-700" : "text-slate-700")}>
                                    {option.label}
                                </span>
                                {option.subLabel && (
                                    <span className="text-[10px] text-slate-400 truncate w-full">
                                        {option.subLabel}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export { SearchableSelect }
