
import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings, LogOut, Users, Database,
  ChevronDown, ChevronRight, Receipt, Store, Printer, UserCog, Layers, Shield, Percent,
  Gift, Sparkles, PanelLeftClose, PanelLeftOpen, Crown, ClipboardCheck, History, TrendingUp,
  Clock, TrendingDown, Send, Cloud, FileText, Copy, DollarSign, BrainCircuit, Lightbulb,
  Key, BadgePercent, Factory, Ticket, Lock, Gamepad2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
const APP_VERSION = '0.8.17';
import { checkPlanAccess, hasFeatureAccess } from '../utils/plans';
import UpgradeAlert from './UpgradeAlert';

const NavItem = ({ item, isActive, onClick, className, isExpanded, isLocked }) => (
  <NavLink
    to={isLocked ? '#' : item.path}
    className={({ isActive: linkActive }) => cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left relative group",
      (isActive || linkActive) && !isLocked
        ? "bg-primary/10 text-primary hover:bg-primary/20"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      !isExpanded && "justify-center px-2",
      className
    )}
    onClick={(e) => {
      if (isLocked) {
        e.preventDefault();
      }
      if (onClick) {
        onClick(e);
      }
    }}
    title={!isExpanded ? item.label : undefined}
  >
    <div className="flex items-center gap-3 flex-1 overflow-hidden">
      {item.icon && <item.icon size={20} className="shrink-0" />}
      {isExpanded && <span className="truncate">{item.label}</span>}
    </div>

    {isLocked && (
      <div className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2",
        !isExpanded && "right-0 top-0 translate-y-0 bg-amber-100 rounded-full p-0.5"
      )}>
        <Lock size={isExpanded ? 14 : 10} className="text-amber-500" />
      </div>
    )}
  </NavLink>
);

