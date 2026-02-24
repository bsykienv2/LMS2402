import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import Dashboard from './pages/Dashboard';
import { loadAppsScriptUrl } from './services/appsScript';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, loading: authLoading } = useAuth();
  const [configLoading, setConfigLoading] = useState(true);

  // Load Apps Script URL từ Firestore khi app khởi động
  useEffect(() => {
    const loadConfig = async () => {
      if (user) {
        await loadAppsScriptUrl();
      }
      setConfigLoading(false);
    };
    
    if (!authLoading) {
      loadConfig();
    }
  }, [user, authLoading]);

  if (authLoading || (user && configLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!user.isApproved) {
    return <PendingApprovalPage />;
  }

  return <Dashboard />;
}

export default App;
