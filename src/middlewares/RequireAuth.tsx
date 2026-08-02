import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1714] text-white">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 bg-[#C9963B] rounded-full"></div>
          <div className="w-2 h-2 bg-[#C9963B] rounded-full animation-delay-200"></div>
          <div className="w-2 h-2 bg-[#C9963B] rounded-full animation-delay-400"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
