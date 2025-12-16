import React, { useState, useEffect } from 'react';
import { Wallet, Bell, Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ setSidebarOpen, onLogout, user }) => {
  const [unsavedSheetsCount, setUnsavedSheetsCount] = useState(0);
  const [isNotificationHovered, setIsNotificationHovered] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const auth = useAuth();
  const displayUser = user || auth.user;

  // Track unsaved sheets
  useEffect(() => {
    const handleStorageChange = () => {
      const unsavedCount = localStorage.getItem('unsavedSheetsCount');
      setUnsavedSheetsCount(unsavedCount ? parseInt(unsavedCount) : 0);
    };
    const handleUnsavedChanges = (event) => {
      setUnsavedSheetsCount(event.detail.count);
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

  // User dropdown handlers
  const handleUserClick = () => {
    setShowUserDropdown(!showUserDropdown);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      auth.logout();
    }
    setShowUserDropdown(false);
  };

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-dropdown')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserDropdown]);

  const showNotification = unsavedSheetsCount > 0 && isNotificationHovered;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>
            <Wallet size={32} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              SACCO financial data management system
            </h1>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-4">
            {/* NOTIFICATION BELL */}
            <div
              className="relative"
              onMouseEnter={() => setIsNotificationHovered(true)}
              onMouseLeave={() => setIsNotificationHovered(false)}
            >
              <button
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition relative"
                aria-label={`Notifications ${unsavedSheetsCount > 0 ? `(${unsavedSheetsCount} unsaved)` : ''}`}
              >
                <Bell size={20} />
                {unsavedSheetsCount > 0 && (
                  <div className="absolute -top-1 -right-1">
                    <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center animate-pulse [animation-duration:2s]">
                      <span className="text-xs font-bold text-white">
                        {unsavedSheetsCount > 9 ? '9+' : unsavedSheetsCount}
                      </span>
                    </div>
                  </div>
                )}
              </button>

              {/* NOTIFICATION POPUP */}
              {showNotification && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-fadeInUpScale"
                  onMouseEnter={() => setIsNotificationHovered(true)}
                  onMouseLeave={() => setIsNotificationHovered(false)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <Bell size={10} className="text-white" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900">Unsaved Changes</h4>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNotificationHovered(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-medium text-gray-900">{unsavedSheetsCount}</span> sheet
                        {unsavedSheetsCount !== 1 ? 's' : ''} contain unsaved data
                      </p>
                      <div className="text-xs text-gray-500 px-3 py-1.5 bg-blue-50 rounded border border-blue-100">
                        ⚡ Save each sheet individually
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* USER DROPDOWN */}
            <div className="relative user-dropdown">
              <button
                onClick={handleUserClick}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                aria-label="User menu"
                aria-expanded={showUserDropdown}
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {displayUser?.fullName?.charAt(0).toUpperCase() ||
                    displayUser?.username?.charAt(0).toUpperCase() ||
                    'U'}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-sm font-medium text-gray-700 block">
                    {displayUser?.fullName || displayUser?.username || 'User'}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {displayUser?.role ? `Role: ${displayUser.role}` : ''}
                  </span>
                </div>
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 animate-fadeInUpScale">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {displayUser?.fullName?.charAt(0).toUpperCase() ||
                          displayUser?.username?.charAt(0).toUpperCase() ||
                          'U'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {displayUser?.fullName || displayUser?.username || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">
                          {displayUser?.email || ''}
                        </p>
                      </div>
                    </div>
                    {displayUser?.role && (
                      <div className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {displayUser.role}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;