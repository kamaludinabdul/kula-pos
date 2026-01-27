import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '../lib/utils';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";

import ErrorBoundary from './ErrorBoundary';

const Layout = () => {
    const location = useLocation();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth > 1024);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

    // Close drawer when location changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsDrawerOpen(false);
    }, [location]);

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden">
            {/* Mobile Header */}
            <header className="lg:hidden flex items-center justify-start px-4 h-16 bg-white border-b shrink-0 z-40 gap-3">
                <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="-ml-2 text-slate-600">
                            <Menu size={24} />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72 border-none">
                        <div className="sr-only">
                            <SheetTitle>Menu Navigasi</SheetTitle>
                            <SheetDescription>Akses berbagai fitur aplikasi melalui menu ini.</SheetDescription>
                        </div>
                        <Sidebar isExpanded={true} setIsExpanded={() => { }} isDrawer={true} />
                    </SheetContent>
                </Sheet>
                <div className="flex items-center gap-2">
                    <img src="/favicon.png" alt="Logo" className="h-8 w-auto" />
                    <span className="font-bold text-lg text-slate-800 tracking-tight">KULA POS</span>
                </div>
            </header>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block shrink-0 h-full">
                <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
            </div>

            <main className={cn(
                "flex-1 h-full overflow-y-auto transition-all duration-300 relative"
            )}>
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    );
};

export default Layout;
