import { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, registerApi, getMeApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await getMeApi();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch {
          // Clear if token invalid
          setUser(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) => {
    const data = await registerApi({ username, email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
