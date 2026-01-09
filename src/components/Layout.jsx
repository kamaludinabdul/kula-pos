import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '../lib/utils';

import ErrorBoundary from './ErrorBoundary';

const Layout = () => {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth > 1024);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 1024) {
                setIsSidebarExpanded(false);
            } else {
                setIsSidebarExpanded(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
            <main className={cn(
                "flex-1 h-full overflow-y-auto transition-all duration-300"
            )}>
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    );
};

export default Layout;
