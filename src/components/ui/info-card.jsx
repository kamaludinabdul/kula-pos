import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn } from '../../lib/utils';
import { cva } from 'class-variance-authority';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const iconVariants = cva(
    "p-2 rounded-xl flex items-center justify-center transition-colors",
    {
        variants: {
            variant: {
                default: "bg-slate-50 text-slate-600",
                primary: "bg-indigo-50 text-indigo-600",
                success: "bg-emerald-50 text-emerald-600",
                warning: "bg-orange-50 text-orange-600",
                danger: "bg-red-50 text-red-600",
                info: "bg-blue-50 text-blue-600",
                purple: "bg-purple-50 text-purple-600",
                pink: "bg-pink-50 text-pink-600"
            }
        },
        defaultVariants: {
            variant: "default"
        }
    }
);

/**
 * InfoCard Component
 * Standardized statistic card with white background and colored icon.
 * 
 * @param {string} title - The title of the card (e.g. "Total Sales")
 * @param {string|number} value - The main value to display
 * @param {React.ElementType} icon - The icon component to render
 * @param {string} variant - The color variant for the icon (default, primary, success, warning, danger, info, purple, pink)
 * @param {string} className - Additional classes for the card
 * @param {string|React.ReactNode} description - Optional description or secondary info
 * @param {number} trend - Optional trend percentage to show up/down arrow
 */
export const InfoCard = ({
    title,
    value,
    icon: Icon,
    variant = 'default',
    className,
    description,
    trend
}) => {
    return (
        <Card className={cn("rounded-2xl border-none shadow-sm bg-white overflow-hidden", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate pr-2">
                    {title}
                </CardTitle>
                {Icon && (
                    <div className={iconVariants({ variant })}>
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-extrabold text-slate-900 truncate">
                        {value}
                    </div>
                    {/* Optional Trend Indicator */}
                    {trend !== undefined && (
                        <div className={cn(
                            "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            trend > 0 ? "bg-green-50 text-green-600" : trend < 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
                        )}>
                            {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : trend < 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <Minus className="h-3 w-3 mr-0.5" />}
                            {Math.abs(trend)}%
                        </div>
                    )}
                </div>
                {description && (
                    <div className="mt-1 text-xs text-muted-foreground font-medium">
                        {description}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
