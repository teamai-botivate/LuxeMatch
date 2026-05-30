import { getSupabaseServer } from './client';

export type BranchRow = {
  id: string;
  jeweller_id: string;
  name: string;
  city: string;
  address: string;
  pin_code: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  created_at: string;
};

export async function getBranches(jewellerId: string): Promise<BranchRow[]> {
  const sb = getSupabaseServer();
  const { data } = await sb
    .from('branches')
    .select('*')
    .eq('jeweller_id', jewellerId)
    .eq('is_active', true)
    .order('city');
  return (data as BranchRow[] | null) ?? [];
}

export async function getBranchById(jewellerId: string, branchId: string): Promise<BranchRow | null> {
  const sb = getSupabaseServer();
  const { data } = await sb
    .from('branches')
    .select('*')
    .eq('jeweller_id', jewellerId)
    .eq('id', branchId)
    .maybeSingle();
  return data as BranchRow | null;
}
