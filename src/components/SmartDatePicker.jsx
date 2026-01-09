import React from 'react';
import Datepicker from "react-tailwindcss-datepicker";

export function SmartDatePicker({
    date,
    onDateChange,
    className,
}) {
    // Convert { from, to } (app format) to { startDate, endDate } (lib format)
    const value = {
        startDate: date?.from ? new Date(date.from) : null,
        endDate: date?.to ? new Date(date.to) : (date?.from ? new Date(date.from) : null)
    };

    const handleValueChange = (newValue) => {
        // newValue is { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" } or dates depending on lib version
        // The lib usually returns strings or Date objects. Let's inspect or assume strings/dates.
        // Documentation says strict names.

        // This lib updates state internally, but we need to notify parent.
        // This lib updates state internally, but we need to notify parent.

        // Convert back to { from, to } for the app
        if (newValue && newValue.startDate) {
            // Helper to parse YYYY-MM-DD to Local Midnight
            const parseLocal = (val) => {
                if (!val) return null;
                // Always return a NEW Date instance to avoid reference aliasing
                if (val instanceof Date) return new Date(val);
                if (typeof val === 'string') {
                    // Check if it's a date string like "YYYY-MM-DD"
                    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [y, m, d] = val.split('-').map(Number);
                        return new Date(y, m - 1, d);
                    }
                    // Try standard parsing for other strings
                    return new Date(val);
                }
                return null;
            };

            // Ensure we pass Date objects back to the app as it expects them
            const fromDate = parseLocal(newValue.startDate);
            let toDateStr = newValue.endDate || newValue.startDate;
            const toDate = parseLocal(toDateStr);

            // Set start of day for 'from' date
            if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
            }

            // Set end of day for 'to' date to ensure full range inclusion
            if (toDate) {
                toDate.setHours(23, 59, 59, 999);
            }

            onDateChange({
                from: fromDate,
                to: toDate
            });
        } else {
            onDateChange({ from: undefined, to: undefined });
        }
    };

    return (
        <div className={`w-full md:w-[300px] relative z-20 ${className || ''}`}>
            <Datepicker
                usePortal={true}
                primaryColor={"indigo"}
                value={value}
                onChange={(v) => {
                    handleValueChange(v);
                }}
                showShortcuts={true}
                popoverDirection="down"
                isSecure={false}
                displayFormat={"DD/MM/YYYY"}
                inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                toggleClassName="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                containerClassName="relative z-[100]"
                configs={{
                    shortcuts: {
                        today: "Hari Ini",
                        yesterday: "Kemarin",
                        past: (period) => `${period} Hari Terakhir`,
                        currentMonth: "Bulan Ini",
                        pastMonth: "Bulan Lalu"
                    }
                }}
            />
        </div>
    );
}
