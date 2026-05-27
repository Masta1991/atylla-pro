import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('auth_token').then(stored => {
      if (stored) setToken(stored);
      setLoading(false);
    });
  }, []);

  async function signIn(newToken) {
    setToken(newToken);
    await AsyncStorage.setItem('auth_token', newToken);
  }

  async function signOut() {
    setToken(null);
    await AsyncStorage.removeItem('auth_token');
  }

  return (
    <AuthContext.Provider value={{ token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
