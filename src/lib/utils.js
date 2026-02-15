import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import { differenceInYears, differenceInMonths } from 'date-fns';
export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

export function exportToCSV(data, filename) {
    if (!data || !data.length) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            // Handle strings with commas or quotes
            if (typeof value === 'string') {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        document.body.removeChild(link);
    }
}

// Helper to get start and end dates based on range key
export const getDateRange = (rangeKey, customStart, customEnd) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startDate, endDate;

    switch (rangeKey) {
        case 'today':
            startDate = startOfDay;
            endDate = new Date(now);
            break;
        case 'yesterday':
            startDate = new Date(startOfDay);
            startDate.setDate(startDate.getDate() - 1);
            endDate = new Date(startOfDay);
            endDate.setMilliseconds(-1);
            break;
        case 'last7days':
            startDate = new Date(startOfDay);
            startDate.setDate(startDate.getDate() - 6); // 7 days ensuring today is included? Or today-7? Usually 7 days inclusive: Today + 6 past days
            endDate = new Date(now);
            break;
        case 'week':
        case 'thisWeek': {
            // Monday to Sunday logic
            startDate = new Date(startOfDay);
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            startDate.setDate(diff);

            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        case 'last_week':
        case 'lastWeek': {
            // Previous Monday to Previous Sunday
            startDate = new Date(startOfDay);
            const currentDay = startDate.getDay();
            const currentDiff = startDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
            startDate.setDate(currentDiff - 7); // Last week's Monday

            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        case 'month':
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last_month':
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'custom':
            if (customStart) {
                startDate = new Date(customStart);
                endDate = customEnd ? new Date(customEnd) : new Date(customStart); // Default to start if no end
                endDate.setHours(23, 59, 59, 999);
            }
            break;
        case 'all':
            return { startDate: null, endDate: null };
        default:
            return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
};

export const getDateRangeLabel = (dateRange, customStart, customEnd) => {
    const { startDate, endDate } = getDateRange(dateRange, customStart, customEnd);
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    if (dateRange === 'all') return 'Semua Waktu';
    if (!startDate) return '';

    if (dateRange === 'today' || dateRange === 'yesterday') {
        return formatDate(startDate);
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const formatPaymentMethod = (method) => {
    if (!method) return '-';
    switch (method.toLowerCase()) {
        case 'cash': return 'Tunai';
        case 'qris': return 'QRIS';
        case 'transfer': return 'Transfer';
        default: return method.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
};



export function calculateAge(birthDate) {
    if (!birthDate) return null;
    const start = new Date(birthDate);
    const end = new Date();

    const years = differenceInYears(end, start);
    // Subtract years from end date to calculate remaining months
    const dateAfterYears = new Date(start);
    dateAfterYears.setFullYear(start.getFullYear() + years);
    const months = differenceInMonths(end, dateAfterYears);

    return { years, months };
}

export function formatAge(birthDate) {
    const age = calculateAge(birthDate);
    if (!age) return '-';
    if (age.years === 0 && age.months === 0) return '< 1 Bulan';

    const parts = [];
    if (age.years > 0) parts.push(`${age.years} Thn`);
    if (age.months > 0) parts.push(`${age.months} Bln`);

    return parts.join(' ');
}

export const formatDate = (date) => {
    if (!date) return '-';
    // Handle potential legacy formats or objects
    if (date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    // Handle Date object or string
    return new Date(date).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
