import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Home, Scissors, Stethoscope, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

const CalendarView = ({ bookings = [], onSelectBooking }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const getDayBookings = (day) => {
        return bookings.filter(b => {
            const start = parseISO(b.startDate);
            if (b.serviceType === 'hotel' && b.endDate) {
                const end = parseISO(b.endDate);
                return isWithinInterval(day, { start, end });
            } else {
                return isSameDay(start, day);
            }
        });
    };

    const getServiceIcon = (type) => {
        switch (type) {
            case 'grooming': return <Scissors className="h-3 w-3" />;
            case 'hotel': return <Home className="h-3 w-3" />;
            case 'medical': return <Stethoscope className="h-3 w-3" />;
            default: return <CalendarIcon className="h-3 w-3" />;
        }
    };

    const getEventColor = (type) => {
        switch (type) {
            case 'hotel': return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200';
            case 'grooming': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
            case 'medical': return 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900 capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: id })}
                    </h2>
                    <Badge variant="outline" className="bg-white text-[10px] font-bold uppercase tracking-wider">
                        {bookings.length} Aktivitas
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex border rounded-lg overflow-hidden bg-white shadow-sm">
                        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-none border-r">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 text-xs font-bold border-r">
                            Hari Ini
                        </Button>
                        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-none">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b bg-slate-50/30">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                    <div key={day} className="py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 overflow-auto divide-x divide-y divide-slate-100">
                {calendarDays.map((day) => {
                    const dayEvents = getDayBookings(day);
                    const isToday = isSameDay(day, new Date());
                    const isOtherMonth = !isSameMonth(day, currentMonth);

                    return (
                        <div
                            key={day.toISOString()}
                            className={cn(
                                "min-h-[120px] p-2 relative transition-colors group",
                                isOtherMonth ? "bg-slate-50/50" : "bg-white",
                                isToday && "bg-blue-50/30"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn(
                                    "text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full transition-colors",
                                    isToday ? "bg-blue-600 text-white shadow-sm" : 
                                    isOtherMonth ? "text-slate-400" : "text-slate-700",
                                    "group-hover:bg-slate-100 transition-none",
                                    isToday && "group-hover:bg-blue-700"
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="space-y-1 max-h-[100px] overflow-y-auto no-scrollbar">
                                {dayEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={() => onSelectBooking && onSelectBooking(event)}
                                        className={cn(
                                            "text-[10px] p-1.5 rounded-md border shadow-sm cursor-pointer transition-all flex flex-col gap-0.5",
                                            getEventColor(event.serviceType)
                                        )}
                                    >
                                        <div className="flex items-center gap-1 font-extrabold uppercase tracking-tight">
                                            {getServiceIcon(event.serviceType)}
                                            <span className="truncate">{event.serviceType === 'hotel' ? 'Hotel' : (event.serviceName || event.serviceType)}</span>
                                        </div>
                                        <div className="truncate font-medium opacity-90 pl-4 border-l border-current/20 ml-1.5">
                                            {event.petName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;
