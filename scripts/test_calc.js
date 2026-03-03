const { parseISO, format, eachDayOfInterval } = require('date-fns');

const checkInDate = "2026-02-25";
const checkOutDate = "2026-03-03";

const daysInRental = eachDayOfInterval({
    start: parseISO(checkInDate),
    end: parseISO(checkOutDate)
});

console.log(daysInRental.map(d => format(d, 'yyyy-MM-dd')));
