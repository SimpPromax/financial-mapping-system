import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Layout from './pages/Layout/Layout';
import Login from './pages/Login/Login';
import Register from './pages/Login/Register'; // Add this import
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
import { useAuth } from './hooks/useAuth';
import DataVisualization from './pages/Visualization/DataVisualization';

function App() {


  const { user } = useAuth();
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* Add Register route */}

        {/* Protected routes with Layout wrapper */}
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
          <Route path="chart-of-accounts" element={<ChartOfAccounts user={user} />} />
          <Route path="mapping" element={<Mapping />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data-visualization" element={<DataVisualization />} />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;