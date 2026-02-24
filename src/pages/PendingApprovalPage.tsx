import { useAuth } from '../contexts/AuthContext';
import { Clock, LogOut, Mail } from 'lucide-react';

const PendingApprovalPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Chờ phê duyệt</h1>
        <p className="text-gray-600 mb-6">
          Tài khoản của bạn đang chờ được Admin phê duyệt. Vui lòng đợi trong giây lát.
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <span className="text-teal-600 font-bold text-lg">{user?.name.charAt(0)}</span>
              </div>
            )}
            <div className="text-left">
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Bạn sẽ có thể sử dụng hệ thống ngay khi được phê duyệt.
          </p>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
