import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  type: 'service' | 'product' | 'both';
  created_at: string;
}

export const CATEGORIES_QUERY_KEY = (tenantId: string) => ['categories', tenantId];

async function fetchCategories(tenantId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });
  
  if (error) throw error;
  return (data ?? []) as Category[];
}

export function useCategories(tenantId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CATEGORIES_QUERY_KEY(tenantId!),
    queryFn: () => fetchCategories(tenantId!),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; type: 'service' | 'product' | 'both' }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          tenant_id: tenantId!,
          name: input.name,
          type: input.type
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY(tenantId!) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, type }: { id: string; name: string; type: 'service' | 'product' | 'both' }) => {
      const { data, error } = await supabase
        .from('categories')
        .update({ name, type })
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single();
      
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY(tenantId!) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY(tenantId!) });
    }
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createCategory: createMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    deleteCategory: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

