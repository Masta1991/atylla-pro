import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, clearAuthToken, invalidateCache, setSessionExpiredCallback } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredCallback(() => {
      signOut();
    });
    Promise.all([
      AsyncStorage.getItem('auth_token'),
      AsyncStorage.getItem('refresh_token')
    ])
      .then(([storedToken, storedRefresh]) => {
        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken, storedRefresh);
        }
      })
      .catch(err => console.error("Error reading token:", err))
      .finally(() => setLoading(false));
    AsyncStorage.getItem('auth_email')
      .then(stored => { if (stored) setEmail(stored); })
      .catch(() => {});
  }, []);

  async function signIn(newToken, userEmail, newRefreshToken) {
    setToken(newToken);
    setAuthToken(newToken, newRefreshToken);
    invalidateCache();
    if (userEmail) {
      setEmail(userEmail);
      await AsyncStorage.setItem('auth_email', userEmail);
    }
    await AsyncStorage.setItem('auth_token', newToken);
    if (newRefreshToken) {
      await AsyncStorage.setItem('refresh_token', newRefreshToken);
    }
  }

  async function signOut() {
    setToken(null);
    setEmail(null);
    clearAuthToken();
    invalidateCache();
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('auth_email');
  }

  return (
    <AuthContext.Provider value={{ token, email, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
