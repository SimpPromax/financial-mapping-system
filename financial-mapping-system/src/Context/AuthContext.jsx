// src/context/AuthContext.jsx
import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth'; // your existing hook

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const auth = useAuth();
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Re-export so other files can import useAuth from one place (optional but clean)
export { useAuth };