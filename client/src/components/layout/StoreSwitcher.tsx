import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { Store, Utensils, Pill, Shirt, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';

const StoreSwitcher = () => {
  const { businessUnit, setBusinessUnit } = useBusinessMode();

  const { data: businessUnits = [] } = useQuery<any[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch business units');
      return res.json();
    },
  });

  const getConfig = (type: string) => {
    const normalized = typeof type === 'string' ? type.toLowerCase() : '';
    switch (normalized) {
      case 'grocery':
        return { icon: Store, color: 'bg-green-500' };
      case 'restaurant':
        return { icon: Utensils, color: 'bg-orange-500' };
      case 'pharmacy':
        return { icon: Pill, color: 'bg-blue-500' };
      case 'electronics':
        return { icon: Zap, color: 'bg-purple-500' };
      case 'clothing':
        return { icon: Shirt, color: 'bg-pink-500' };
      default:
        return { icon: Store, color: 'bg-slate-500' };
    }
  };

  const currentStore = businessUnits.find((u) => u.id === businessUnit) || businessUnits[0];
  const config = currentStore ? getConfig(currentStore.type) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2 flex-1">
          {currentStore && config && (
            <>
              <div className={`p-1.5 rounded-md ${config.color} bg-opacity-10`}>
                <config.icon className={`w-4 h-4 ${config.color.replace('bg-', 'text-')}`} />
              </div>
              <div className="flex-1">
                <Select value={businessUnit || ''} onValueChange={setBusinessUnit}>
                  <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="Select store type" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((unit) => {
                      const cfg = getConfig(unit.type);
                      const Icon = cfg.icon;
                      return (
                        <SelectItem key={unit.id} value={unit.id}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${cfg.color.replace('bg-', 'text-')}`} />
                            <span>{unit.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <Badge
          variant="secondary"
          className="text-xs px-2 py-0.5"
        >
          {businessUnit}
        </Badge>
      </div>
    </div>
  );
};

export default StoreSwitcher;
