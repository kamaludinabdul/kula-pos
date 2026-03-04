import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, TrendingUp, Package, Layers, Clock, Gift, TrendingDown } from 'lucide-react';
const ReportsLayout = () => {

    return (
        <div className="min-h-screen">
            <Outlet />
        </div>
    );
};



export default ReportsLayout;
