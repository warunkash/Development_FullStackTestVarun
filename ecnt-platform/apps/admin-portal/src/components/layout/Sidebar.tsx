import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Zap,
  Activity,
  Users,
  CreditCard,
  BarChart2,
  Truck,
  Building2,
  Wrench,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  open: boolean;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stations', icon: MapPin, label: 'Stations' },
  { to: '/chargers', icon: Zap, label: 'Chargers' },
  { to: '/sessions', icon: Activity, label: 'Sessions' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/fleet', icon: Truck, label: 'Fleet' },
  { to: '/franchise', icon: Building2, label: 'Franchise' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ open }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'flex flex-col bg-ecnt-dark text-white transition-all duration-300 ease-in-out flex-shrink-0',
        open ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <div className="w-8 h-8 bg-ecnt-green rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {open && (
          <div className="ml-3 overflow-hidden">
            <p className="font-bold text-sm leading-tight">ECNT</p>
            <p className="text-xs text-gray-400 leading-tight">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative',
                    isActive
                      ? 'bg-ecnt-green text-white shadow-lg'
                      : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  )}
                  title={!open ? label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {open && (
                    <span className="text-sm font-medium truncate">{label}</span>
                  )}
                  {!open && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      {label}
                    </div>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        {open && (
          <p className="text-xs text-gray-500 text-center">v1.0.0 &bull; ECNT Platform</p>
        )}
      </div>
    </aside>
  );
}
