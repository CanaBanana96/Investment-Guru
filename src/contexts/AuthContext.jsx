import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('investmentGuruGuest') === 'true');

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setInitializing(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const continueAsGuest = () => {
    localStorage.setItem('investmentGuruGuest', 'true');
    setIsGuest(true);
  };

  const exitGuest = () => {
    localStorage.removeItem('investmentGuruGuest');
    setIsGuest(false);
  };

  const value = useMemo(
    () => ({ user, initializing, isFirebaseConfigured, isGuest, continueAsGuest, exitGuest }),
    [user, initializing, isGuest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
