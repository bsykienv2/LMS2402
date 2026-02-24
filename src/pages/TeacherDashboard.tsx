import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Class, User, ApiKeyConfig } from '../types';
import { Role } from '../types';
import {
  getClassesByTeacher,
  createClass,
  deleteClass,
  getAllUsers,
  approveUser,
  rejectUser,
  updateUserRole
} from '../services/firebase';
import {
  createAssignment,
  getAssignments,
  deleteAssignment as deleteAssignmentApi,
  getSubmissions,
  gradeSubmission as gradeSubmissionApi,
  gradeAllSubmissions,
  getApiKeys,
  addApiKey,
  removeApiKey,
  toggleApiKey,
  fileToBase64,
  isAppsScriptConfigured,
  getAppsScriptUrl,
  saveAppsScriptUrl,
  type Assignment,
  type Submission
} from '../services/appsScript';
import {
  BookOpen,
  Users,
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  LogOut,
  Key,
  UserCheck,
  UserX,
  Crown,
  Eye,
  EyeOff,
  X,
  Upload,
  Image,
  FileUp,
  Sparkles,
  ClipboardList,
  Download,
  AlertTriangle,
  Settings,
  Save,
  Globe
} from 'lucide-react';

type Tab = 'classes' | 'assignments' | 'users' | 'apikeys';

