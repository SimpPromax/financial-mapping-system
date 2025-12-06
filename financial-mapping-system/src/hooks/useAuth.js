// hooks/useAuth.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check for existing token and user data
    const savedToken = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('financial_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Set default axios header
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
    setIsLoading(false);
  }, []);

  const login = async (username, password) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      const { accessToken, user } = response.data;

      // Store token and user data
      localStorage.setItem('jwt_token', accessToken);
      localStorage.setItem('financial_user', JSON.stringify(user));

      // Set axios default header
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setToken(accessToken);
      setUser(user);

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      if (error.response?.data) {
        errorMessage = typeof error.response.data === 'string'
          ? error.response.data
          : error.response.data.message || errorMessage;
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/register', userData);

      const { accessToken, user } = response.data;

      // Auto-login after registration
      localStorage.setItem('jwt_token', accessToken);
      localStorage.setItem('financial_user', JSON.stringify(user));
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setToken(accessToken);
      setUser(user);

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed';
      if (error.response?.data) {
        errorMessage = typeof error.response.data === 'string'
          ? error.response.data
          : error.response.data.message || errorMessage;
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Call logout endpoint if needed
    if (token) {
      api.post('/api/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(console.error);
    }

    // Clear local storage
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('financial_user');

    // Remove axios header
    delete api.defaults.headers.common['Authorization'];

    setToken(null);
    setUser(null);
  };

  const validateToken = async () => {
    if (!token) return false;

    try {
      const response = await api.post('/api/auth/validate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.accessToken ? true : false;
    } catch (error) {
      console.error('Token validation failed:', error);
      // Auto-logout on invalid token
      logout();
      return false;
    }
  };

  return {
    user,
    token,
    login,
    register,
    logout,
    validateToken,
    isLoading,
    isAuthenticated: !!token
  };
};