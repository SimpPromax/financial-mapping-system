// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Layout from './pages/Layout/Layout';
import Login from './pages/Login/Login';
import Register from './pages/Login/Register';
import NotFound from './pages/NotFound/NotFound';
import Dashboard from './components/Dashboard/Dashboard';
import TransactionList from './components/Transactions/TransactionList';
import FinancialCharts from './components/Charts/FinancialCharts';
import ExcelDownload from './pages/ExcelDownload/ExcelDownload';
import ExcelInitialiser from './pages/ExcelFormInitialisation/ExcelcelInitialiser';
import ViewSavedData from './pages/ExcelFormInitialisation/ViewSavedData';
import ChartOfAccounts from './pages/MappingPart/ChartOfAccounts';
import Mapping from './pages/MappingPart/Mapping';
import Reports from './pages/Reports/Reports';
import DataVisualization from './pages/Visualization/DataVisualization';
// ✅ Import useAuth from context (not directly from hook)
import { useAuth } from '../src/Context/AuthContext';

function App() {
  const { user, isLoading } = useAuth();

  // Wait for auth initialization
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<TransactionList />} />
          <Route path="analytics" element={<FinancialCharts />} />
          <Route path="excel-download" element={<ExcelDownload />} />
          <Route path="excelinitialiser" element={<ExcelInitialiser />} />
          <Route path="viewsaveddata" element={<ViewSavedData />} />

          {/* ✅ KEY FIX: Remount when user changes */}
          <Route
            path="chart-of-accounts"
            element={<ChartOfAccounts user={user} key={user?.username || 'guest'} />}
          />

          <Route path="mapping" element={<Mapping />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data-visualization" element={<DataVisualization />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;