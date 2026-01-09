import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, TrendingUp, Package, Layers, Clock, Gift, TrendingDown } from 'lucide-react';
const ReportsLayout = () => {

    return (
        <div className="p-6 space-y-6">
            <div className="min-h-[500px]">
                <Outlet />
            </div>
        </div>
    );
};



export default ReportsLayout;
