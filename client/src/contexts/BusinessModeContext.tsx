import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';

interface BusinessUnit {
  id: string;
  name: string;
  type: 'grocery' | 'restaurant' | 'pharmacy' | 'electronics' | 'clothing' | 'Grocery' | 'Restaurant' | 'Pharmacy' | 'Electronics' | 'Clothing';
  settings?: string;
  isActive: 'true' | 'false';
  createdAt: string;
  updatedAt: string;
}

interface BusinessModeContextType {
  businessUnit: string | null;
  setBusinessUnit: (unit: string | null) => void;
  activeBusinessUnitId: string | null;
  setStore: (unit: string | null) => void;
}

const BusinessModeContext = createContext<BusinessModeContextType | undefined>(undefined);

export const useBusinessMode = () => {
  const context = useContext(BusinessModeContext);
  if (context === undefined) {
    throw new Error('useBusinessMode must be used within a BusinessModeProvider');
  }
  return context;
};

interface BusinessModeProviderProps {
  children: ReactNode;
}

export const BusinessModeProvider: React.FC<BusinessModeProviderProps> = ({ children }) => {
  const [businessUnit, setBusinessUnitState] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch business units from API
  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    },
    refetchInterval: false, // Only fetch once
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedUnit =
      localStorage.getItem('activeBusinessUnitId') ||
      localStorage.getItem('businessUnit');

    if (savedUnit) {
      setBusinessUnitState(savedUnit);
      localStorage.setItem('activeBusinessUnitId', savedUnit);
      localStorage.removeItem('businessUnit');
    }
  }, []);

  // Auto-select first store when business units are loaded
  useEffect(() => {
    if (businessUnits.length > 0 && !businessUnit) {
      // Prefer active stores, fallback to first store
      const firstActiveStore = businessUnits.find(unit => unit.isActive === 'true') || businessUnits[0];
      setBusinessUnitState(firstActiveStore.id);
      localStorage.setItem('activeBusinessUnitId', firstActiveStore.id);
    }
  }, [businessUnits, businessUnit]);

  // Sync store mode to global UI theme
  useEffect(() => {
    const active = businessUnits.find((u) => u.id === businessUnit) || null;
    const rawType = active?.type;
    const normalizedType = typeof rawType === 'string' ? rawType.toLowerCase() : '';
    const storeMode = normalizedType === 'restaurant' ? 'restaurant' : normalizedType === 'grocery' ? 'grocery' : '';

    if (storeMode) {
      document.documentElement.dataset.storeMode = storeMode;
    } else {
      delete (document.documentElement as any).dataset.storeMode;
    }
  }, [businessUnits, businessUnit]);

  const setBusinessUnit = (newValue: string | null) => {
    if (businessUnit === newValue) return;
    setBusinessUnitState(newValue);
    if (newValue) {
      localStorage.setItem('activeBusinessUnitId', newValue);
    } else {
      localStorage.removeItem('activeBusinessUnitId');
    }

    queryClient.clear();
  };

  const value = {
    businessUnit,
    setBusinessUnit,
    activeBusinessUnitId: businessUnit,
    setStore: setBusinessUnit,
  };

  return (
    <BusinessModeContext.Provider value={value}>
      {children}
    </BusinessModeContext.Provider>
  );
};
