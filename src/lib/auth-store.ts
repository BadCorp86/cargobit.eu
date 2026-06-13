import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SHIPPER_PRIVATE' | 'SHIPPER_COMPANY' | 'CARRIER' | 'DRIVER_SELF_EMPLOYED' | 'DISPATCHER' | 'ADMIN' | 'SUPPORT' | 'MARKETER';
export type AccountType = 'SHIPPER' | 'TRANSPORT_SOLO' | 'CARRIER_COMPANY' | 'INTERNAL';
export type OrganizationRole = 'OWNER' | 'OWNER_DRIVER' | 'DISPATCHER' | 'DRIVER' | 'ACCOUNTING' | 'ADMIN' | 'SUPPORT' | 'MARKETING' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  accountType?: AccountType;
  organizationRole?: OrganizationRole;
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

export function buildUserRequestHeaders(
  user: { id?: string; email?: string; role?: string } | null | undefined,
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  if (!user?.id) return { ...extraHeaders };

  return {
    ...extraHeaders,
    Authorization: `Bearer local-dev-${user.id}`,
    'x-user-id': user.id,
    'x-user-email': user.email || '',
    'x-user-role': user.role || '',
    'x-user-roles': user.role || '',
  };
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

function deriveAccountMeta(role: UserRole): Pick<User, 'accountType' | 'organizationRole'> {
  switch (role) {
    case 'CARRIER':
      return { accountType: 'CARRIER_COMPANY', organizationRole: 'OWNER' };
    case 'DISPATCHER':
      return { accountType: 'CARRIER_COMPANY', organizationRole: 'DISPATCHER' };
    case 'DRIVER_SELF_EMPLOYED':
      return { accountType: 'TRANSPORT_SOLO', organizationRole: 'OWNER_DRIVER' };
    case 'ADMIN':
      return { accountType: 'INTERNAL', organizationRole: 'ADMIN' };
    case 'SUPPORT':
      return { accountType: 'INTERNAL', organizationRole: 'SUPPORT' };
    case 'MARKETER':
      return { accountType: 'INTERNAL', organizationRole: 'MARKETING' };
    case 'SHIPPER_COMPANY':
      return { accountType: 'SHIPPER', organizationRole: 'OWNER' };
    case 'SHIPPER_PRIVATE':
    default:
      return { accountType: 'SHIPPER', organizationRole: 'MEMBER' };
  }
}

// Demo users for testing
const demoUsers: User[] = [
  {
    id: '1',
    email: 'shipper@cargobit.eu',
    firstName: 'Max',
    lastName: 'Müller',
    role: 'SHIPPER_COMPANY',
    accountType: 'SHIPPER',
    organizationRole: 'OWNER',
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
    email: 'shipper.private@cargobit.eu',
    firstName: 'Laura',
    lastName: 'Becker',
    role: 'SHIPPER_PRIVATE',
    accountType: 'SHIPPER',
    organizationRole: 'MEMBER',
    phone: '+49 151 234567',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.6,
    totalTransports: 8,
    subscriptionPlan: 'FREE',
  },
  {
    id: '3',
    email: 'carrier@cargobit.eu',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'CARRIER',
    accountType: 'CARRIER_COMPANY',
    organizationRole: 'OWNER',
    companyName: 'Schmidt Spedition',
    phone: '+49 555 123456',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.7,
    totalTransports: 421,
    subscriptionPlan: 'ENTERPRISE',
  },
  {
    id: '4',
    email: 'driver@cargobit.eu',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'DRIVER_SELF_EMPLOYED',
    accountType: 'TRANSPORT_SOLO',
    organizationRole: 'OWNER_DRIVER',
    phone: '+49 987 654321',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.9,
    totalTransports: 342,
    subscriptionPlan: 'STARTER',
  },
  {
    id: '5',
    email: 'dispatcher@cargobit.eu',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'DISPATCHER',
    accountType: 'CARRIER_COMPANY',
    organizationRole: 'DISPATCHER',
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
    id: '6',
    email: 'admin@cargobit.eu',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    accountType: 'INTERNAL',
    organizationRole: 'ADMIN',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 5.0,
    totalTransports: 0,
    subscriptionPlan: 'ENTERPRISE',
  },
  {
    id: '7',
    email: 'support@cargobit.eu',
    firstName: 'Lisa',
    lastName: 'Support',
    role: 'SUPPORT',
    accountType: 'INTERNAL',
    organizationRole: 'SUPPORT',
    language: 'de',
    emailVerified: true,
    identityVerified: true,
    rating: 4.9,
    totalTransports: 0,
    subscriptionPlan: 'ENTERPRISE',
  },
  {
    id: '8',
    email: 'marketer@cargobit.eu',
    firstName: 'Peter',
    lastName: 'Marketing',
    role: 'MARKETER',
    accountType: 'INTERNAL',
    organizationRole: 'MARKETING',
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
            ...deriveAccountMeta('SHIPPER_PRIVATE'),
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
          ...deriveAccountMeta(data.role),
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
