import { useState } from 'react';
import { useCategories } from '../../../hooks/useCategories';
import { useTheme } from '../../../contexts/ThemeContext';
import { X, Plus, Trash2, Tag, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CategoriesManagerModal({ tenantId, isOpen, onClose }: Props) {
  const { theme } = useTheme();
  const { categories, createCategory, deleteCategory, isCreating } = useCategories(tenantId);
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'service' | 'product' | 'both'>('service');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newCatName.trim()) return;
    try {
      await createCategory({ name: newCatName.trim(), type: newCatType });
      setNewCatName('');
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Erro ao criar categoria.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Os serviços continuarão com o nome dela, mas ela sumirá desta lista.')) return;
    try {
      setDeletingId(id);
      await deleteCategory(id);
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Erro ao excluir categoria.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder, border: '1px solid' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.cardBorder }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner" style={{ background: theme.inputBg, color: theme.accent }}>
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-serif leading-tight" style={{ color: theme.textPrimary }}>Categorias</h2>
                <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>Gerencie opções para Serviços e Produtos</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full transition-colors opacity-70 hover:opacity-100" style={{ background: theme.inputBg, color: theme.textPrimary }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 border-b space-y-4" style={{ borderColor: theme.cardBorder }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-2">
                <input
                  type="text"
                  placeholder="Nome da Categoria..."
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none"
                  style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <select
                  value={newCatType}
                  onChange={e => setNewCatType(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl border text-sm transition-colors focus:outline-none cursor-pointer"
                  style={{ background: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }}
                >
                  <option value="service">Serviços</option>
                  <option value="product">Produtos</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newCatName.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: theme.accentGradient, color: theme.btnPrimaryText }}
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar Categoria
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto p-4 flex-1">
            {categories.length === 0 ? (
              <div className="py-10 text-center opacity-50 text-sm" style={{ color: theme.textPrimary }}>
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: theme.cardBorder, background: theme.inputBg }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: theme.textPrimary }}>{cat.name}</p>
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-60 mt-0.5" style={{ color: theme.textSecondary }}>
                        {cat.type === 'service' ? 'SERVIÇO' : cat.type === 'product' ? 'PRODUTO' : 'SERVIÇO E PRODUTO'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10 text-red-500 disabled:opacity-50"
                    >
                      {deletingId === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
