import React, { useState, useEffect } from 'react';
import { Wallet, Bell, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ setSidebarOpen }) => {
  const { user } = useAuth();
  const [unsavedSheetsCount, setUnsavedSheetsCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  // Listen for unsaved changes from the ExcelDataCollector component
  useEffect(() => {
    const handleStorageChange = () => {
      // Get unsaved sheets count from localStorage or global state
      const unsavedCount = localStorage.getItem('unsavedSheetsCount');
      setUnsavedSheetsCount(unsavedCount ? parseInt(unsavedCount) : 0);
    };

    // Custom event listener for unsaved changes
    const handleUnsavedChanges = (event) => {
      setUnsavedSheetsCount(event.detail.count);
    };

    // Check initial state
    handleStorageChange();

    // Set up event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('unsavedSheetsChanged', handleUnsavedChanges);

    // Poll for changes (fallback)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('unsavedSheetsChanged', handleUnsavedChanges);
      clearInterval(interval);
    };
  }, []);

  const handleBellClick = () => {
    if (unsavedSheetsCount > 0) {
      setShowNotification(true);
      // Auto hide after 5 seconds
      setTimeout(() => setShowNotification(false), 5000);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile toggle button */}
          <button
            className="lg:hidden p-2 rounded hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <Wallet size={32} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Financial Mapping System</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Bell with Red Dot */}
          <div className="relative">
            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition relative"
              onClick={handleBellClick}
            >
              <Bell size={20} />
              {/* Red dot notification */}
              {unsavedSheetsCount > 0 && (
                <div className="absolute -top-1 -right-1">
                  <div className="relative">
                    <div className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></div>
                    <div className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></div>
                  </div>
                </div>
              )}
            </button>

            {/* Notification Message */}
            {showNotification && unsavedSheetsCount > 0 && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-fadeIn">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <Bell size={12} className="text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">
                      Unsaved Changes
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      You have unsaved changes in {unsavedSheetsCount} Excel sheet{unsavedSheetsCount !== 1 ? 's' : ''}.
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>Click "Save Current Sheet" to save your changes</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNotification(false)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition cursor-pointer">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;