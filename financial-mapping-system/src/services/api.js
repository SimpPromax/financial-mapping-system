import axios from 'axios';

// Define the server base URL
// You can change this value to update the server address for the entire application
const SERVER_URL = 'http://192.168.100.118:8080';

// Create an axios instance with the base URL
// REMOVED the default Content-Type header
const api = axios.create({
    baseURL: SERVER_URL,
    // No default headers here - we'll set them dynamically in the interceptor
});

// Add a request interceptor to handle Content-Type dynamically
api.interceptors.request.use(
    (config) => {
        // Handle Content-Type based on data type
        if (config.data instanceof FormData) {
            // For FormData, let browser set the Content-Type automatically
            // or explicitly set it without interfering with boundary
            // Don't set Content-Type header - axios/browser will handle it
        } else if (config.data && !config.headers['Content-Type']) {
            // For non-FormData requests (JSON, etc.), default to application/json
            config.headers['Content-Type'] = 'application/json';
        }
        
        // You can add auth tokens here if needed
        // const token = localStorage.getItem('token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        
        console.log('API Request:', {
            method: config.method?.toUpperCase(),
            url: config.url,
            contentType: config.headers['Content-Type'],
            dataType: config.data?.constructor.name
        });
        
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Add a response interceptor (optional, for global error handling)
api.interceptors.response.use(
    (response) => {
        console.log('API Response:', {
            status: response.status,
            url: response.config.url
        });
        return response;
    },
    (error) => {
        // Handle global errors like 401 Unauthorized here
        console.error('API Error:', {
            message: error.message,
            status: error.response?.status,
            url: error.config?.url,
            method: error.config?.method
        });
        return Promise.reject(error);
    }
);

export default api;