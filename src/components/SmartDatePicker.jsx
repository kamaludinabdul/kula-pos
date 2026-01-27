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

    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

            // Only notify if there's a real change to avoid render loops
            const isDifferent =
                (fromDate?.getTime() !== date?.from?.getTime()) ||
                (toDate?.getTime() !== date?.to?.getTime());

            if (isDifferent) {
                onDateChange({
                    from: fromDate,
                    to: toDate
                });
            }
        } else if (date?.from !== undefined || date?.to !== undefined) {
            onDateChange({ from: undefined, to: undefined });
        }
    };

    return (
        <div className={`w-full lg:w-[300px] relative z-20 ${className || ''}`}>
            <Datepicker
                usePortal={false}
                primaryColor={"indigo"}
                value={value}
                onChange={(v) => {
                    handleValueChange(v);
                }}
                showShortcuts={true}
                popoverDirection="down"
                isSecure={false}
                displayFormat={isMobile ? "DD/MM/YY" : "DD/MM/YYYY"}
                inputClassName="w-full h-10 px-4 py-2 text-sm font-bold bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer placeholder:text-slate-400"
                toggleClassName="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                containerClassName="relative w-full z-[100]"
                configs={{
                    shortcuts: {
                        today: "Hari Ini",
                        yesterday: "Kemarin",
                        past: (period) => `${period} Hari`,
                        currentMonth: "Bulan Ini",
                        pastMonth: "Bulan Lalu"
                    }
                }}
            />
            {/* Custom style to force full width, fix overlap, and center triangle on mobile popover */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 768px) {
                    /* Center the popover container */
                    .relative.w-full.z-\\[100\\] > div:last-child {
                        width: calc(100vw - 32px) !important;
                        min-width: 310px !important;
                        left: 50% !important;
                        transform: translateX(-50%) !important;
                        right: auto !important;
                    }
                    /* Center the triangle arrow */
                    .relative.w-full.z-\\[100\\] > div:last-child > div:first-child {
                        left: 50% !important;
                        transform: translateX(-50%) rotate(45deg) !important;
                    }
                }
            `}} />
        </div>
    );
}