const TeacherDashboard = () => {
  const { user, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('classes');
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);

  const [showClassModal, setShowClassModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    title: '', description: '', problemText: '', classId: '', dueDate: ''
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [solutionImages, setSolutionImages] = useState<string[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKeyValue, setNewApiKeyValue] = useState('');
  const [showApiKeyValues, setShowApiKeyValues] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  
  const [configUrl, setConfigUrl] = useState(getAppsScriptUrl());
  const [savingConfig, setSavingConfig] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const solutionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classesData = await getClassesByTeacher(user.id);
      setClasses(classesData);

      if (isAdmin) {
        const usersData = await getAllUsers();
        setUsers(usersData);
      }

      if (isAppsScriptConfigured()) {
        const assignResult = await getAssignments();
        if (assignResult.success && assignResult.assignments) {
          const assignmentsWithClass = assignResult.assignments
            .filter((a: Assignment) => classesData.some(c => c.id === a.classId))
            .map((a: Assignment) => ({
              ...a,
              className: classesData.find(c => c.id === a.classId)?.name
            }));
          setAssignments(assignmentsWithClass);
        }

        const keysResult = await getApiKeys();
        if (keysResult.success && keysResult.keys) {
          setApiKeys(keysResult.keys);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const result = await getSubmissions(assignment.id);
      if (result.success && result.submissions) {
        setSubmissions(result.submissions);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('File quá lớn. Tối đa 50MB.');
        return;
      }
      setAttachmentFile(file);
    }
  };

  const handleSolutionImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const maxImages = 5;
    const filesToProcess = Math.min(files.length, maxImages - solutionImages.length);
    for (let i = 0; i < filesToProcess; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        alert('Ảnh quá lớn. Tối đa 10MB mỗi ảnh.');
        continue;
      }
      const base64 = await fileToBase64(file);
      setSolutionImages(prev => [...prev, base64]);
    }
  };

  const removeSolutionImage = (index: number) => {
    setSolutionImages(solutionImages.filter((_, i) => i !== index));
  };

  const handleCreateClass = async () => {
    if (!user || !newClassName.trim()) return;
    try {
      const newClass = await createClass({
        name: newClassName.trim(),
        description: newClassDesc.trim(),
        teacherId: user.id,
        teacherName: user.name
      });
      setClasses([newClass, ...classes]);
      setNewClassName('');
      setNewClassDesc('');
      setShowClassModal(false);
    } catch (error) {
      console.error('Error creating class:', error);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Xóa lớp học này?')) return;
    try {
      await deleteClass(classId);
      setClasses(classes.filter(c => c.id !== classId));
    } catch (error) {
      console.error('Error deleting class:', error);
    }
  };

  const handleCreateAssignment = async () => {
    if (!user || !newAssignment.title.trim() || !newAssignment.classId) return;
    if (!isAppsScriptConfigured()) {
      alert('Vui lòng cấu hình Google Apps Script URL trước');
      setShowConfigModal(true);
      return;
    }

    setCreating(true);
    try {
      let attachmentBase64 = '';
      if (attachmentFile) {
        attachmentBase64 = await fileToBase64(attachmentFile);
      }

      const result = await createAssignment({
        classId: newAssignment.classId,
        title: newAssignment.title.trim(),
        description: newAssignment.description.trim(),
        problemText: newAssignment.problemText.trim(),
        teacherId: user.id,
        dueDate: newAssignment.dueDate || undefined,
        attachmentBase64: attachmentBase64 || undefined,
        attachmentFileName: attachmentFile?.name,
        solutionImages: solutionImages.length > 0 ? solutionImages : undefined
      });

      if (result.success) {
        await loadData();
        setNewAssignment({ title: '', description: '', problemText: '', classId: '', dueDate: '' });
        setAttachmentFile(null);
        setSolutionImages([]);
        setShowAssignmentModal(false);
      } else {
        alert('Lỗi tạo bài tập: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Lỗi: ' + String(error));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Xóa bài tập này?')) return;
    try {
      const result = await deleteAssignmentApi(assignmentId);
      if (result.success) {
        setAssignments(assignments.filter(a => a.id !== assignmentId));
        if (selectedAssignment?.id === assignmentId) {
          setSelectedAssignment(null);
          setSubmissions([]);
        }
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const handleGradeSubmission = async (submission: Submission) => {
    setGradingId(submission.id);
    try {
      const result = await gradeSubmissionApi(submission.id);
      if (result.success) {
        if (selectedAssignment) await loadSubmissions(selectedAssignment);
        alert(`Đã chấm xong: ${result.score}/10 điểm`);
      } else {
        alert('Lỗi chấm bài: ' + result.error);
      }
    } catch (error) {
      console.error('Grading error:', error);
      alert('Lỗi: ' + String(error));
    } finally {
      setGradingId(null);
    }
  };

  const handleGradeAll = async () => {
    if (!selectedAssignment) return;
    const ungraded = submissions.filter(s => !s.isGraded);
    if (ungraded.length === 0) {
      alert('Không có bài nào cần chấm');
      return;
    }
    if (!confirm(`Chấm tự động ${ungraded.length} bài? Quá trình này có thể mất vài phút.`)) return;

    setGradingId('all');
    try {
      const result = await gradeAllSubmissions(selectedAssignment.id);
      if (result.success) {
        await loadSubmissions(selectedAssignment);
        alert(`Đã chấm ${result.gradedCount} bài, ${result.errorCount || 0} lỗi`);
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      alert('Lỗi: ' + String(error));
    } finally {
      setGradingId(null);
    }
  };

  const handleAddApiKey = async () => {
    if (!newApiKeyName.trim() || !newApiKeyValue.trim()) return;
    try {
      const result = await addApiKey(newApiKeyName.trim(), newApiKeyValue.trim());
      if (result.success) {
        await loadData();
        setNewApiKeyName('');
        setNewApiKeyValue('');
        setShowApiKeyModal(false);
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding API key:', error);
    }
  };

  const handleRemoveApiKey = async (keyId: string) => {
    if (!confirm('Xóa API key này?')) return;
    try {
      await removeApiKey(keyId);
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
    } catch (error) {
      console.error('Error removing API key:', error);
    }
  };

  const handleToggleApiKey = async (keyId: string) => {
    try {
      const result = await toggleApiKey(keyId);
      if (result.success) {
        setApiKeys(apiKeys.map(k => k.id === keyId ? { ...k, isActive: result.isActive ?? k.isActive } : k));
      }
    } catch (error) {
      console.error('Error toggling API key:', error);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await approveUser(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, isApproved: true } : u));
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm('Từ chối và xóa người dùng này?')) return;
    try {
      await rejectUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      setUsers(users.map(u => u.id === userId ? { ...u, role: role as typeof u.role } : u));
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!configUrl.trim()) return;
    setSavingConfig(true);
    try {
      const success = await saveAppsScriptUrl(configUrl.trim());
      if (success) {
        setShowConfigModal(false);
        await loadData();
        alert('Đã lưu cấu hình thành công! Tất cả học sinh sẽ tự động sử dụng URL này.');
      } else {
        alert('Lỗi lưu cấu hình');
      }
    } catch (error) {
      alert('Lỗi: ' + String(error));
    } finally {
      setSavingConfig(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const tabs = [
    { id: 'classes' as Tab, label: 'Lớp học', icon: Users, count: classes.length },
    { id: 'assignments' as Tab, label: 'Bài tập', icon: FileText, count: assignments.length },
    ...(isAdmin ? [{ id: 'users' as Tab, label: 'Người dùng', icon: UserCheck, count: users.filter(u => !u.isApproved).length }] : []),
    { id: 'apikeys' as Tab, label: 'API Keys', icon: Key, count: apiKeys.length }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAppsScriptConfigured() && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Chưa cấu hình Google Apps Script - Học sinh chưa thể nộp bài!</span>
            </div>
            <button onClick={() => setShowConfigModal(true)} className="px-3 py-1 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
              Cấu hình ngay
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Classroom Manager</h1>
                <p className="text-sm text-gray-500">Xin chào, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAppsScriptConfigured() && (
                <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  <Globe className="w-3 h-3" />
                  Online
                </span>
              )}
              <button onClick={() => setShowConfigModal(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Cấu hình hệ thống">
                <Settings className="w-5 h-5" />
              </button>
              {user?.avatar && (
                <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full ring-2 ring-white shadow" />
              )}
              <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedAssignment(null); }}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-teal-600 border-teal-600 bg-teal-50/50'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    activeTab === tab.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Danh sách lớp học</h2>
              <button onClick={() => setShowClassModal(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 font-medium text-sm">
                <Plus className="w-4 h-4" />
                Tạo lớp mới
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có lớp học nào</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map(cls => (
                  <div key={cls.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                        {cls.description && <p className="text-sm text-gray-500 mt-1">{cls.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg font-mono text-sm font-semibold">{cls.code}</code>
                        <button onClick={() => copyCode(cls.code)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                          {copiedCode === cls.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">{cls.studentCount} học sinh</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && !selectedAssignment && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Danh sách bài tập</h2>
              <button onClick={() => setShowAssignmentModal(true)} disabled={classes.length === 0} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 font-medium text-sm disabled:opacity-50">
                <Plus className="w-4 h-4" />
                Tạo bài tập
              </button>
            </div>

            {!isAppsScriptConfigured() ? (
              <div className="bg-amber-50 rounded-2xl p-8 text-center border border-amber-200">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-amber-800 font-medium mb-2">Cần cấu hình Google Apps Script</p>
                <p className="text-amber-600 text-sm mb-4">Để học sinh có thể nộp bài từ bất kỳ đâu</p>
                <button onClick={() => setShowConfigModal(true)} className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700">
                  Cấu hình ngay
                </button>
              </div>
            ) : assignments.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có bài tập nào</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assignments.map(assignment => (
                  <div key={assignment.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadSubmissions(assignment)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                        <p className="text-sm text-teal-600">{assignment.className}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {assignment.attachmentUrl && (
                        <span className="flex items-center gap-1"><FileUp className="w-4 h-4" />Có file</span>
                      )}
                      {(assignment.solutionImagesCount || 0) > 0 && (
                        <span className="flex items-center gap-1"><Image className="w-4 h-4" />{assignment.solutionImagesCount} đáp án</span>
                      )}
                    </div>
                    {assignment.dueDate && (
                      <p className="text-xs text-gray-400 mt-2">Hạn: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assignment Detail */}
        {activeTab === 'assignments' && selectedAssignment && (
          <div>
            <button onClick={() => { setSelectedAssignment(null); setSubmissions([]); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
              ← Quay lại danh sách
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                <h2 className="text-xl font-semibold text-gray-900">{selectedAssignment.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedAssignment.className}</p>
              </div>
              <div className="p-5">
                {selectedAssignment.description && <p className="text-gray-700 mb-3">{selectedAssignment.description}</p>}
                {selectedAssignment.attachmentUrl && (
                  <a href={selectedAssignment.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm mb-3">
                    <Download className="w-4 h-4" />
                    {selectedAssignment.attachmentFileName || 'Tải file đề'}
                  </a>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{selectedAssignment.solutionImagesCount || 0} ảnh đáp án</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bài nộp ({submissions.length})</h3>
              {submissions.some(s => !s.isGraded) && (
                <button onClick={handleGradeAll} disabled={gradingId !== null} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50">
                  {gradingId === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Chấm tất cả ({submissions.filter(s => !s.isGraded).length})
                </button>
              )}
            </div>

            {loadingSubmissions ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
            ) : submissions.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có học sinh nộp bài</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => (
                  <div key={sub.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-teal-700 font-medium">{sub.studentName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sub.studentName}</p>
                          <p className="text-sm text-gray-500">{sub.imagesCount || 0} ảnh • {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sub.isGraded ? (
                          <div className="text-right">
                            <span className={`text-2xl font-bold ${Number(sub.score) >= 8 ? 'text-green-600' : Number(sub.score) >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {sub.score}/10
                            </span>
                            <p className="text-xs text-gray-500">Đã chấm</p>
                          </div>
                        ) : (
                          <button onClick={() => handleGradeSubmission(sub)} disabled={gradingId !== null} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm disabled:opacity-50">
                            {gradingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Chấm bài
                          </button>
                        )}
                      </div>
                    </div>
                    {sub.feedback && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {sub.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && isAdmin && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quản lý người dùng</h2>
            {users.filter(u => !u.isApproved).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-orange-600 mb-3">Chờ phê duyệt ({users.filter(u => !u.isApproved).length})</h3>
                <div className="space-y-2">
                  {users.filter(u => !u.isApproved).map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="flex items-center gap-3">
                        {u.avatar ? <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full" /> : (
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-orange-600 font-medium">{u.name.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApproveUser(u.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg" title="Phê duyệt">
                          <UserCheck className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleRejectUser(u.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg" title="Từ chối">
                          <UserX className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Người dùng đã duyệt ({users.filter(u => u.isApproved).length})</h3>
              <div className="space-y-2">
                {users.filter(u => u.isApproved).map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      {u.avatar ? <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full" /> : (
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-teal-600 font-medium">{u.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{u.name}</p>
                          {u.role === Role.ADMIN && <Crown className="w-4 h-4 text-amber-500" />}
                        </div>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <select value={u.role} onChange={(e) => handleUpdateRole(u.id, e.target.value)} disabled={u.id === user?.id} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50">
                      <option value={Role.STUDENT}>Học sinh</option>
                      <option value={Role.TEACHER}>Giáo viên</option>
                      <option value={Role.LEADER}>Trưởng nhóm</option>
                      <option value={Role.ADMIN}>Admin</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'apikeys' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quản lý API Keys</h2>
                <p className="text-sm text-gray-500">Thêm Gemini API key để sử dụng AI chấm bài</p>
              </div>
              <button onClick={() => setShowApiKeyModal(true)} disabled={!isAppsScriptConfigured()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium text-sm disabled:opacity-50">
                <Plus className="w-4 h-4" />
                Thêm API Key
              </button>
            </div>

            {!isAppsScriptConfigured() ? (
              <div className="bg-amber-50 rounded-2xl p-8 text-center border border-amber-200">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-amber-800 font-medium mb-2">Cần cấu hình Google Apps Script trước</p>
                <button onClick={() => setShowConfigModal(true)} className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700">
                  Cấu hình ngay
                </button>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">Chưa có API key nào</p>
                <p className="text-sm text-gray-400">Thêm Gemini API key từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Google AI Studio</a></p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(key => (
                  <div key={key.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${key.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <h3 className="font-medium text-gray-900">{key.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm text-gray-500 font-mono">{showApiKeyValues[key.id] ? key.key : '••••••••••••••••'}</code>
                            <button onClick={() => setShowApiKeyValues({ ...showApiKeyValues, [key.id]: !showApiKeyValues[key.id] })} className="p-1 text-gray-400 hover:text-gray-600">
                              {showApiKeyValues[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Sử dụng: {key.usageCount}</span>
                        <button onClick={() => handleToggleApiKey(key.id)} className={`px-3 py-1.5 text-sm rounded-lg font-medium ${key.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {key.isActive ? 'Đang bật' : 'Đã tắt'}
                        </button>
                        <button onClick={() => handleRemoveApiKey(key.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tạo lớp học mới</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp *</label>
                <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Ví dụ: Toán 12A1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} placeholder="Mô tả ngắn" rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowClassModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Hủy</button>
              <button onClick={handleCreateClass} disabled={!newClassName.trim()} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium disabled:opacity-50">Tạo lớp</button>
            </div>
          </div>
        </div>
      )}

      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tạo bài tập mới</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học *</label>
                <select value={newAssignment.classId} onChange={(e) => setNewAssignment({ ...newAssignment, classId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl">
                  <option value="">Chọn lớp học</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                <input type="text" value={newAssignment.title} onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} placeholder="Ví dụ: Bài tập về nhà tuần 1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={newAssignment.description} onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })} placeholder="Hướng dẫn làm bài" rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung đề bài</label>
                <textarea value={newAssignment.problemText} onChange={(e) => setNewAssignment({ ...newAssignment, problemText: e.target.value })} placeholder="Nội dung chi tiết (dùng để AI so sánh khi chấm)" rows={4} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File đề bài (PDF/Ảnh)</label>
                <input type="file" ref={fileInputRef} onChange={handleAttachmentSelect} accept=".pdf,image/*" className="hidden" />
                {attachmentFile ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileUp className="w-5 h-5 text-teal-600" />
                      <span className="text-sm text-gray-700">{attachmentFile.name}</span>
                    </div>
                    <button onClick={() => setAttachmentFile(null)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50/50 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click để chọn file</p>
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh đáp án (tối đa 5 ảnh) - BẮT BUỘC để chấm AI</label>
                <input type="file" ref={solutionInputRef} onChange={handleSolutionImagesSelect} accept="image/*" multiple className="hidden" />
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {solutionImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img src={`data:image/jpeg;base64,${img}`} alt={`Solution ${idx + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeSolutionImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {solutionImages.length < 5 && (
                    <button onClick={() => solutionInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-lg hover:border-teal-400 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-gray-400" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">Upload ảnh đáp án để AI có thể chấm bài tự động</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hạn nộp</label>
                <input type="datetime-local" value={newAssignment.dueDate} onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAssignmentModal(false); setAttachmentFile(null); setSolutionImages([]); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Hủy</button>
              <button onClick={handleCreateAssignment} disabled={!newAssignment.title.trim() || !newAssignment.classId || creating} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Tạo bài tập
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Thêm API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                <input type="text" value={newApiKeyName} onChange={(e) => setNewApiKeyName(e.target.value)} placeholder="Ví dụ: Gemini API 1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key *</label>
                <input type="text" value={newApiKeyValue} onChange={(e) => setNewApiKeyValue(e.target.value)} placeholder="AIza..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl font-mono" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowApiKeyModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Hủy</button>
              <button onClick={handleAddApiKey} disabled={!newApiKeyName.trim() || !newApiKeyValue.trim()} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium disabled:opacity-50">Thêm</button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cấu hình hệ thống</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
                <p className="font-medium mb-2">📋 Hướng dẫn setup Google Apps Script:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Tạo <strong>Google Sheet mới</strong></li>
                  <li>Vào <strong>Extensions → Apps Script</strong></li>
                  <li>Dán code từ file <code className="bg-blue-100 px-1 rounded">code.gs</code></li>
                  <li>Thay <code className="bg-blue-100 px-1 rounded">SHEET_ID</code> bằng ID Sheet của bạn</li>
                  <li>Chạy hàm <code className="bg-blue-100 px-1 rounded">testSetup()</code></li>
                  <li><strong>Deploy → New deployment → Web app</strong></li>
                  <li>Execute as: <strong>Me</strong>, Access: <strong>Anyone</strong></li>
                  <li>Copy URL và dán vào ô bên dưới</li>
                </ol>
              </div>
              
              <div className="p-3 bg-green-50 rounded-xl text-sm text-green-800">
                <p className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  URL sẽ được lưu vào Firebase - Tất cả học sinh sẽ tự động sử dụng!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apps Script Web App URL *</label>
                <input 
                  type="text" 
                  value={configUrl} 
                  onChange={(e) => setConfigUrl(e.target.value)} 
                  placeholder="https://script.google.com/macros/s/xxx/exec" 
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl font-mono text-sm" 
                />
              </div>
              
              {isAppsScriptConfigured() && (
                <div className="p-3 bg-green-50 rounded-xl flex items-center gap-2 text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">Đã cấu hình - Học sinh có thể nộp bài online!</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfigModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">Đóng</button>
              <button onClick={handleSaveConfig} disabled={!configUrl.trim() || savingConfig} className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
