import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  FileSpreadsheet,
  TrendingUp,
  BarChart2,
  FileDown,
  X,
  FilePlus,
  FileEdit,
  FolderOpen,
  Link as LinkIcon,
  ListTree,
  Merge,
  FileBarChart,
  LogOut,
  ChevronDown,
  User,
  Mail,
  Shield,
} from 'lucide-react';

const Sidebar = ({ sidebarOpen, setSidebarOpen, onLogout, user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [financialExpanded, setFinancialExpanded] = useState(false);
  const [templateExpanded, setTemplateExpanded] = useState(false);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  const [unsavedSheetsCount, setUnsavedSheetsCount] = useState(0);

  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleStorageChange = () => {
      const unsavedCount = localStorage.getItem('unsavedSheetsCount');
      setUnsavedSheetsCount(unsavedCount ? parseInt(unsavedCount, 10) : 0);
    };

    const handleUnsavedChanges = (event) => {
      if (event?.detail?.count !== undefined) {
        setUnsavedSheetsCount(event.detail.count);
      }
    };

    handleStorageChange();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('unsavedSheetsChanged', handleUnsavedChanges);

    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('unsavedSheetsChanged', handleUnsavedChanges);
      clearInterval(interval);
    };
  }, []);

  const isTemplateActive =
    location.pathname.startsWith('/excelinitialiser') ||
    location.pathname.startsWith('/viewsaveddata');

  const isFinancialActive =
    location.pathname.startsWith('/chart-of-accounts') ||
    location.pathname.startsWith('/mapping');

  useEffect(() => {
    setTemplateExpanded(isTemplateActive);
  }, [isTemplateActive]);

  useEffect(() => {
    setFinancialExpanded(isFinancialActive);
  }, [isFinancialActive]);

  const showTooltip = (text, event) => {
    const padding = 12;
    const tooltipWidth = 280;
    const tooltipHeight = 48;
    let x = event.clientX + 12;
    let y = event.clientY + 12;

    if (x + tooltipWidth > window.innerWidth)
      x = window.innerWidth - tooltipWidth - padding;
    if (y + tooltipHeight > window.innerHeight)
      y = window.innerHeight - tooltipHeight - padding;

    setTooltip({ show: true, text, x, y });
  };

  const hideTooltip = () => setTooltip((prev) => ({ ...prev, show: false }));

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setSidebarOpen(false);
  };

  const LargeNotifyDot = () => (
    <div className="relative ml-3 flex items-center">
      <div className="absolute -inset-1 rounded-full bg-red-400 opacity-60 animate-pulse blur-sm" />
      <div className="absolute -inset-1 rounded-full bg-red-500 animate-ping" />
      <div className="relative h-3 w-3 rounded-full bg-red-600 border border-white shadow-md" />
    </div>
  );

  const SmallNotifyDot = () => (
    <div className="relative ml-auto flex items-center">
      <div className="absolute -inset-1 rounded-full bg-red-400 opacity-60 animate-pulse blur-[2px]" />
      <div className="absolute -inset-1 rounded-full bg-red-500 animate-ping" />
      <div className="relative h-2 w-2 rounded-full bg-red-600 border border-white shadow-sm" />
    </div>
  );

  // Navigation items array — "Data Visualization" marked as premium for Pro badge
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Layout },
    { path: '/transactions', label: 'Transactions', icon: FileSpreadsheet, },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp, premium: true },
    {
      path: '/data-visualization',
      label: 'Data Visualization',
      icon: BarChart2,
      premium: true // only used to show "Pro" badge
    },
    { path: '/excel-download', label: 'Excel Download', icon: FileDown },
  ];

  return (
    <div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {tooltip.show && (
        <div
          ref={tooltipRef}
          className="fixed bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg border border-gray-700 max-w-xs pointer-events-none"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, zIndex: 1000 }}
        >
          {tooltip.text}
          <div className="absolute -left-1 top-1/2 w-2 h-2 bg-gray-900 transform -translate-y-1/2 rotate-45" />
        </div>
      )}

      <div
        className={`fixed top-0 left-0 z-50 bg-white border-r border-gray-200 h-screen w-80 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 lg:justify-start">
          <h2 className="text-xl font-bold text-gray-900">SACCO (FDMS)</h2>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={22} />
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {/* Main Navigation Items */}
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = location.pathname === item.path;
            const isPremium = item.premium;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-6 py-3 mx-2 rounded-lg relative transition-all duration-300 ${isActive
                  ? 'text-white font-semibold'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                {/* Background highlight */}
                <span
                  className={`absolute inset-y-0 left-2 right-2 rounded-lg transition-all duration-300 ${isActive
                    ? 'bg-blue-600 scale-100'
                    : 'bg-blue-600 scale-0 group-hover:scale-100 opacity-20'
                    }`}
                />
                <IconComp
                  size={20}
                  className="relative z-10 transition-transform duration-200 group-hover:scale-110"
                />
                <span className="relative z-10 flex-1">{item.label}</span>

                {/* Pro badge — only for premium items */}
                {isPremium && (
                  <span className="relative z-10 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Pro
                  </span>
                )}
              </Link>
            );
          })}

          {/* PREPARE TEMPLATE SECTION */}
          <div className="relative">
            <button
              onClick={() => setTemplateExpanded(!templateExpanded)}
              className={`group flex items-center justify-between w-full px-6 py-3 mx-2 rounded-lg relative transition-all duration-300 ${isTemplateActive
                ? 'text-white font-semibold'
                : 'text-gray-600 hover:text-gray-800'
                }`}
              aria-expanded={templateExpanded}
            >
              <span className="flex items-center gap-3 flex-1">
                <span
                  className={`absolute inset-y-0 left-2 right-2 rounded-lg transition-all duration-300 ${isTemplateActive
                    ? 'bg-blue-600 scale-100'
                    : 'bg-blue-600 scale-0 group-hover:scale-100 opacity-20'
                    }`}
                />
                <FilePlus
                  size={20}
                  className="relative z-10 transition-transform duration-200 group-hover:scale-110"
                />
                <span className="relative z-10">Prepare Template</span>

                {unsavedSheetsCount > 0 && <LargeNotifyDot />}
              </span>

              <span className="relative z-10">
                {templateExpanded ? <X size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {templateExpanded && (
              <div className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                <Link
                  to="/excelinitialiser"
                  onClick={() => {
                    setSidebarOpen(false);
                    hideTooltip();
                  }}
                  onMouseEnter={(e) =>
                    showTooltip(
                      'Sets up a clean template with the required column structure',
                      e
                    )
                  }
                  onMouseLeave={hideTooltip}
                  className={`block px-4 py-2 rounded hover:bg-gray-100 relative ${location.pathname.startsWith('/excelinitialiser')
                    ? 'font-semibold text-blue-600'
                    : 'text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <FileEdit size={16} />
                    <span>Set Up New Data</span>
                    {unsavedSheetsCount > 0 && <SmallNotifyDot />}
                  </div>
                </Link>

                <Link
                  to="/viewsaveddata"
                  onClick={() => {
                    setSidebarOpen(false);
                    hideTooltip();
                  }}
                  onMouseEnter={(e) =>
                    showTooltip(
                      'View previously saved template configurations',
                      e
                    )
                  }
                  onMouseLeave={hideTooltip}
                  className={`block px-4 py-2 rounded hover:bg-gray-100 ${location.pathname.startsWith('/viewsaveddata')
                    ? 'font-semibold text-blue-600'
                    : 'text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} />
                    <span>View Saved Data</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* FINANCIAL MAPPING SECTION */}
          <div className="relative">
            <button
              onClick={() => setFinancialExpanded(!financialExpanded)}
              className={`group flex items-center justify-between w-full px-6 py-3 mx-2 rounded-lg relative transition-all duration-300 ${isFinancialActive
                ? 'text-white font-semibold'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <span className="flex items-center gap-3 flex-1">
                <span
                  className={`absolute inset-y-0 left-2 right-2 rounded-lg transition-all duration-300 ${isFinancialActive
                    ? 'bg-blue-600 scale-100'
                    : 'bg-blue-600 scale-0 group-hover:scale-100 opacity-20'
                    }`}
                />
                <LinkIcon
                  size={20}
                  className="relative z-10 transition-transform duration-200 group-hover:scale-110"
                />
                <span className="relative z-10">Financial Mapping</span>
              </span>

              <span className="relative z-10">
                {financialExpanded ? <X size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {financialExpanded && (
              <div className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                <Link
                  to="/chart-of-accounts"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-4 py-2 rounded hover:bg-gray-100 ${location.pathname.startsWith('/chart-of-accounts')
                    ? 'font-semibold text-blue-600'
                    : 'text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <ListTree size={16} />
                    <span>Chart of Accounts</span>
                  </div>
                </Link>

                <Link
                  to="/mapping"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-4 py-2 rounded hover:bg-gray-100 ${location.pathname.startsWith('/mapping')
                    ? 'font-semibold text-blue-600'
                    : 'text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Merge size={16} />
                    <span>Mapping</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* REPORTS — STANDALONE BELOW FINANCIAL MAPPING */}
          <Link
            to="/reports"
            onClick={() => setSidebarOpen(false)}
            className={`group flex items-center gap-3 px-6 py-3 mx-2 rounded-lg relative transition-all duration-300 ${location.pathname.startsWith('/reports')
              ? 'text-white font-semibold'
              : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            <span
              className={`absolute inset-y-0 left-2 right-2 rounded-lg transition-all duration-300 ${location.pathname.startsWith('/reports')
                ? 'bg-blue-600 scale-100'
                : 'bg-blue-600 scale-0 group-hover:scale-100 opacity-20'
                }`}
            />
            <FileBarChart
              size={20}
              className="relative z-10 transition-transform duration-200 group-hover:scale-110"
            />
            <span className="relative z-10">Reports</span>
          </Link>
        </nav>

        {/* USER FOOTER */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.fullName?.charAt(0).toUpperCase() ||
                user?.username?.charAt(0).toUpperCase() ||
                'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate">
                {user?.fullName || user?.username || 'User'}
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                <Mail size={10} />
                {user?.email || ''}
              </div>
              {user?.role && (
                <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-1">
                  <Shield size={10} />
                  {user.role}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-white border hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors duration-200"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;