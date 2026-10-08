import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Play,
  Share2,
  Trophy,
  Calendar,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookMarked,
  Plus,
  Upload,
  FileCheck,
  FileDown,
  Trash2,
  FilePlus,
  Copy,
  Check,
  Edit3,
  Edit,
  Save,
  AlertCircle,
  X as CloseIcon
} from 'lucide-react';
import {
  fetchQuizDetail,
  appendPdfToQuiz,
  deleteQuiz,
  updateQuiz,
  renameQuizChapter,
  updateQuizQuestion,
  deleteQuizQuestion,
  fetchSubjects
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import ShareModal from '../components/ShareModal';
import ExportPdfModal from '../components/ExportPdfModal';

export default function QuizDetailPage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Collapsible chapter questions state
  const [expandedChapters, setExpandedChapters] = useState({});

  // PDF Export Modal State
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [exportTargetChapter, setExportTargetChapter] = useState('all');

  // Add new chapter modal state
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [newChapterPdfs, setNewChapterPdfs] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isUploadingChapter, setIsUploadingChapter] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  // ================= EDIT QUIZ MODAL STATE =================
  const [isEditQuizOpen, setIsEditQuizOpen] = useState(false);
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizDescription, setEditQuizDescription] = useState('');
  const [editQuizSubjectId, setEditQuizSubjectId] = useState('');
  const [isUpdatingQuiz, setIsUpdatingQuiz] = useState(false);
  const [editQuizError, setEditQuizError] = useState(null);

  // ================= RENAME CHAPTER MODAL STATE =================
  const [isRenameChapterOpen, setIsRenameChapterOpen] = useState(false);
  const [oldChapterName, setOldChapterName] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [isRenamingChapter, setIsRenamingChapter] = useState(false);
  const [renameChapterError, setRenameChapterError] = useState(null);

  // ================= EDIT QUESTION MODAL STATE =================
  const [isEditQuestionOpen, setIsEditQuestionOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [qContent, setQContent] = useState('');
  const [qChapter, setQChapter] = useState('');
  const [qOptionA, setQOptionA] = useState('');
  const [qOptionB, setQOptionB] = useState('');
  const [qOptionC, setQOptionC] = useState('');
  const [qOptionD, setQOptionD] = useState('');
  const [qCorrect, setQCorrect] = useState('A');
  const [qExpA, setQExpA] = useState('');
  const [qExpB, setQExpB] = useState('');
  const [qExpC, setQExpC] = useState('');
  const [qExpD, setQExpD] = useState('');
  const [isUpdatingQuestion, setIsUpdatingQuestion] = useState(false);
  const [editQuestionError, setEditQuestionError] = useState(null);

  const canEdit = isAdmin || (user && quiz && quiz.created_by_id === user.id) || !quiz?.created_by_id;

  const loadQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, subjectsList] = await Promise.all([
        fetchQuizDetail(shareCode),
        fetchSubjects().catch(() => [])
      ]);
      setQuiz(data);
      setSubjects(subjectsList || []);
    } catch (err) {
      setError(err.message || 'Không thể tải bộ đề');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuiz();
  }, [shareCode]);

  const handleCopyCode = () => {
    if (!quiz?.share_code) return;
    navigator.clipboard.writeText(quiz.share_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleExpandChapter = (ch) => {
    setExpandedChapters(prev => ({
      ...prev,
      [ch]: !prev[ch]
    }));
  };

  const expandAllChapters = (val) => {
    const chapters = quiz?.chapters_summary?.map(c => c.name) || [];
    const next = {};
    chapters.forEach(c => { next[c] = val; });
    setExpandedChapters(next);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (incoming) => {
    const pdfs = incoming.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setUploadError('Vui lòng chỉ chọn các file định dạng PDF (.pdf).');
      return;
    }
    setUploadError(null);
    setNewChapterPdfs(prev => [...prev, ...pdfs]);
  };

  const handleRemoveFile = (idx) => {
    setNewChapterPdfs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAppendChapter = async (e) => {
    e.preventDefault();
    if (newChapterPdfs.length === 0) {
      setUploadError('Vui lòng chọn hoặc kéo thả ít nhất 1 file PDF để tải lên.');
      return;
    }

    setIsUploadingChapter(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const updatedQuiz = await appendPdfToQuiz(quiz.share_code, newChapterPdfs, newChapterTitle);
      setQuiz(updatedQuiz);
      setUploadSuccess(`Đã nạp thành công ${newChapterPdfs.length} file PDF vào bộ đề! Hiện có tổng cộng ${updatedQuiz.questions?.length || 0} câu hỏi.`);
      setTimeout(() => {
        setIsAddChapterOpen(false);
        setNewChapterPdfs([]);
        setNewChapterTitle('');
        setUploadSuccess(null);
      }, 1500);
    } catch (err) {
      setUploadError(err.message || 'Lỗi khi nạp file PDF bài mới.');
    } finally {
      setIsUploadingChapter(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quiz) return;
    setIsDeleting(true);
    try {
      await deleteQuiz(quiz.share_code || quiz.id);
      navigate('/');
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bộ đề');
      setIsDeleting(false);
    }
  };

  // ================= HANDLERS FOR EDITING =================
  const openEditQuizModal = () => {
    setEditQuizTitle(quiz.title || '');
    setEditQuizDescription(quiz.description || '');
    setEditQuizSubjectId(quiz.subject_id ? String(quiz.subject_id) : '');
    setEditQuizError(null);
    setIsEditQuizOpen(true);
  };

  const handleSaveQuizInfo = async (e) => {
    e.preventDefault();
    if (!editQuizTitle.trim()) {
      setEditQuizError('Tiêu đề bộ đề không được để trống.');
      return;
    }

    setIsUpdatingQuiz(true);
    setEditQuizError(null);
    try {
      const updated = await updateQuiz(quiz.share_code, {
        title: editQuizTitle.trim(),
        description: editQuizDescription.trim(),
        subject_id: editQuizSubjectId ? parseInt(editQuizSubjectId, 10) : null
      });
      setQuiz(updated);
      setIsEditQuizOpen(false);
    } catch (err) {
      setEditQuizError(err.message || 'Lỗi khi cập nhật bộ đề.');
    } finally {
      setIsUpdatingQuiz(false);
    }
  };

  const openRenameChapterModal = (chName) => {
    setOldChapterName(chName);
    setNewChapterName(chName);
    setRenameChapterError(null);
    setIsRenameChapterOpen(true);
  };

  const handleSaveRenameChapter = async (e) => {
    e.preventDefault();
    if (!newChapterName.trim()) {
      setRenameChapterError('Tên bài / chương mới không được để trống.');
      return;
    }

    setIsRenamingChapter(true);
    setRenameChapterError(null);
    try {
      await renameQuizChapter(quiz.share_code, oldChapterName, newChapterName.trim());
      await loadQuiz();
      setIsRenameChapterOpen(false);
    } catch (err) {
      setRenameChapterError(err.message || 'Lỗi khi đổi tên bài/chương.');
    } finally {
      setIsRenamingChapter(false);
    }
  };

  const openEditQuestionModal = (q) => {
    setEditingQuestion(q);
    setQContent(q.content || '');
    setQChapter(q.chapter || 'Bài 1');
    setQOptionA(q.option_a || '');
    setQOptionB(q.option_b || '');
    setQOptionC(q.option_c || '');
    setQOptionD(q.option_d || '');
    setQCorrect((q.correct_answer || 'A').toUpperCase());
    setQExpA(q.explanation_a || '');
    setQExpB(q.explanation_b || '');
    setQExpC(q.explanation_c || '');
    setQExpD(q.explanation_d || '');
    setEditQuestionError(null);
    setIsEditQuestionOpen(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!qContent.trim() || !qOptionA.trim() || !qOptionB.trim() || !qOptionC.trim() || !qOptionD.trim()) {
      setEditQuestionError('Vui lòng nhập đầy đủ nội dung câu hỏi và 4 đáp án A, B, C, D.');
      return;
    }

    setIsUpdatingQuestion(true);
    setEditQuestionError(null);
    try {
      await updateQuizQuestion(quiz.share_code, editingQuestion.id, {
        chapter: qChapter.trim() || 'Bài 1',
        content: qContent.trim(),
        option_a: qOptionA.trim(),
        option_b: qOptionB.trim(),
        option_c: qOptionC.trim(),
        option_d: qOptionD.trim(),
        correct_answer: qCorrect,
        explanation_a: qExpA.trim(),
        explanation_b: qExpB.trim(),
        explanation_c: qExpC.trim(),
        explanation_d: qExpD.trim()
      });
      await loadQuiz();
      setIsEditQuestionOpen(false);
    } catch (err) {
      setEditQuestionError(err.message || 'Lỗi khi lưu câu hỏi.');
    } finally {
      setIsUpdatingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi bộ đề?')) return;

    try {
      await deleteQuizQuestion(quiz.share_code, qId);
      await loadQuiz();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa câu hỏi.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-500">Đang tải chi tiết bộ đề...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <HelpCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Không tìm thấy bộ đề</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error || 'Mã chia sẻ không chính xác hoặc đề thi đã bị xóa.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại danh sách</span>
      </Link>

      {/* Main Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* TOP ROW */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{quiz.subject?.name || 'Bộ đề tự do'}</span>
            </span>

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Nhấn để sao chép mã"
            >
              <span>Code: <strong>{quiz.share_code}</strong></span>
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {canEdit && (
              <button
                onClick={openEditQuizModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-xs transition-all"
                title="Chỉnh sửa tên, môn học hoặc mô tả đề"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Sửa Đề</span>
              </button>
            )}

            <button
              onClick={() => {
                setExportTargetChapter('all');
                setIsExportPdfOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 font-semibold text-xs transition-all"
              title="Xuất file PDF đề thi và đáp án"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Xuất PDF</span>
            </button>

            <button
              onClick={() => setIsShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 font-semibold text-xs transition-all"
              title="Chia sẻ bộ đề"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>

            {canEdit && (
              <button
                onClick={() => setIsDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-semibold text-xs transition-all"
                title="Xóa bộ đề"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* HERO CONTENT: Title, Description, Stats */}
        <div className="pt-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
            {quiz.title}
          </h1>

          {quiz.description && (
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-3xl">
              {quiz.description}
            </p>
          )}

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400 mb-8 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-500" />
              <span><strong>{quiz.questions?.length || 0}</strong> câu hỏi trắc nghiệm</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span><strong>{quiz.chapters?.length || 1}</strong> bài / chương</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span><strong>{quiz.recent_attempts?.length || 0}</strong> lượt thi</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString('vi-VN') : 'Mới tạo'}</span>
            </div>
          </div>

          {/* 2 MAIN ACTION BUTTONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-xl">
            <Link
              to={`/quiz/${quiz.share_code}/practice`}
              className="flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-98 transition-all"
            >
              <GraduationCap className="w-5 h-5" />
              <span>Ôn Luyện Tự Do (Tất Cả)</span>
            </Link>

            <Link
              to={`/quiz/${quiz.share_code}/exam`}
              className="flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-md active:scale-98 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Vào Phòng Thi Thử</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SECTION: Left (Chapter Breakdown & Questions) | Right (Recent Attempts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CHAPTERS ACCORDIONS (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Nội dung theo từng Bài / Chương</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Xem danh sách câu hỏi, sửa lỗi chính tả & đáp án khi cần
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mr-1">
                <button
                  onClick={() => expandAllChapters(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  Mở tất cả
                </button>
                <button
                  onClick={() => expandAllChapters(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Thu gọn
                </button>
              </div>

              {canEdit && (
                <button
                  onClick={() => {
                    setUploadError(null);
                    setUploadSuccess(null);
                    setIsAddChapterOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nạp Bài mới (PDF)</span>
                </button>
              )}
            </div>
          </div>

          {/* Grouped Chapter Accordions with Edit options */}
          {(() => {
            const grouped = {};
            (quiz.questions || []).forEach(q => {
              const ch = q.chapter || 'Bài 1';
              if (!grouped[ch]) grouped[ch] = [];
              grouped[ch].push(q);
            });

            const chapterKeys = Object.keys(grouped);

            if (chapterKeys.length === 0) {
              return (
                <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                  <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Bộ đề này chưa có câu hỏi nào</p>
                  <p className="text-xs text-slate-500 mb-4">Bạn có thể nạp thêm câu hỏi từ file PDF bất kỳ.</p>
                  {canEdit && (
                    <button
                      onClick={() => setIsAddChapterOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nạp file PDF vào bộ đề</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {chapterKeys.map((chName, chIdx) => {
                  const qList = grouped[chName];
                  const isExpanded = !!expandedChapters[chName];

                  // Parse chapter tag
                  let chTag = `Bài ${chIdx + 1}`;
                  let chTitle = chName;
                  const colonMatch = chName.match(/^((?:Bài|BÀI|Chương|CHƯƠNG|Phần|PHẦN|Chủ đề|CHỦ ĐỀ)\s*[0-9IVXLCDMivxlcdm]+)\s*[:\.\-\–\—]?\s*(.*)$/i);
                  if (colonMatch) {
                    chTag = colonMatch[1];
                    chTitle = colonMatch[2] || colonMatch[1];
                  }

                  return (
                    <div
                      key={chName}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm transition-all"
                    >
                      {/* Accordion & Action Header */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        
                        {/* Title area */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                              {chTag}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                              {qList.length} câu
                            </span>

                            {canEdit && (
                              <button
                                onClick={() => openRenameChapterModal(chName)}
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline ml-1 font-semibold"
                                title="Đổi tên bài / chương này để sửa lỗi chính tả"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Đổi tên</span>
                              </button>
                            )}
                          </div>
                          <h3
                            onClick={() => toggleExpandChapter(chName)}
                            className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          >
                            {chTitle}
                          </h3>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                          <button
                            onClick={() => {
                              setExportTargetChapter(chName);
                              setIsExportPdfOpen(true);
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
                            title="Xuất PDF riêng cho bài này"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <Link
                            to={`/quiz/${quiz.share_code}/practice?chapter=${encodeURIComponent(chName)}&mode=study`}
                            className="px-3.5 sm:px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-xs transition-all text-center min-w-[55px]"
                          >
                            Học
                          </Link>

                          <Link
                            to={`/quiz/${quiz.share_code}/practice?chapter=${encodeURIComponent(chName)}&mode=practice`}
                            className="px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/80 dark:border-indigo-800 font-bold text-xs shadow-xs transition-all text-center min-w-[75px]"
                          >
                            Luyện tập
                          </Link>

                          <button
                            type="button"
                            onClick={() => toggleExpandChapter(chName)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-all shadow-xs"
                          >
                            <span>{isExpanded ? 'Đóng' : 'Xem câu'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Questions List for this chapter */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3 bg-slate-50/50 dark:bg-slate-950/30 animate-fade-in">
                          {qList.map((q, qIdx) => {
                            const correct = (q.correct_answer || 'A').toUpperCase();
                            return (
                              <div
                                key={q.id || qIdx}
                                className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 relative group"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 flex-1">
                                    <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200/80 dark:border-indigo-900/40">
                                      {qIdx + 1}
                                    </span>
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed flex-1">
                                      {q.content}
                                    </p>
                                  </div>

                                  {canEdit && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => openEditQuestionModal(q)}
                                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors text-xs font-semibold flex items-center gap-1"
                                        title="Chỉnh sửa câu hỏi, đáp án hoặc giải thích"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Sửa</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteQuestion(q.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                        title="Xóa câu hỏi này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:pl-9">
                                  <div className={`p-2.5 rounded-xl border transition-all ${correct === 'A' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-950 dark:text-emerald-200' : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 mr-1.5">A.</span> {q.option_a}
                                  </div>
                                  <div className={`p-2.5 rounded-xl border transition-all ${correct === 'B' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-950 dark:text-emerald-200' : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 mr-1.5">B.</span> {q.option_b}
                                  </div>
                                  <div className={`p-2.5 rounded-xl border transition-all ${correct === 'C' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-950 dark:text-emerald-200' : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 mr-1.5">C.</span> {q.option_c}
                                  </div>
                                  <div className={`p-2.5 rounded-xl border transition-all ${correct === 'D' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 font-bold text-emerald-950 dark:text-emerald-200' : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 mr-1.5">D.</span> {q.option_d}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Recent Attempts / Leaderboard (1 col) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Lượt làm bài gần đây</span>
          </h2>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
            {(!quiz.recent_attempts || quiz.recent_attempts.length === 0) ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Chưa có ai thi thử bộ đề này. Hãy là người đầu tiên!
              </div>
            ) : (
              <div className="space-y-3">
                {quiz.recent_attempts.map((att, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-[10px]">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{att.taker_name}</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{att.score} điểm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ================= MODAL: EDIT QUIZ INFO ================= */}
      {isEditQuizOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-500" />
                Chỉnh Sửa Thông Tin Bộ Đề
              </h3>
              <button
                onClick={() => setIsEditQuizOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {editQuizError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{editQuizError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuizInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tiêu đề bộ đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editQuizTitle}
                  onChange={(e) => setEditQuizTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Chủ đề / Môn học
                </label>
                <select
                  value={editQuizSubjectId}
                  onChange={(e) => setEditQuizSubjectId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Bộ đề tự do (Chưa phân loại) --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Mô tả bộ đề
                </label>
                <textarea
                  rows={3}
                  value={editQuizDescription}
                  onChange={(e) => setEditQuizDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditQuizOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingQuiz}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isUpdatingQuiz ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RENAME CHAPTER ================= */}
      {isRenameChapterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Đổi Tên Bài / Chương
              </h3>
              <button
                onClick={() => setIsRenameChapterOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {renameChapterError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{renameChapterError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRenameChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Tên hiện tại:
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
                  {oldChapterName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên bài / chương mới <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="Ví dụ: Bài 1: Tổng quan lý thuyết"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameChapterOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isRenamingChapter}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isRenamingChapter ? 'Đang đổi tên...' : 'Cập Nhật Tên'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT QUESTION & ANSWERS ================= */}
      {isEditQuestionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Sửa Câu Hỏi & Đáp Án
              </h3>
              <button
                onClick={() => setIsEditQuestionOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {editQuestionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{editQuestionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Bài / Chương:
                </label>
                <input
                  type="text"
                  value={qChapter}
                  onChange={(e) => setQChapter(e.target.value)}
                  placeholder="Ví dụ: Bài 1, Chương 2..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nội dung câu hỏi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={qContent}
                  onChange={(e) => setQContent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 4 Options */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  4 Đáp án (Chọn nút tròn để đặt đáp án đúng):
                </label>

                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const val = optKey === 'A' ? qOptionA : optKey === 'B' ? qOptionB : optKey === 'C' ? qOptionC : qOptionD;
                  const setVal = optKey === 'A' ? setQOptionA : optKey === 'B' ? setQOptionB : optKey === 'C' ? setQOptionC : setQOptionD;
                  const isChecked = qCorrect === optKey;

                  return (
                    <div
                      key={optKey}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                        isChecked
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setQCorrect(optKey)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                          isChecked
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-600 hover:text-white'
                        }`}
                        title="Đặt làm đáp án đúng"
                      >
                        {optKey}
                      </button>

                      <input
                        type="text"
                        required
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={`Nội dung đáp án ${optKey}...`}
                        className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none"
                      />

                      {isChecked && (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                          ĐÚNG
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Giải thích chi tiết cho đáp án đúng (Tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={qCorrect === 'A' ? qExpA : qCorrect === 'B' ? qExpB : qCorrect === 'C' ? qExpC : qExpD}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (qCorrect === 'A') setQExpA(text);
                    else if (qCorrect === 'B') setQExpB(text);
                    else if (qCorrect === 'C') setQExpC(text);
                    else setQExpD(text);
                  }}
                  placeholder="Nhập lời giải thích ngắn gọn..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditQuestionOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingQuestion}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isUpdatingQuestion ? 'Đang lưu...' : 'Lưu Câu Hỏi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD PDF CHAPTER ================= */}
      {isAddChapterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsAddChapterOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Nạp Thêm Bài Mới Từ File PDF
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Kéo thả các file PDF bài mới vào bộ đề này
            </p>

            {uploadSuccess && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleAppendChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên bài / chương (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="Để trống nếu muốn tự nhận diện theo tên file"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Kéo thả file PDF vào đây hoặc
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer hover:bg-indigo-500 transition-all">
                  <FilePlus className="w-3.5 h-3.5" />
                  <span>Chọn file PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
              </div>

              {newChapterPdfs.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {newChapterPdfs.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddChapterOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploadingChapter || newChapterPdfs.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingChapter ? 'Đang nạp PDF...' : 'Nạp Vào Bộ Đề'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export to PDF Modal */}
      <ExportPdfModal
        quiz={quiz}
        initialChapter={exportTargetChapter}
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <CloseIcon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa bộ đề
                </h3>
                <p className="text-xs text-slate-500">
                  Hành động này không thể hoàn tác
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              Bạn có chắc chắn muốn xóa bộ đề <strong className="text-slate-900 dark:text-white font-bold">"{quiz.title}"</strong> ({quiz.questions?.length || 0} câu hỏi)? Tất cả câu hỏi và lịch sử làm bài sẽ bị xóa vĩnh viễn.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteQuiz}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
