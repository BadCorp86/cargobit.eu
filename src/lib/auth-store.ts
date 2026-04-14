import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SHIPPER_PRIVATE' | 'SHIPPER_COMPANY' | 'DRIVER_SELF_EMPLOYED' | 'DISPATCHER' | 'ADMIN' | 'SUPPORT' | 'MARKETER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
  language: string;
  avatar?: string;
  emailVerified: boolean;
  identityVerified: boolean;
  rating: number;
  totalTransports: number;
  subscriptionPlan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
}

// Demo users for testing
const demoUsers: User[] = [
  {
    id: '1',
    email: 'shipper@cargobit.eu',
    firstName: 'Max',
    lastName: 'Müller',
    role: 'SHIPPER_COMPANY',
    companyName: 'Müller Logistics GmbH',
    phone: '+49 123 456789',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.8,
    totalTransports: 156,
    subscriptionPlan: 'PROFESSIONAL',
  },
  {
    id: '2',
    email: 'driver@cargobit.eu',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'DRIVER_SELF_EMPLOYED',
    phone: '+49 987 654321',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.9,
    totalTransports: 342,
    subscriptionPlan: 'STARTER',
  },
  {
    id: '3',
    email: 'dispatcher@cargobit.eu',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'DISPATCHER',
    companyName: 'Schmidt Spedition',
    phone: '+49 555 123456',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.7,
    totalTransports: 89,
    subscriptionPlan: 'ENTERPRISE',
  },
  {
    id: '4',
    email: 'admin@cargobit.eu',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 5.0,
    totalTransports: 0,
    subscriptionPlan: 'ENTERPRISE',
  },
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Demo login - accept any email with password "demo123"
        const demoUser = demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (demoUser && password === 'demo123') {
          set({ user: demoUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        // For demo purposes, create a new user from the email
        if (password === 'demo123') {
          const newUser: User = {
            id: Date.now().toString(),
            email,
            firstName: email.split('@')[0],
            lastName: '',
            role: 'SHIPPER_PRIVATE',
            language: 'de',
            emailVerified: true,
            identityVerified: false,
            rating: 0,
            totalTransports: 0,
            subscriptionPlan: 'FREE',
          };
          set({ user: newUser, isAuthenticated: true, isLoading: false });
          return true;
        }
        
        set({ isLoading: false });
        return false;
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true });
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const newUser: User = {
          id: Date.now().toString(),
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          companyName: data.companyName,
          phone: data.phone,
          language: 'de',
          emailVerified: false,
          identityVerified: false,
          rating: 0,
          totalTransports: 0,
          subscriptionPlan: 'FREE',
        };
        
        set({ user: newUser, isAuthenticated: true, isLoading: false });
        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      updateUser: (data: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...data } });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'cargobit-auth',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
