import React from 'react';
import { Wallet, Bell, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ setSidebarOpen }) => {
  const { user } = useAuth();

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
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition">
            <Bell size={20} />
          </button>

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
