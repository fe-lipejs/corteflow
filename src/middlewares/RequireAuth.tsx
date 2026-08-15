import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#DE870D] rounded-full animate-bounce"></div>
          <div className="w-2.5 h-2.5 bg-[#DE870D] rounded-full animate-bounce [animation-delay:0.2s]"></div>
          <div className="w-2.5 h-2.5 bg-[#DE870D] rounded-full animate-bounce [animation-delay:0.4s]"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
