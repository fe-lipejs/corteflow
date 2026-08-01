import { useRealtime } from '../../contexts/RealtimeContext';
import { useTheme } from '../../contexts/ThemeContext';
import { WifiOff, Loader2 } from 'lucide-react';

export function ConnectionStatus() {
  const { isConnected, status } = useRealtime();
  const { theme } = useTheme();

  if (isConnected) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-md"
      style={{ 
        background: theme.bgHover, 
        border: `1px solid ${theme.border}`,
        color: theme.textPrimary 
      }}
    >
      {status === 'CONNECTING' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-500" />
      )}
      <span className="text-xs font-medium">
        {status === 'CONNECTING' ? 'Conectando...' : 'Reconectando...'}
      </span>
    </div>
  );
}
