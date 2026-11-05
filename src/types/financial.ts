export type RecurringFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

export type RecurringRuleStatus = 'active' | 'paused' | 'ended';

export type ExpenseType = 'fixed' | 'variable';

export type PayableDbStatus = 'pending' | 'scheduled' | 'partial' | 'paid' | 'canceled';

export type PayableDisplayStatus =
  | 'paid'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'scheduled'
  | 'partial'
  | 'pending';

export interface RecurringExpenseRule {
  id: string;
  tenant_id: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string | null;
  frequency: RecurringFrequency;
  due_day: number | null;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  active: boolean;
  status: RecurringRuleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpensePaymentRecord {
  id: string;
  tenant_id: string;
  payable_id: string;
  financial_transaction_id: string | null;
  amount: number;
  paid_at: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface ExpensePayable {
  id: string;
  tenant_id: string;
  expense_type: ExpenseType;
  recurring_expense_id: string | null;
  competence_date: string | null;
  description: string;
  category: string;
  expected_amount: number;
  paid_amount: number;
  purchase_date: string | null;
  due_date: string;
  status: PayableDbStatus;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  professional_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  expense_payments?: ExpensePaymentRecord[];
}

export interface RecurringRuleInput {
  id?: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  frequency: RecurringFrequency;
  due_day: number | null;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
}

export interface VariableExpenseInput {
  id?: string;
  description: string;
  category: string;
  amount: number;
  purchase_date: string;
  due_date: string;
  payment_method: string;
  initial_status: 'paid' | 'pending' | 'scheduled';
  paid_at?: string;
  professional_id?: string | null;
  notes?: string | null;
}

export interface PayObligationInput {
  payableId: string;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  notes?: string;
  settleFull: boolean;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyComparisonPoint {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
}

export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; shortLabel: string }[] = [
  { value: 'weekly', label: 'Semanal', shortLabel: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal (a cada 14 dias)', shortLabel: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal', shortLabel: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral (a cada 3 meses)', shortLabel: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral (a cada 6 meses)', shortLabel: 'Semestral' },
  { value: 'yearly', label: 'Anual', shortLabel: 'Anual' },
];

export const FIXED_EXPENSE_CATEGORIES: string[] = [
  'Aluguel / Condomínio',
  'Energia Elétrica',
  'Água e Saneamento',
  'Internet e Telefone',
  'Sistemas e Assinaturas',
  'Contabilidade / MEI / Impostos',
  'Limpeza e Conservação',
  'Segurança / Seguros',
  'Marketing Fixo',
  'Outras Despesas Fixas',
];

export const VARIABLE_EXPENSE_CATEGORIES: string[] = [
  'Produtos e Insumos',
  'Esmaltes e Manicure',
  'Cabelo e Cosméticos',
  'Descartáveis (Luvas, Algodão, Papel)',
  'Produtos de Limpeza',
  'Manutenção e Reparos',
  'Equipamentos e Utensílios',
  'Marketing e Anúncios',
  'Taxas e Tarifas',
  'Alimentação / Café para Clientes',
  'Outras Despesas Variáveis',
];

export const INCOME_CATEGORIES: string[] = [
  'Serviço Avulso',
  'Venda de Produto',
  'Pacote / Plano',
  'Gorjeta',
  'Outras Receitas',
];

export const PAYMENT_METHODS: string[] = [
  'PIX',
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Transferência Bancária',
  'Débito Automático',
  'Outro',
];

