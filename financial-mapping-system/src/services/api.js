// services/api.js
import axios from 'axios';

// Define the server base URL
const SERVER_URL = 'http://192.168.100.118:8080';

// Create an axios instance with the base URL
const api = axios.create({
    baseURL: SERVER_URL,
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        // Handle Content-Type based on data type
        if (config.data instanceof FormData) {
            // For FormData, don't set Content-Type header
        } else if (config.data && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }

        // Add Authorization header if token exists
        const token = localStorage.getItem('jwt_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            console.error('Unauthorized access - token may be expired');
            // Clear local storage on unauthorized
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('financial_user');
            delete api.defaults.headers.common['Authorization'];

            // Redirect to login if not already there
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;