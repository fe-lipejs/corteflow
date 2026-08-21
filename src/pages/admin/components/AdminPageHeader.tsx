import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  icon?: ReactNode;
}

export default function AdminPageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  icon,
}: AdminPageHeaderProps) {
  const location = useLocation();

  // Auto-generate breadcrumbs from path if not provided
  const autoCrumbs: Breadcrumb[] = breadcrumbs ?? (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, idx) => ({
      label: part === 'admin' ? 'Admin' : part.charAt(0).toUpperCase() + part.slice(1),
      to: '/' + parts.slice(0, idx + 1).join('/'),
    }));
  })();

  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      {autoCrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-[#555] mb-4">
          {autoCrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-[#333]" />}
              {crumb.to && i < autoCrumbs.length - 1 ? (
                <Link to={crumb.to} className="hover:text-[#888] transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#777]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center text-[#888]">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-[#555] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

