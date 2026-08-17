import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, FileText, User, CreditCard, Loader2 } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Modal } from '../../../components/ui/Modal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../integrations/supabase/client';

export interface FinancialTransaction {
  id?: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  payment_method: string;
  professional_id?: string | null;
  date?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: FinancialTransaction) => Promise<void>;
  transaction?: FinancialTransaction | null;
  tenantId: string;
  isLoading?: boolean;
}

const INCOME_CATEGORIES = [
  'Serviço Avulso',
  'Venda de Produto',
  'Comissão Extra',
  'Gorjeta',
  'Outras Receitas'
];

const EXPENSE_CATEGORIES = [
  'Aluguel / Condomínio',
  'Água, Luz e Internet',
  'Produtos e Insumos',
  'Pagamento de Equipe',
  'Equipamentos e Manutenção',
  'Marketing e Anúncios',
  'Impostos e Taxas',
  'Outras Despesas'
];

const PAYMENT_METHODS = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência Bancária',
  'Outro'
];

export function ManualTransactionModal({
  isOpen,
  onClose,
  onSave,
  transaction,
  tenantId,
  isLoading
}: Props) {
  const { theme } = useTheme();
  const isEditing = !!transaction?.id;

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Serviço Avulso');
  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  // Fetch professionals for linking
  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals_select', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!tenantId
  });

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      setCategory(transaction.category || (transaction.type === 'income' ? 'Serviço Avulso' : 'Aluguel / Condomínio'));
      setPaymentMethod(transaction.payment_method || 'Dinheiro');
      setProfessionalId(transaction.professional_id || '');
      if (transaction.date) {
        setDate(transaction.date.split('T')[0]);
      }
    } else {
      setType('income');
      setAmount('');
      setDescription('');
      setCategory('Serviço Avulso');
      setPaymentMethod('Dinheiro');
      setProfessionalId('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setError(null);
  }, [transaction, isOpen]);

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory(newType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanVal = amount.trim();
    if (cleanVal.includes(',') && cleanVal.includes('.')) {
      cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
    } else if (cleanVal.includes(',')) {
      cleanVal = cleanVal.replace(',', '.');
    }
    const parsedAmount = parseFloat(cleanVal);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }
    if (!description.trim()) {
      setError('Informe uma descrição para o lançamento.');
      return;
    }

    try {
      setError(null);
      await onSave({
        id: transaction?.id,
        type,
        amount: parsedAmount,
        description: description.trim(),
        category,
        payment_method: paymentMethod,
        professional_id: professionalId || null,
        date: new Date(date + 'T12:00:00Z').toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar lançamento financeiro.');
    }
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
      subtitle={isEditing ? 'Altere os dados da transação manual' : 'Registre uma receita ou despesa manual no caixa'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Selector (Receita / Despesa) */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: theme.inputBg }}>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
              type === 'income' ? 'shadow-md text-white' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              background: type === 'income' ? '#10b981' : 'transparent',
              color: type === 'income' ? '#fff' : theme.textSecondary
            }}
          >
            + Receita (Entrada)
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
              type === 'expense' ? 'shadow-md text-white' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              background: type === 'expense' ? '#ef4444' : 'transparent',
              color: type === 'expense' ? '#fff' : theme.textSecondary
            }}
          >
            - Despesa (Saída)
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs font-semibold" style={{ background: `${theme.error}15`, color: theme.error, border: `1px solid ${theme.error}30` }}>
            {error}
          </div>
        )}

        {/* Valor e Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Valor (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none" style={{ color: type === 'income' ? '#10b981' : '#ef4444' }}>
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.,]/g, '');
                  setAmount(val);
                }}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-none themed-input"
                style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none themed-input"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
              required
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
            Descrição / Motivo *
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Compra de pomadas para revenda, Conta de Luz..."
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none themed-input"
            style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            required
          />
        </div>

        {/* Categoria e Forma de Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Categoria
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none themed-input cursor-pointer"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none themed-input cursor-pointer"
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Profissional Vinculado (Opcional) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.textSecondary }}>
            Profissional Vinculado (Opcional)
          </label>
          <select
            value={professionalId}
            onChange={e => setProfessionalId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none themed-input cursor-pointer"
            style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}
          >
            <option value="">Geral (Salão todo)</option>
            {professionals.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-3 border-t" style={{ borderColor: theme.border }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all hover:bg-[var(--theme-bg-hover)]"
            style={{ borderColor: theme.border, color: theme.textSecondary }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: type === 'income' ? '#10b981' : '#ef4444',
              color: '#fff'
            }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? 'Salvar Alterações' : 'Confirmar Lançamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
