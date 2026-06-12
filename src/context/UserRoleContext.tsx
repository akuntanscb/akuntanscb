import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserRole } from '../types';
import { getUserRoleByEmail, DEFAULT_VIEWER_PERMISSIONS } from '../services/userRoleService';
import { logActivity } from '../services/activityLogService';

interface UserRoleContextType {
  user: User | null;
  userRole: UserRole | null;
  isLoadingRole: boolean;
  refreshRole: () => Promise<void>;
  hasPermission: (permissionKey: keyof UserRole['permissions']) => boolean;
  isUnitAllowed: (unit?: 'SMP' | 'SMA' | 'Umum') => boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  const fetchRole = async (currentUser: User) => {
    setIsLoadingRole(true);
    try {
      const email = currentUser.email || '';
      const roleData = await getUserRoleByEmail(email);
      setUserRole(roleData);
      
      // Log login event
      await logActivity('Masuk Sistem (Google Sign-In)', 'Auth', `Pengguna ${email} berhasil masuk ke dalam sistem.`);
    } catch (error) {
      console.error('Error fetching user role:', error);
      // Fallback
      setUserRole({
        email: currentUser.email || '',
        name: currentUser.displayName || 'Pengguna',
        role: 'viewer',
        permissions: DEFAULT_VIEWER_PERMISSIONS,
        restrictedUnits: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } finally {
      setIsLoadingRole(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If we had a user and they're logging out, we can log it
      if (!currentUser && user) {
        await logActivity('Keluar Sistem', 'Auth', `Pengguna ${user.email} keluar.`);
      }
      
      setUser(currentUser);
      if (currentUser) {
        await fetchRole(currentUser);
      } else {
        setUserRole(null);
        setIsLoadingRole(false);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  const refreshRole = async () => {
    if (user) {
      await fetchRole(user);
    }
  };

  const hasPermission = (permissionKey: keyof UserRole['permissions']): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    return !!userRole.permissions[permissionKey];
  };

  const isUnitAllowed = (unit?: 'SMP' | 'SMA' | 'Umum'): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    if (!unit) return true;
    if (userRole.restrictedUnits.length === 0) return true;
    return !userRole.restrictedUnits.includes(unit);
  };

  return (
    <UserRoleContext.Provider value={{ user, userRole, isLoadingRole, refreshRole, hasPermission, isUnitAllowed }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};