const Sidebar = ({ isExpanded, setIsExpanded }) => {
  const { user, logout, checkPermission } = useAuth();
  const { currentStore, plans: contextPlans } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const [isSmartStrategyOpen, setIsSmartStrategyOpen] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Upgrade Alert State
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  // We use checkPermission from AuthContext now, but we can wrap it if needed for special logic
  // The Sidebar uses `hasPermission` locally. Let's alias it or repurpose it.
  const hasPermission = (feature) => {
    // Pet Care bypass preserved if needed? User previously removed it.
    // We'll rely on checkPermission(feature) which handles:
    // 1. Super Admin / Owner -> True
    // 2. User permissions array (exact or parent match)

    // However, Sidebar sometimes passes 'products' and expects true if user has 'products.list'.
    // createPermission in AuthContext does: includes(feature) || perms.some(p => p.startsWith(feature + '.'))
    // So if feature is 'products', and user has 'products.list', startsWith('products.') is True.
    // So AuthContext checkPermission is sufficient!
    return checkPermission(feature);
  };

  const handleItemClick = (e, requiredPlan, feature) => {
    const currentPlan = currentStore?.plan || 'free';

    const hasAccess = feature
      ? hasFeatureAccess(currentPlan, feature, contextPlans)
      : checkPlanAccess(currentPlan, requiredPlan);

    if (!hasAccess) {
      e.preventDefault();
      setUpgradeFeature(requiredPlan === 'enterprise' ? 'Enterprise' : 'Pro');
      setShowUpgradeAlert(true);
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', feature: 'dashboard' },
    { icon: Receipt, label: 'Transaksi', path: '/transactions', feature: 'transactions' },
    { icon: ShoppingCart, label: 'Kasir (POS)', path: '/pos', feature: 'pos' },
    { icon: Gamepad2, label: 'Rental', path: '/rental', feature: 'rental', permission: 'pos', requiredPlan: 'pro', checkSetting: 'enableRental' },
    { icon: Ticket, label: 'Promosi', path: '/promotions', feature: 'products.read' }, // Moved to top level
  ];

  const databaseItems = [
    { icon: Package, label: 'Produk', path: '/products', feature: 'products.read' },
    { icon: Layers, label: 'Kategori', path: '/categories', feature: 'categories.read' },
    // { icon: Ticket, label: 'Promosi', path: '/promotions', feature: 'products.read' }, // Moved
    { icon: Factory, label: 'Supplier', path: '/suppliers', feature: 'suppliers.read' },
    { icon: FileText, label: 'Purchase Order', path: '/purchase-orders', feature: 'products.purchase_orders' },
    { icon: Database, label: 'Stok', path: '/stock-management', feature: 'products.stock' },
    { icon: ClipboardCheck, label: 'Stock Opname', path: '/stock-opname', feature: 'products.stock_opname', requiredPlan: 'pro' },
    { icon: Users, label: 'Pelanggan', path: '/customers', feature: 'customers.read', requiredPlan: 'pro' },
  ];

  const salesItems = [
    { icon: TrendingUp, label: 'Target', path: '/sales/target', feature: 'sales.target', requiredPlan: 'pro' },
  ];

  const settingsItems = [
    { label: 'Umum', path: '/settings/general', icon: Settings, feature: 'settings' }, // Access check: basic settings
    { label: 'Profil Toko', path: '/settings/profile', icon: UserCog, feature: 'settings.profile' },
    { label: 'Langganan', path: '/settings/subscription', icon: Crown, feature: 'settings.subscription' },
    { label: 'Biaya & Pajak', path: '/settings/fees', icon: Percent, feature: 'settings.fees' },
    { label: 'Printer & Struk', path: '/settings/printer', icon: Printer, feature: 'settings.printer' },
    { label: 'Poin Loyalitas', path: '/settings/loyalty', icon: Gift, requiredPlan: 'pro', feature: 'settings.loyalty' },
    { label: 'Sales Performance', path: '/settings/sales-performance', icon: TrendingUp, requiredPlan: 'pro', feature: 'settings.sales_performance' },
    { label: 'Notifikasi Telegram', path: '/settings/telegram', icon: Send, requiredPlan: 'pro', feature: 'settings.telegram' },
    { label: 'Keamanan', path: '/settings/security', icon: Lock, feature: 'settings.access' },
    { label: 'Hak Akses', path: '/settings/access', icon: Shield, feature: 'settings.access' },
  ];

  const reportsItems = [
    { path: '/reports/profit-loss', icon: BarChart3, label: 'Laba Rugi', feature: 'reports.profit_loss', requiredPlan: 'pro' },
    { path: '/reports/sales-items', icon: Package, label: 'Penjualan Barang', feature: 'reports.sales_items' },
    { path: '/reports/top-selling', icon: TrendingUp, label: 'Produk Terlaris', feature: 'reports.top_selling', requiredPlan: 'pro' },
    { path: '/reports/sales-categories', icon: Layers, label: 'Penjualan Kategori', feature: 'reports.sales_categories' },
    { path: '/reports/inventory-value', icon: TrendingUp, label: 'Nilai Stok (Modal)', feature: 'reports.inventory_value', requiredPlan: 'pro' },
    { path: '/reports/shifts', icon: Clock, label: 'Laporan Shift', feature: 'reports.shifts', requiredPlan: 'pro' },
    { path: '/reports/expenses', icon: TrendingDown, label: 'Pengeluaran', feature: 'reports.expenses' },
    { path: '/reports/loyalty-points', icon: Gift, label: 'Laporan Poin', feature: 'reports.loyalty', requiredPlan: 'pro' },
    { path: '/reports/sales-performance', icon: TrendingUp, label: 'Laporan Target & Performa', feature: 'reports.performance', checkSetting: 'enableSalesPerformance', requiredPlan: 'pro' },
  ];

  const financeItems = [
    { path: '/finance/cash-flow', icon: DollarSign, label: 'Arus Kas', feature: 'finance.cash_flow', requiredPlan: 'pro' },
  ];

  const smartStrategyItems = [
    { icon: BadgePercent, label: 'Bundling Pintar', path: '/smart-insights/bundling', feature: 'smart_insights', requiredPlan: 'pro' },
    { icon: TrendingUp, label: 'Prediksi Omset', path: '/smart-insights/forecast', feature: 'smart_insights', requiredPlan: 'pro' },
    { icon: Users, label: 'Segmen Pelanggan', path: '/smart-insights/segmentation', feature: 'smart_insights', requiredPlan: 'pro' },
  ];

  const bottomItems = [
    { icon: Sparkles, label: 'Rekomendasi', path: '/shopping-recommendations', feature: 'others.recommendations', requiredPlan: 'enterprise' },
    { icon: Users, label: 'Staff', path: '/staff', feature: 'others.staff' },
    { icon: History, label: 'Riwayat Login', path: '/login-history', feature: 'others.login_history', requiredPlan: 'pro' },
  ];



  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleDatabaseItems = databaseItems.filter(item => hasPermission(item.feature));
  const visibleSalesItems = salesItems.filter(item => hasPermission(item.feature));
  const visibleReportsItems = reportsItems.filter(item => {
    const isSuperAdmin = user?.role === 'super_admin';
    const hasPerm = hasPermission(item.feature);
    const settingEnabled = !item.checkSetting || currentStore?.[item.checkSetting];

    // Super Admin sees all reports, others need setting enabled
    return hasPerm && (isSuperAdmin || settingEnabled);
  });


  const isDatabaseActive = visibleDatabaseItems.some(item => location.pathname.startsWith(item.path));
  const isSalesActive = visibleSalesItems.some(item => location.pathname.startsWith(item.path));
  const isReportsActive = visibleReportsItems.some(item => location.pathname.startsWith(item.path));


  const isSettingsActive = settingsItems.some(item => location.pathname.startsWith(item.path));

  const renderNavItem = (item) => {
    const currentPlan = currentStore?.plan || 'free';

    const isLocked = item.requiredPlan && !hasFeatureAccess(currentPlan, item.feature || item.path, contextPlans);

    return (
      <NavItem
        key={item.path}
        item={item}
        isActive={location.pathname === item.path}
        isExpanded={isExpanded}
        isLocked={isLocked}
        onClick={(e) => handleItemClick(e, item.requiredPlan, item.feature)}
      />
    );
  };

  return (
    <>
      <aside className={cn(
        "h-screen bg-white border-r flex flex-col transition-all duration-300 shrink-0",
        isExpanded ? "w-64" : "w-20"
      )}>
        <div className={cn("h-16 flex items-center px-4 border-b shrink-0", isExpanded ? "justify-between" : "justify-center")}>
          {isExpanded && (
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/logo.png" alt="KULA Logo" className="h-12 w-auto object-contain" />
            </div>
          )}
          {!isExpanded && (
            <img src="/favicon.png" alt="KULA Logo" className="h-10 w-auto object-contain" />
          )}

          {isExpanded && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:flex">
              <PanelLeftClose size={18} />
            </Button>
          )}
        </div>

        {!isExpanded && (
          <div className="flex justify-center py-2 hidden lg:flex">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <PanelLeftOpen size={18} />
            </Button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-thin">
          {user?.role === 'super_admin' && (
            <>
              <NavItem
                item={{ icon: Store, label: 'Stores', path: '/stores' }}
                isActive={location.pathname === '/stores'}
                isExpanded={isExpanded}
                onClick={() => navigate('/stores')}
              />
              <NavItem
                item={{ icon: Crown, label: 'Manajemen Paket', path: '/admin/plans' }}
                isActive={location.pathname === '/admin/plans'}
                isExpanded={isExpanded}
                onClick={() => navigate('/admin/plans')}
              />
            </>
          )}

          {navItems.map((item) => {
            if (!hasPermission(item.permission || item.feature)) return null;

            // Optional Setting Check (e.g. for Rental)
            if (item.checkSetting && !currentStore?.[item.checkSetting]) return null;



            return renderNavItem(item);
          })}



          {/* Databases Menu Group */}
          {visibleDatabaseItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isDatabaseActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsDatabaseOpen(!isDatabaseOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <Database size={20} className="shrink-0" />
                      <span>Databases</span>
                    </div>
                    {isDatabaseOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isDatabaseOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleDatabaseItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleDatabaseItems[0])}
                </>
              )}
            </div>
          )}

          {/* Sales Menu Group */}
          {visibleSalesItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSalesActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSalesOpen(!isSalesOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp size={20} className="shrink-0" />
                      <span>Sales</span>
                    </div>
                    {isSalesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isSalesOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleSalesItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleSalesItems[0])}
                </>
              )}
            </div>
          )}

          {/* Reports Menu Group */}
          {visibleReportsItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isReportsActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsReportsOpen(!isReportsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 size={20} className="shrink-0" />
                      <span>Laporan</span>
                    </div>
                    {isReportsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isReportsOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleReportsItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleReportsItems[0])}
                </>
              )}
            </div>
          )}

          {/* Finance Menu Group */}
          <div className="space-y-1">
            {financeItems.map((item) => {
              if (!hasPermission(item.feature)) return null;
              return renderNavItem(item);
            })}
          </div>

          {/* Smart Strategy Menu Group */}
          {/* We default to showing this if user has permission for smart_insights */}
          {(hasPermission('smart_insights') || user?.role?.toLowerCase() === 'super_admin' || user?.role?.toLowerCase() === 'owner') && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      smartStrategyItems.some(item => location.pathname.startsWith(item.path)) ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSmartStrategyOpen(!isSmartStrategyOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={20} className="shrink-0" />
                      <span>Smart Strategy</span>
                    </div>
                    {isSmartStrategyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isSmartStrategyOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {smartStrategyItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem({ ...smartStrategyItems[0], label: "Smart Strategy", path: '/smart-insights/bundling', icon: BrainCircuit })}
                </>
              )}
            </div>
          )}

          {bottomItems.map((item) => {
            if (!hasPermission(item.feature)) return null;
            return renderNavItem(item);
          })}

          {/* Settings Menu Group */}
          {hasPermission('settings') && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSettingsActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={20} className="shrink-0" />
                      <span>Pengaturan</span>
                    </div>
                    {isSettingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isSettingsOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {settingsItems.filter(item => hasPermission(item.feature)).map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(settingsItems[0])}
                </>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t shrink-0 bg-white">
          {isExpanded ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border">
                  <span className="font-semibold text-slate-600">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate" title={user?.email}>
                    {user?.email}
                  </p>
                  <p className="text-xs text-slate-500 capitalize truncate">
                    {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'staff' ? 'Kasir' : user?.role || 'Kasir'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut size={20} className="shrink-0" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={handleLogout}
                title={`Login sebagai ${user?.email} \nKlik untuk keluar`}
              >
                <span className="font-semibold text-xs text-slate-600">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          <div className={cn(
            "text-xs text-slate-400 text-center pt-4",
            !isExpanded && "text-[10px] pt-2"
          )}>
            <NavLink to="/changelog" className="hover:text-indigo-600 hover:underline transition-colors block p-1">
              v{APP_VERSION}
            </NavLink>
          </div>
        </div>
      </aside>

      <UpgradeAlert
        isOpen={showUpgradeAlert}
        onClose={() => setShowUpgradeAlert(false)}
        title={`Fitur ${upgradeFeature} `}
        description={`Fitur ini hanya tersedia untuk paket ${upgradeFeature} dan di atasnya.Upgrade sekarang untuk membuka akses!`}
        benefits={[
          "Akses ke semua laporan detail",
          "Manajemen stok lanjutan",
          "Multi-user staff",
          "Dan banyak lagi..."
        ]}
      />
    </>
  );
};

export default Sidebar;
