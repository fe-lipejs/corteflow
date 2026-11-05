import { ExpensesHubTab } from './ExpensesHubTab';

interface Props {
  tenantId: string;
  currentMonth?: Date;
}

export function RecurringExpensesTab({ tenantId, currentMonth = new Date() }: Props) {
  return (
    <ExpensesHubTab
      tenantId={tenantId}
      currentMonth={currentMonth}
      initialSubTab="fixos"
    />
  );
}
