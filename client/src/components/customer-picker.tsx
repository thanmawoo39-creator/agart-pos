import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { apiRequest } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";

interface CustomerPickerProps {
  onSelectCustomer: (customer: Customer) => void;
}

export function CustomerPicker({ onSelectCustomer }: CustomerPickerProps) {
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/customers");
      const data = await response.json();
      if (!Array.isArray(data)) {
        return [];
      }
      return data as Customer[];
    },
  });

  const customerOptions = React.useMemo(() => {
    return Array.isArray(customers)
      ? customers.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.phone || "No phone"})`,
        }))
      : [];
  }, [customers]);

  const handleSelect = (customerId: string) => {
    if (!Array.isArray(customers)) {
      return;
    }
    const customer = customers.find((c: Customer) => c.id === customerId);
    if (customer) {
      onSelectCustomer(customer);
    }
  };

  return (
    <Combobox
      options={customerOptions}
      onChange={handleSelect}
      placeholder="Search customer..."
      searchPlaceholder="Search by name or phone..."
      emptyMessage={isLoading ? "Loading..." : "No customer found."}
    />
  );
}
