/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: "text-foreground",
                success:
                    "border-transparent bg-green-500 text-white hover:bg-green-600",
                warning:
                    "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
                "success-subtle":
                    "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                "warning-subtle":
                    "border-transparent bg-orange-50 text-orange-700 hover:bg-orange-100",
                "error-subtle":
                    "border-transparent bg-red-50 text-red-700 hover:bg-red-100",
                "info-subtle":
                    "border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100",
                "indigo-subtle":
                    "border-transparent bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                "neutral-subtle":
                    "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

function Badge({ className, variant, ...props }) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
