import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/Common/Sidebar';
import Header from '../../components/Common/Header';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout} // Pass logout handler to Sidebar
        user={user} // Pass user data to Sidebar
      />

      {/* Content wrapper shifts right ONLY on desktop */}
      <div className="flex-1 flex flex-col lg:pl-80 transition-all duration-300">
        <Header
          setSidebarOpen={setSidebarOpen}
          onLogout={handleLogout} // Pass logout handler to Header
          user={user} // Pass user data to Header
        />

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;