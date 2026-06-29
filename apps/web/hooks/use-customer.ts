'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type CustomerSession = {
  customerId: string;
  phone: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
};

type MeResponse = {
  data: CustomerSession | null;
};

export const CUSTOMER_QUERY_KEY = ['customer', 'me'] as const;

async function fetchCustomer() {
  const res = await fetch('/api/customer/me', { cache: 'no-store' });
  const json = (await res.json()) as MeResponse;
  return json.data;
}

export function useCustomer() {
  const queryClient = useQueryClient();
  const { data: customer = null, isLoading, refetch } = useQuery({
    queryKey: CUSTOMER_QUERY_KEY,
    queryFn: fetchCustomer,
    retry: false,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    await fetch('/api/customer/logout', { method: 'POST' });
    queryClient.setQueryData(CUSTOMER_QUERY_KEY, null);
  }, [queryClient]);

  return { customer, loading: isLoading, refresh, logout };
}
