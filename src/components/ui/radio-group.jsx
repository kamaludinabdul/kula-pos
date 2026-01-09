import * as React from "react"
import { Circle } from "lucide-react"
import { cn } from "../../lib/utils"

const RadioGroupContext = React.createContext(null);

const RadioGroup = React.forwardRef(({ className, value, onValueChange, children, ...props }, ref) => {
    return (
        <RadioGroupContext.Provider value={{ value, onValueChange }}>
            <div className={cn("grid gap-2", className)} role="radiogroup" ref={ref} {...props}>
                {children}
            </div>
        </RadioGroupContext.Provider>
    )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef(({ className, value: itemValue, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const checked = context?.value === itemValue;

    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            data-state={checked ? "checked" : "unchecked"}
            value={itemValue}
            className={cn(
                "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            onClick={() => context?.onValueChange(itemValue)}
            ref={ref}
            {...props}
        >
            <span className="flex items-center justify-center">
                {checked && <Circle className="h-2.5 w-2.5 fill-current text-current" />}
            </span>
        </button>
    )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
