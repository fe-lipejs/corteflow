import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  promo_price: number | null;
  code: string | null;
  stock: number;
  min_stock: number;
  brand: string | null;
  photo_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type ProductInput = Omit<Product, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> & {
  photoFile?: File;
};

const BUCKET = 'product-photos';

async function uploadProductPhoto(file: File, tenantId: string, productId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${tenantId}/${productId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function deleteProductPhoto(photoUrl: string) {
  try {
    const match = photoUrl.match(/product-photos\/(.+?)(\?|$)/);
    if (match?.[1]) await supabase.storage.from(BUCKET).remove([match[1]]);
  } catch { /* non-critical */ }
}

export const PRODUCTS_QUERY_KEY = (tenantId: string) => ['products', tenantId];

async function fetchProducts(tenantId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export function useProducts(tenantId: string | null) {
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY(tenantId ?? ''),
    queryFn: () => fetchProducts(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateProduct(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductInput) => {
      const { photoFile, ...fields } = input;
      const { data: product, error } = await supabase
        .from('products')
        .insert({ ...fields, tenant_id: tenantId } as any)
        .select('*').single();
      if (error) throw error;
      if (photoFile) {
        const url = await uploadProductPhoto(photoFile, tenantId, product.id);
        await supabase.from('products').update({ photo_url: url } as any).eq('id', product.id);
      }
      return product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY(tenantId) }),
  });
}

export function useUpdateProduct(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photoFile, ...fields }: Partial<ProductInput> & { id: string }) => {
      let photoUrl: string | undefined;
      if (photoFile) photoUrl = await uploadProductPhoto(photoFile, tenantId, id);
      const payload = photoUrl ? { ...fields, photo_url: photoUrl } : fields;
      const { error } = await supabase.from('products').update(payload as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY(tenantId) }),
  });
}

export function useDeleteProduct(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photoUrl }: { id: string; photoUrl: string | null }) => {
      if (photoUrl) await deleteProductPhoto(photoUrl);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY(tenantId) }),
  });
}
