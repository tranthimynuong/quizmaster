import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  setAuthToken,
  getAuthToken,
  updateUserProfile as apiUpdateProfile,
  changePassword as apiChangePassword
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    async function initAuth() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await fetchCurrentUser();
        setUser(userData);
      } catch (err) {
        console.error('Session expired or error verifying user:', err);
        setAuthToken(null);
        setUser(null);
        setTokenState(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await loginUser(credentials);
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const data = await registerUser(userData);
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await fetchCurrentUser();
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  };

  const updateProfile = async (profileData) => {
    const updated = await apiUpdateProfile(profileData);
    setUser(updated);
    return updated;
  };

  const changePassword = async (passwordData) => {
    return await apiChangePassword(passwordData);
  };

  const role = user?.role || null;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher' || role === 'admin';
  const isStudent = role === 'student';
  const isAuthenticated = !!user;

  const value = {
    user,
    token,
    role,
    isAdmin,
    isTeacher,
    isStudent,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
