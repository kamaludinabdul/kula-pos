import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ShiftProvider } from './context/ShiftContext';

// Components
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LockScreen from './components/LockScreen';
import { Toaster } from './components/ui/toaster';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const POS = lazy(() => import('./pages/POS'));
const MobilePOS = lazy(() => import('./pages/MobilePOS'));
const RentalDashboard = lazy(() => import('./pages/RentalDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Stores = lazy(() => import('./pages/Stores'));
const PlanManagement = lazy(() => import('./pages/PlanManagement'));
const SubscriptionApproval = lazy(() => import('./pages/admin/SubscriptionApproval'));

// Product Management
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const PurchaseOrderForm = lazy(() => import('./pages/PurchaseOrderForm'));
const StockManagement = lazy(() => import('./pages/StockManagement'));
const StockOpname = lazy(() => import('./pages/StockOpname'));
const ShoppingRecommendations = lazy(() => import('./pages/ShoppingRecommendations'));
const PromotionsList = lazy(() => import('./pages/promotions/PromotionsList'));
const PromotionForm = lazy(() => import('./pages/promotions/PromotionForm'));
const MarketBasketAnalysis = React.lazy(() => import('./pages/smart-insights/MarketBasketAnalysis'));
const SalesForecast = React.lazy(() => import('./pages/smart-insights/SalesForecast'));
const CustomerSegmentation = React.lazy(() => import('./pages/smart-insights/CustomerSegmentation'));

// Customer & Staff
const Customers = lazy(() => import('./pages/Customers'));
const Staff = lazy(() => import('./pages/Staff'));
const LoginHistory = lazy(() => import('./pages/LoginHistory'));

// Settings
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const ProfileSettings = lazy(() => import('./pages/settings/ProfileSettings'));
const FeesSettings = lazy(() => import('./pages/settings/FeesSettings'));
const PrinterSettings = lazy(() => import('./pages/settings/PrinterSettings'));
const AccessSettings = lazy(() => import('./pages/settings/AccessSettings'));
const LoyaltySettings = lazy(() => import('./pages/settings/LoyaltySettings'));
const SubscriptionSettings = lazy(() => import('./pages/settings/SubscriptionSettings'));
const TelegramSettings = lazy(() => import('./pages/settings/TelegramSettings'));
const SalesPerformanceSettings = lazy(() => import('./pages/settings/SalesPerformanceSettings'));
const GeneralSettings = lazy(() => import('./pages/settings/GeneralSettings'));
const SecuritySettings = lazy(() => import('./pages/settings/SecuritySettings'));

// Reports
const ReportsLayout = lazy(() => import('./pages/reports/ReportsLayout'));
const ProfitLoss = lazy(() => import('./pages/reports/ProfitLoss'));
const ItemSales = lazy(() => import('./pages/reports/ItemSales'));
const CategorySales = lazy(() => import('./pages/reports/CategorySales'));
const InventoryValue = lazy(() => import('./pages/reports/InventoryValue'));
const ShiftReport = lazy(() => import('./pages/reports/ShiftReport'));
const ExpenseReport = lazy(() => import('./pages/reports/ExpenseReport'));
const TopSellingProducts = lazy(() => import('./pages/reports/TopSellingProducts'));
const LoyaltyPointsReport = lazy(() => import('./pages/reports/LoyaltyPointsReport'));
const SalesPerformanceReport = lazy(() => import('./pages/reports/SalesPerformanceReport'));

// Sales & Finance
const SalesTarget = lazy(() => import('./pages/sales/SalesTarget'));
const CashFlow = lazy(() => import('./pages/finance/CashFlow'));
const ChangeLog = lazy(() => import('./pages/ChangeLog'));

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-white">
    <div className="flex flex-col items-center gap-2">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      <p className="text-sm text-slate-500 animate-pulse">Memuat aplikasi...</p>
    </div>
  </div>
);

import { checkPlanAccess, hasFeatureAccess } from './utils/plans';
// Use a constant to avoid potential issues with JSON import in some environments
const APP_VERSION = '0.10.0';

const PrivateRoute = ({ children, feature, plan, permission }) => {
  const authContext = useAuth();
  const dataContext = useData();
  const location = useLocation();
  const [showRefresh, setShowRefresh] = useState(false);

  useEffect(() => {
    let timeout;
    if (authContext?.loading || dataContext?.loading || dataContext?.storesLoading) {
      timeout = setTimeout(() => {
        setShowRefresh(true);
      }, 10000); // Show refresh after 10 seconds of loading
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowRefresh(false);
    }
    return () => clearTimeout(timeout);
  }, [authContext?.loading, dataContext?.loading, dataContext?.storesLoading]);

  if (!authContext || !dataContext) {
    return <PageLoader />;
  }

  const { user, loading } = authContext;
  const { currentStore, loading: dataLoading, storesLoading, loadingMessage } = dataContext;

  // 1. Initial Loading State
  if (loading || dataLoading || storesLoading) {
    console.log("[PrivateRoute] Loading State:", { authLoading: loading, dataLoading, storesLoading });
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white text-black z-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4"></div>
        <p className="font-medium text-lg text-slate-800">Memuat Data...</p>
        {loadingMessage && (
          <p className="text-sm text-blue-600 mt-1 animate-pulse font-medium italic">{loadingMessage}</p>
        )}

        {/* Subtle diagnostic info for debugging blank screens */}
        <div className="mt-4 text-[10px] text-gray-300 font-mono">
          A:{loading ? 'L' : 'D'} D:{dataLoading ? 'L' : 'D'} S:{storesLoading ? 'L' : 'D'}
        </div>

        {showRefresh && (
          <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-sm text-gray-500 mb-4 text-center px-6">
              Terlalu lama? Mungkin ada masalah koneksi atau cache browser.
            </p>
            <button
              onClick={() => window.location.reload(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
              Segarkan Halaman
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Unauthenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Super Admin / Owner bypass (Case-insensitive check)
  const role = user.role?.toLowerCase();
  if (role === 'super_admin' || role === 'owner') return children;

  // 4. Feature and Plan Access
  if (feature) {
    // If no active store selected, force to stores page (Only for Super Admin/Owner with no store)
    if (!currentStore) {
      if (role === 'super_admin' || !user.store_id) {
        return <Navigate to="/stores" replace />;
      }
      // For staff with store_id but missing currentStore (data/network issue), 
      // we proceed to avoid redirect loop. DataContext/UI handles missing data.
    }

    const currentPlan = (currentStore?.plan || 'free').toLowerCase();
    const dynamicPlans = dataContext.plans || {};

    // Check Plan & Feature Access
    const hasPlanAccess = plan ? checkPlanAccess(currentPlan, plan) : true;
    const hasFeatAccess = feature ? hasFeatureAccess(currentPlan, feature, dynamicPlans) : true;

    if (!hasPlanAccess || !hasFeatAccess) {
      console.warn(`Access denied for ${feature || 'page'} (Plan: ${currentPlan})`);
      return <Navigate to="/dashboard" replace />;
    }

    // 5. Granular Permissions Check
    // FIX: Use user.permissions which is properly hydrated by AuthContext (supports legacy fallbacks)
    const rolePermissions = user.permissions || [];
    const permissionKey = permission || feature;

    // Direct match or sub-permission match
    const hasPermission = rolePermissions.includes(permissionKey) ||
      rolePermissions.some(p => p.startsWith(`${permissionKey}.`));

    // Parent permission match (e.g. 'products' grants 'products.list')
    const hasParentPermission = permissionKey.includes('.') &&
      rolePermissions.includes(permissionKey.split('.')[0]);

    if (!hasPermission && !hasParentPermission) {
      console.warn(`Permission denied for ${permissionKey}`);
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

const RootRedirect = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: dataLoading, storesLoading } = useData();

  // CRITICAL: Wait for auth to finish loading first
  if (authLoading) {
    return <PageLoader />;
  }

  if (!user) return <Navigate to="/login" />;

  const role = user.role?.toLowerCase();
  console.log('[RootRedirect] User loaded:', { role, storeId: user.store_id });

  // Super admin goes to stores to select/manage
  if (role === 'super_admin') {
    return <Navigate to="/stores" replace />;
  }

  // Wait for data context to finish loading before redirecting
  if (dataLoading || storesLoading) {
    return <PageLoader />;
  }

  // All other users (owner, admin, staff) go directly to dashboard
  return <Navigate to="/dashboard" replace />;
};

const VersionChecker = () => {
  // Force update logic
  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  };

  return (
    <div className="fixed bottom-1 left-1 z-50 bg-black/50 text-white text-[10px] px-1 rounded pointer-events-none group hover:pointer-events-auto transition-all">
      v{APP_VERSION}
      <button
        onClick={handleUpdate}
        className="hidden group-hover:inline-block ml-2 bg-blue-500 hover:bg-blue-600 px-1 rounded cursor-pointer pointer-events-auto"
      >
        Update
      </button>
    </div>
  )
}

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <ShiftProvider>
            <VersionChecker />
            <LockScreen />
            <Router>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Root Redirect */}
                  <Route path="/" element={
                    <PrivateRoute>
                      <RootRedirect />
                    </PrivateRoute>
                  } />

                  {/* POS Route */}
                  <Route path="/pos" element={
                    <PrivateRoute feature="pos">
                      <POS />
                    </PrivateRoute>
                  } />

                  {/* Mobile POS Route */}
                  <Route path="/mobile-pos" element={
                    <PrivateRoute feature="pos">
                      <ErrorBoundary>
                        <MobilePOS />
                      </ErrorBoundary>
                    </PrivateRoute>
                  } />

                  {/* Admin Routes - With Sidebar Layout */}
                  <Route element={
                    <PrivateRoute>
                      <Layout />
                    </PrivateRoute>
                  }>
                    <Route path="/dashboard" element={
                      <PrivateRoute feature="dashboard">
                        <Dashboard />
                      </PrivateRoute>
                    } />

                    <Route path="/rental" element={
                      <PrivateRoute feature="rental" permission="pos" plan="pro">
                        <RentalDashboard />
                      </PrivateRoute>
                    } />
                    <Route path="/transactions" element={
                      <PrivateRoute feature="pos">
                        <Transactions />
                      </PrivateRoute>
                    } />
                    <Route path="/products" element={
                      <PrivateRoute feature="products.read">
                        <Products />
                      </PrivateRoute>
                    } />
                    <Route path="/products/add" element={
                      <PrivateRoute feature="products.create">
                        <ProductForm />
                      </PrivateRoute>
                    } />
                    <Route path="/products/edit/:id" element={
                      <PrivateRoute feature="products.update">
                        <ProductForm />
                      </PrivateRoute>
                    } />
                    <Route path="/categories" element={
                      <PrivateRoute feature="categories.read">
                        <Categories />
                      </PrivateRoute>
                    } />
                    <Route path="/suppliers" element={
                      <PrivateRoute feature="suppliers.read">
                        <Suppliers />
                      </PrivateRoute>
                    } />
                    <Route path="/purchase-orders" element={
                      <PrivateRoute feature="products.purchase_orders">
                        <PurchaseOrders />
                      </PrivateRoute>
                    } />
                    <Route path="/purchase-orders/new" element={
                      <PrivateRoute feature="products.purchase_orders">
                        <PurchaseOrderForm />
                      </PrivateRoute>
                    } />
                    <Route path="/purchase-orders/:id" element={
                      <PrivateRoute feature="products.purchase_orders">
                        <PurchaseOrderForm />
                      </PrivateRoute>
                    } />
                    <Route path="/stock-management" element={
                      <PrivateRoute feature="products.stock">
                        <StockManagement />
                      </PrivateRoute>
                    } />
                    <Route path="/stock-opname" element={
                      <PrivateRoute feature="products.stock_opname">
                        <StockOpname />
                      </PrivateRoute>
                    } />
                    <Route path="/shopping-recommendations" element={
                      <PrivateRoute feature="products.stock">
                        <ShoppingRecommendations />
                      </PrivateRoute>
                    } />
                    {/* Smart Insights Direct Routes */}
                    <Route path="/smart-insights">
                      <Route index element={<Navigate to="bundling" replace />} />
                      <Route path="bundling" element={
                        <PrivateRoute feature="smart_insights" plan="pro">
                          <MarketBasketAnalysis />
                        </PrivateRoute>
                      } />
                      <Route path="forecast" element={
                        <PrivateRoute feature="smart_insights" plan="pro">
                          <SalesForecast />
                        </PrivateRoute>
                      } />
                      <Route path="segmentation" element={
                        <PrivateRoute feature="smart_insights" plan="pro">
                          <CustomerSegmentation />
                        </PrivateRoute>
                      } />

                    </Route>
                    {/* Promotions */}
                    <Route path="/promotions" element={
                      <PrivateRoute feature="products.read">
                        <PromotionsList />
                      </PrivateRoute>
                    } />
                    <Route path="/promotions/new" element={
                      <PrivateRoute feature="products.read">
                        <PromotionForm />
                      </PrivateRoute>
                    } />
                    <Route path="/promotions/edit/:id" element={
                      <PrivateRoute feature="products.read">
                        <PromotionForm />
                      </PrivateRoute>
                    } />
                    <Route path="/customers" element={
                      <PrivateRoute feature="customers.read" plan="pro">
                        <Customers />
                      </PrivateRoute>
                    } />
                    <Route path="/staff" element={
                      <PrivateRoute feature="others.staff">
                        <Staff />
                      </PrivateRoute>
                    } />
                    <Route path="/login-history" element={
                      <PrivateRoute feature="others.login_history">
                        <LoginHistory />
                      </PrivateRoute>
                    } />
                    <Route path="/sales/target" element={
                      <PrivateRoute feature="sales.target">
                        <SalesTarget />
                      </PrivateRoute>
                    } />
                    <Route path="/sales/forecast" element={
                      <PrivateRoute feature="reports.forecast">
                        <SalesForecast />
                      </PrivateRoute>
                    } />
                    <Route path="/stores" element={<Stores />} />
                    <Route path="/admin/plans" element={
                      <PrivateRoute>
                        <PlanManagement />
                      </PrivateRoute>
                    } />
                    <Route path="/admin/subscriptions" element={
                      <PrivateRoute>
                        <SubscriptionApproval />
                      </PrivateRoute>
                    } />
                    <Route path="/settings" element={
                      <PrivateRoute feature="settings">
                        <SettingsLayout />
                      </PrivateRoute>
                    }>
                      <Route index element={<Navigate to="profile" replace />} />
                      <Route path="general" element={<GeneralSettings />} />
                      <Route path="profile" element={<ProfileSettings />} />
                      <Route path="subscription" element={<SubscriptionSettings />} />
                      <Route path="fees" element={<FeesSettings />} />
                      <Route path="printer" element={<PrinterSettings />} />
                      <Route path="access" element={<AccessSettings />} />
                      <Route path="loyalty" element={<LoyaltySettings />} />
                      <Route path="telegram" element={<TelegramSettings />} />
                      <Route path="sales-performance" element={<SalesPerformanceSettings />} />
                      <Route path="security" element={<SecuritySettings />} />
                    </Route>

                    {/* Finance Routes */}
                    <Route path="/finance/cash-flow" element={
                      <PrivateRoute feature="finance.cash_flow">
                        <CashFlow />
                      </PrivateRoute>
                    } />

                    {/* Reports Routes */}
                    <Route path="/reports" element={
                      <PrivateRoute feature="reports">
                        <ReportsLayout />
                      </PrivateRoute>
                    }>
                      <Route index element={<Navigate to="profit-loss" replace />} />
                      <Route path="profit-loss" element={
                        <PrivateRoute feature="reports.profit_loss">
                          <ProfitLoss />
                        </PrivateRoute>
                      } />
                      <Route path="sales-items" element={
                        <PrivateRoute feature="reports.sales_items">
                          <ItemSales />
                        </PrivateRoute>
                      } />
                      <Route path="top-selling" element={
                        <PrivateRoute feature="reports.sales_items" plan="pro">
                          <TopSellingProducts />
                        </PrivateRoute>
                      } />
                      <Route path="sales-categories" element={
                        <PrivateRoute feature="reports.sales_categories">
                          <CategorySales />
                        </PrivateRoute>
                      } />
                      <Route path="inventory-value" element={
                        <PrivateRoute feature="reports.inventory_value">
                          <InventoryValue />
                        </PrivateRoute>
                      } />
                      <Route path="shifts" element={
                        <PrivateRoute feature="reports.shifts">
                          <ShiftReport />
                        </PrivateRoute>
                      } />
                      <Route path="expenses" element={
                        <PrivateRoute feature="reports.shifts">
                          <ExpenseReport />
                        </PrivateRoute>
                      } />
                      <Route path="loyalty-points" element={
                        <PrivateRoute feature="reports">
                          <LoyaltyPointsReport />
                        </PrivateRoute>
                      } />
                      <Route path="sales-performance" element={
                        <PrivateRoute feature="reports">
                          <SalesPerformanceReport />
                        </PrivateRoute>
                      } />
                    </Route>

                    {/* System Routes */}
                    <Route path="/changelog" element={
                      <PrivateRoute>
                        <ChangeLog />
                      </PrivateRoute>
                    } />
                  </Route>

                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </Router>
            <Toaster />
          </ShiftProvider>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
