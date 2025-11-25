import {
  Home,
  ShoppingCart,
  DollarSign,
  Package,
  BarChart3,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authStorage, useShop } from '@/contexts/ShopContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BalaLogo } from '@/components/Brand/BalaLogo';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Purchase Products', href: '/purchase', icon: ShoppingCart },
  { name: 'Sale Products', href: '/sale', icon: DollarSign },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useShop();

  const handleLogout = () => {
    authStorage.clear();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Mobile close button */}
      <div className="lg:hidden flex justify-end p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Logo and Shop Name */}
      <div className="flex h-24 items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {state.settings.shopLogo ? (
            <img
              src={state.settings.shopLogo}
              alt="Shop Logo"
              className="h-14 w-14 object-cover rounded"
            />
          ) : (
            <BalaLogo className="h-14 w-14" />
          )}
          <span className="text-lg font-semibold text-sidebar-foreground leading-tight">
            {state.settings.shopName}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info and Logout */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {state.settings.userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {state.settings.userName}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}