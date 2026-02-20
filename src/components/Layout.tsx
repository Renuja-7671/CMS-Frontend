import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, FileText, CheckSquare } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'add-card', label: 'Add Card', icon: CreditCard, path: '/add-card' },
    { id: 'card-request', label: 'Card Request', icon: FileText, path: '/card-request' },
    { id: 'request-confirmation', label: 'Request Confirmation', icon: CheckSquare, path: '/request-confirmation' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Navigation Tabs Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-all relative
                    ${
                      isActive(tab.path)
                        ? 'text-blue-900 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {isActive(tab.path) && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-900 rounded-t" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
