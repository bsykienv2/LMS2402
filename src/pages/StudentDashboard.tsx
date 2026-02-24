import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Class } from '../types';
import {
  getClassesForStudent,
  getClassByCode,
  joinClass
} from '../services/firebase';
import {
  getAssignments,
  submitAssignment,
  getStudentSubmission,
  fileToBase64,
  isAppsScriptConfigured,
  type Assignment,
  type Submission
} from '../services/appsScript';
import {
  BookOpen,
  LogOut,
  Loader2,
  Send,
  CheckCircle,
  Clock,
  ArrowLeft,
  Download,
  Plus,
  X,
  FileText,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionImages, setSubmissionImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClasses();
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const classesData = await getClassesForStudent(user.id, user.email);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async (cls: Class) => {
    setSelectedClass(cls);
    setSelectedAssignment(null);
    setSubmission(null);
    setLoadingAssignments(true);
    try {
      if (isAppsScriptConfigured()) {
        const result = await getAssignments(cls.id);
        if (result.success && result.assignments) {
          setAssignments(result.assignments);
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadAssignmentDetail = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setLoadingSubmission(true);
    try {
      const result = await getStudentSubmission(assignment.id, user!.id);
      if (result.success) {
        setSubmission(result.submission ?? null);
      }
    } catch (error) {
      console.error('Error loading submission:', error);
    } finally {
      setLoadingSubmission(false);
    }
  };

  const handleJoinClass = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const cls = await getClassByCode(joinCode.trim());
      if (!cls) {
        setJoinError('Không tìm thấy lớp với mã này');
        return;
      }
      await joinClass(cls.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      });
      await loadClasses();
      setJoinCode('');
    } catch (error) {
      console.error('Error joining class:', error);
      setJoinError('Đã có lỗi xảy ra');
    } finally {
      setJoining(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxImages = 8;
    const filesToProcess = Math.min(files.length, maxImages - submissionImages.length);

    for (let i = 0; i < filesToProcess; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        alert('Ảnh quá lớn. Tối đa 10MB mỗi ảnh.');
        continue;
      }
      
      const base64 = await fileToBase64(file);
      setSubmissionImages(prev => [...prev, base64]);
    }
  };

  const removeImage = (index: number) => {
    setSubmissionImages(submissionImages.filter((_, i) => i !== index));
  };

  const handleSubmitAssignment = async () => {
    if (!user || !selectedAssignment) return;
    if (submissionImages.length === 0 && !submissionContent.trim()) {
      alert('Vui lòng upload ảnh bài làm hoặc nhập câu trả lời');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitAssignment({
        assignmentId: selectedAssignment.id,
        studentId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        images: submissionImages.length > 0 ? submissionImages : undefined,
        textAnswer: submissionContent.trim() || undefined
      });

      if (result.success) {
        await loadAssignmentDetail(selectedAssignment);
        setSubmissionContent('');
        setSubmissionImages([]);
        alert('Nộp bài thành công!');
      } else {
        alert('Lỗi nộp bài: ' + result.error);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Lỗi: ' + String(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAppsScriptConfigured() && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 max-w-7xl mx-auto">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Hệ thống chưa được cấu hình. Vui lòng liên hệ giáo viên.</span>
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
                <h1 className="text-xl font-bold text-gray-900">Học sinh</h1>
                <p className="text-sm text-gray-500">Xin chào, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Tham gia lớp học</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã lớp"
                  maxLength={6}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl uppercase font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button onClick={handleJoinClass} disabled={joining || !joinCode.trim()} className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-medium">
                  {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tham gia'}
                </button>
              </div>
              {joinError && <p className="text-red-500 text-sm mt-2">{joinError}</p>}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Lớp học của tôi</h2>
              {classes.length === 0 ? (
                <p className="text-gray-500 text-sm">Bạn chưa tham gia lớp nào</p>
              ) : (
                <div className="space-y-2">
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => loadAssignments(cls)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        selectedClass?.id === cls.id
                          ? 'bg-teal-50 border-2 border-teal-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <h3 className="font-medium text-gray-900">{cls.name}</h3>
                      <p className="text-sm text-gray-500">{cls.teacherName}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedAssignment ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                  <button onClick={() => { setSelectedAssignment(null); setSubmission(null); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedAssignment.title}</h2>
                  {selectedAssignment.dueDate && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Hạn nộp: {new Date(selectedAssignment.dueDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>

                <div className="p-5">
                  {selectedAssignment.description && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-2">Hướng dẫn</h3>
                      <p className="text-gray-600">{selectedAssignment.description}</p>
                    </div>
                  )}

                  {selectedAssignment.problemText && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-2">Nội dung đề bài</h3>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-gray-700 whitespace-pre-wrap">{selectedAssignment.problemText}</p>
                      </div>
                    </div>
                  )}

                  {selectedAssignment.attachmentUrl && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-700 mb-2">File đề bài</h3>
                      <a href={selectedAssignment.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-xl hover:bg-teal-100 transition-colors">
                        <Download className="w-4 h-4" />
                        {selectedAssignment.attachmentFileName || 'Tải file đề'}
                      </a>
                    </div>
                  )}

                  {loadingSubmission ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    </div>
                  ) : submission ? (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 text-green-700 mb-3">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Đã nộp bài</span>
                      </div>
                      
                      {submission.imagesCount && submission.imagesCount > 0 && (
                        <p className="text-sm text-gray-600 mb-2">{submission.imagesCount} ảnh bài làm</p>
                      )}
                      
                      {submission.textAnswer && (
                        <p className="text-sm text-gray-600 mb-2">Câu trả lời: {submission.textAnswer.substring(0, 100)}...</p>
                      )}

                      <p className="text-xs text-gray-500 mb-3">
                        Nộp lúc: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('vi-VN') : ''}
                      </p>

                      {submission.isGraded ? (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-green-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-700">Kết quả chấm bài</span>
                            <span className={`text-2xl font-bold ${
                              Number(submission.score) >= 8 ? 'text-green-600' : 
                              Number(submission.score) >= 5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {submission.score}/10
                            </span>
                          </div>
                          {submission.feedback && (
                            <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
                              {submission.feedback}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600 mt-3">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Đang chờ giáo viên chấm bài...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">Nộp bài</h3>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">Ảnh bài làm (tối đa 8 ảnh)</label>
                        <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" multiple className="hidden" />
                        
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {submissionImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                              <img src={`data:image/jpeg;base64,${img}`} alt={`Bài làm ${idx + 1}`} className="w-full h-full object-cover" />
                              <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {submissionImages.length < 8 && (
                            <button onClick={() => imageInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-lg hover:border-teal-400 hover:bg-teal-50/50 flex flex-col items-center justify-center transition-colors">
                              <Plus className="w-6 h-6 text-gray-400" />
                              <span className="text-xs text-gray-400 mt-1">Thêm ảnh</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">Chụp rõ bài làm của bạn</p>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">Hoặc nhập câu trả lời</label>
                        <textarea
                          value={submissionContent}
                          onChange={(e) => setSubmissionContent(e.target.value)}
                          placeholder="Nhập nội dung bài làm (không bắt buộc nếu đã upload ảnh)..."
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                      </div>

                      <button
                        onClick={handleSubmitAssignment}
                        disabled={submitting || (submissionImages.length === 0 && !submissionContent.trim())}
                        className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors"
                      >
                        {submitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                        Nộp bài
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedClass ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedClass.name}</h2>
                  <p className="text-sm text-gray-500">Giáo viên: {selectedClass.teacherName}</p>
                </div>

                <div className="p-5">
                  {loadingAssignments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Chưa có bài tập nào</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignments.map(assignment => (
                        <button
                          key={assignment.id}
                          onClick={() => loadAssignmentDetail(assignment)}
                          className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">{assignment.title}</h3>
                              {assignment.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{assignment.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                {assignment.attachmentUrl && (
                                  <span className="flex items-center gap-1">
                                    <Download className="w-3 h-3" />
                                    Có file đề
                                  </span>
                                )}
                                {assignment.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Hạn: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chọn một lớp học để xem bài tập</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
