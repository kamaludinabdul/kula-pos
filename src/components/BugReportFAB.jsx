import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import BugReportDialog from './BugReportDialog';

const BugReportFAB = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-6 z-50 h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group"
                title="Laporkan Masalah"
                aria-label="Laporkan Masalah"
            >
                <Bug className="h-5 w-5 group-hover:animate-pulse" />
            </button>
            <BugReportDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default BugReportFAB;
