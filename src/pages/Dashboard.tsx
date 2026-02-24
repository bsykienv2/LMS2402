import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import PendingApprovalPage from './PendingApprovalPage';
import { Users, GraduationCap, Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user, loading, isApproved, isTeacher } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // User not approved yet
  if (!isApproved && user?.role !== Role.ADMIN) {
    return <PendingApprovalPage />;
  }

  // If user is a teacher, let them choose between teacher/student view
  if (!selectedRole && isTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Chọn chế độ</h1>
            <p className="text-gray-500 mt-2">Bạn muốn sử dụng với vai trò nào?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedRole('teacher')}
              className="p-6 rounded-2xl border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-all group"
            >
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-200 transition-colors">
                <Users className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Giáo viên</h3>
              <p className="text-sm text-gray-500 mt-1">Quản lý lớp học, giao bài tập</p>
            </button>

            <button
              onClick={() => setSelectedRole('student')}
              className="p-6 rounded-2xl border-2 border-gray-200 hover:border-cyan-500 hover:bg-cyan-50 transition-all group"
            >
              <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-200 transition-colors">
                <GraduationCap className="w-8 h-8 text-cyan-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Học sinh</h3>
              <p className="text-sm text-gray-500 mt-1">Tham gia lớp, nộp bài tập</p>
            </button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">
            Bạn có thể chuyển đổi vai trò bất cứ lúc nào
          </p>
        </div>
      </div>
    );
  }

  // Show appropriate dashboard
  if (selectedRole === 'teacher' || (isTeacher && !selectedRole)) {
    return (
      <div>
        {selectedRole && (
          <button
            onClick={() => setSelectedRole(null)}
            className="fixed bottom-4 right-4 z-50 px-4 py-2.5 bg-white shadow-lg rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200"
          >
            <GraduationCap className="w-4 h-4" />
            Chuyển sang Học sinh
          </button>
        )}
        <TeacherDashboard />
      </div>
    );
  }

  return (
    <div>
      {selectedRole && isTeacher && (
        <button
          onClick={() => setSelectedRole(null)}
          className="fixed bottom-4 right-4 z-50 px-4 py-2.5 bg-white shadow-lg rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200"
        >
          <Users className="w-4 h-4" />
          Chuyển sang Giáo viên
        </button>
      )}
      <StudentDashboard />
    </div>
  );
};

export default Dashboard;
