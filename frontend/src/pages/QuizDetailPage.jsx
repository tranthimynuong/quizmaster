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
  X as CloseIcon,
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  Globe,
  Lock,
  Unlock
} from 'lucide-react';
import {
  fetchQuizDetail,
  appendPdfToQuiz,
  deleteQuiz,
  updateQuiz,
  renameQuizChapter,
  deleteQuizChapter,
  updateQuizQuestion,
  deleteQuizQuestion,
  fetchSubjects,
  aiSolveQuestion
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
  const [savedPracticeProgress, setSavedPracticeProgress] = useState(null);

  const checkSavedProgress = (code) => {
    try {
      const raw = localStorage.getItem(`quiz_practice_progress_${code || shareCode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0 && (parsed.currentIndex > 0 || Object.keys(parsed.userAnswers || {}).length > 0)) {
          setSavedPracticeProgress(parsed);
          return;
        }
      }
    } catch (e) {}
    setSavedPracticeProgress(null);
  };

  const handleClearPracticeProgress = () => {
    try {
      localStorage.removeItem(`quiz_practice_progress_${quiz?.share_code || shareCode}`);
      setSavedPracticeProgress(null);
    } catch (e) {}
  };

  // Collapsible chapter questions state
  const [expandedChapters, setExpandedChapters] = useState({});

  // Chapter filter, search & sort state
  const [chapterSearch, setChapterSearch] = useState('');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [chapterSort, setChapterSort] = useState('default');

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
  const [editQuizIsPublic, setEditQuizIsPublic] = useState(true);
  const [isUpdatingQuiz, setIsUpdatingQuiz] = useState(false);
  const [editQuizError, setEditQuizError] = useState(null);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);

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
  const [isAiSolving, setIsAiSolving] = useState(false);
  const [aiSolveNotice, setAiSolveNotice] = useState(null);

  const handleAiSolveQuestion = async () => {
    if (!qContent.trim() || !qOptionA.trim() || !qOptionB.trim() || !qOptionC.trim() || !qOptionD.trim()) {
      alert('Vui lòng nhập đầy đủ nội dung câu hỏi và 4 đáp án A/B/C/D để AI phân tích.');
      return;
    }
    setIsAiSolving(true);
    setAiSolveNotice(null);
    try {
      const res = await aiSolveQuestion({
        content: qContent.trim(),
        option_a: qOptionA.trim(),
        option_b: qOptionB.trim(),
        option_c: qOptionC.trim(),
        option_d: qOptionD.trim(),
        current_answer: qCorrect
      });
      if (res.correct_answer) {
        setQCorrect(res.correct_answer);
      }
      if (res.explanation_a) setQExpA(res.explanation_a);
      if (res.explanation_b) setQExpB(res.explanation_b);
      if (res.explanation_c) setQExpC(res.explanation_c);
      if (res.explanation_d) setQExpD(res.explanation_d);
      setAiSolveNotice(`✨ AI đã xác định đáp án đúng (${res.correct_answer}) và tự động tạo 4 lời giải thích chi tiết!`);
      setTimeout(() => setAiSolveNotice(null), 5000);
    } catch (err) {
      alert(err.message || 'Lỗi khi gọi AI giải câu hỏi');
    } finally {
      setIsAiSolving(false);
    }
  };
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
      if (data?.share_code) {
        checkSavedProgress(data.share_code);
      }
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

  // ================= HANDLERS FOR EDITING & PRIVACY =================
  const openEditQuizModal = () => {
    setEditQuizTitle(quiz.title || '');
    setEditQuizDescription(quiz.description || '');
    setEditQuizSubjectId(quiz.subject_id ? String(quiz.subject_id) : '');
    setEditQuizIsPublic(quiz.is_public ?? true);
    setEditQuizError(null);
    setIsEditQuizOpen(true);
  };

  const handleTogglePrivacy = async (targetValue) => {
    if (!quiz) return;
    const nextVal = targetValue !== undefined ? targetValue : !quiz.is_public;
    setIsTogglingPrivacy(true);
    try {
      const updated = await updateQuiz(quiz.share_code, {
        is_public: nextVal
      });
      setQuiz(updated);
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật quyền riêng tư');
    } finally {
      setIsTogglingPrivacy(false);
    }
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
        subject_id: editQuizSubjectId ? parseInt(editQuizSubjectId, 10) : null,
        is_public: editQuizIsPublic
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

  const handleDeleteChapter = async (chName) => {
    const count = quiz?.questions?.filter(q => (q.chapter || 'Bài 1') === chName)?.length || 0;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài "${chName}" cùng toàn bộ ${count} câu hỏi trong bài này không?\nThao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      await deleteQuizChapter(quiz.share_code, chName);
      await loadQuiz();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bài / chương.');
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

            {/* Privacy Badge / Quick Toggle Button */}
            {canEdit ? (
              <button
                type="button"
                onClick={() => handleTogglePrivacy()}
                disabled={isTogglingPrivacy}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer shadow-xs ${
                  quiz.is_public
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                }`}
                title={quiz.is_public ? 'Đang Công khai (ai có link cũng xem/thi được). Bấm để chuyển thành Riêng tư' : 'Đang Riêng tư (chỉ bạn và admin xem được). Bấm để chuyển thành Công khai'}
              >
                {quiz.is_public ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Công khai</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Riêng tư</span>
                  </>
                )}
              </button>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                  quiz.is_public
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                }`}
              >
                {quiz.is_public ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Công khai</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Riêng tư</span>
                  </>
                )}
              </span>
            )}
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

          {/* SAVED STUDY PROGRESS PROMPT BANNER */}
          {savedPracticeProgress && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-pink-50/90 dark:from-indigo-950/50 dark:via-purple-950/40 dark:to-pink-950/50 border border-indigo-200/90 dark:border-indigo-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-2xl">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Bạn có tiến độ học dở bộ đề này</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                      {Math.round(((Object.keys(savedPracticeProgress.userAnswers || {}).length) / (savedPracticeProgress.questions?.length || 1)) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Đã hoàn thành <strong>{Object.keys(savedPracticeProgress.userAnswers || {}).length}</strong>/{savedPracticeProgress.questions?.length || quiz.questions?.length} câu • Dừng lại ở câu <strong>{savedPracticeProgress.currentIndex + 1}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Link
                  to={`/quiz/${quiz.share_code}/practice?resume=true`}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tiếp tục học (Câu {savedPracticeProgress.currentIndex + 1})</span>
                </Link>
                <button
                  type="button"
                  onClick={handleClearPracticeProgress}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 text-xs font-semibold transition-colors"
                  title="Xóa tiến độ này để bắt đầu lại từ đầu"
                >
                  Làm mới
                </button>
              </div>
            </div>
          )}

          {/* 2 MAIN ACTION BUTTONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-xl">
            <Link
              to={`/quiz/${quiz.share_code}/practice`}
              className="flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-98 transition-all"
            >
              <GraduationCap className="w-5 h-5" />
              <span>{savedPracticeProgress ? 'Bắt Đầu Học Mới' : 'Ôn Luyện Tự Do (Tất Cả)'}</span>
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

          {/* Grouped Chapter Accordions with Filter & Edit options */}
          {(() => {
            const extractChapterNumber = (str) => {
              if (!str) return 999999;
              const match = str.match(/(?:chương|chuong|bài|bai|phần|phan|chủ\s*đề|chu\s*de|chapter|part)?\s*[\:\-\_]?\s*([0-9]+)/i);
              if (match && match[1]) {
                return parseInt(match[1], 10);
              }
              return 999999;
            };

            const grouped = {};
            (quiz.questions || []).forEach(q => {
              const ch = q.chapter || 'Bài 1';
              if (!grouped[ch]) grouped[ch] = [];
              grouped[ch].push(q);
            });

            // Naturally sort chapters by default (Bài 1, Bài 2, ..., Bài 10)
            const allChapterKeys = Object.keys(grouped).sort((a, b) => {
              const numA = extractChapterNumber(a);
              const numB = extractChapterNumber(b);
              if (numA !== numB) return numA - numB;
              return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
            });

            if (allChapterKeys.length === 0) {
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

            // Filter by search & selected chapter
            let filteredChapterKeys = allChapterKeys.filter(chName => {
              if (chapterFilter !== 'all' && chName !== chapterFilter) return false;
              if (!chapterSearch.trim()) return true;

              const query = chapterSearch.trim().toLowerCase();
              if (chName.toLowerCase().includes(query)) return true;

              return grouped[chName].some(q =>
                (q.content && q.content.toLowerCase().includes(query)) ||
                (q.option_a && q.option_a.toLowerCase().includes(query)) ||
                (q.option_b && q.option_b.toLowerCase().includes(query)) ||
                (q.option_c && q.option_c.toLowerCase().includes(query)) ||
                (q.option_d && q.option_d.toLowerCase().includes(query))
              );
            });

            // Sorting
            if (chapterSort === 'default' || chapterSort === 'num_asc') {
              filteredChapterKeys.sort((a, b) => {
                const numA = extractChapterNumber(a);
                const numB = extractChapterNumber(b);
                if (numA !== numB) return numA - numB;
                return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
              });
            } else if (chapterSort === 'num_desc') {
              filteredChapterKeys.sort((a, b) => {
                const numA = extractChapterNumber(a);
                const numB = extractChapterNumber(b);
                if (numA !== numB) return numB - numA;
                return b.localeCompare(a, 'vi', { numeric: true, sensitivity: 'base' });
              });
            } else if (chapterSort === 'name_asc') {
              filteredChapterKeys.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));
            } else if (chapterSort === 'name_desc') {
              filteredChapterKeys.sort((a, b) => b.localeCompare(a, 'vi', { numeric: true, sensitivity: 'base' }));
            } else if (chapterSort === 'questions_desc') {
              filteredChapterKeys.sort((a, b) => (grouped[b]?.length || 0) - (grouped[a]?.length || 0));
            } else if (chapterSort === 'questions_asc') {
              filteredChapterKeys.sort((a, b) => (grouped[a]?.length || 0) - (grouped[b]?.length || 0));
            }

            const isFilteringActive = chapterSearch || chapterFilter !== 'all' || chapterSort !== 'default';

            return (
              <div className="space-y-4">
                {/* FILTER TOOLBAR */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={chapterSearch}
                        onChange={(e) => setChapterSearch(e.target.value)}
                        placeholder="Tìm theo tên bài hoặc từ khóa câu hỏi..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      {chapterSearch && (
                        <button
                          onClick={() => setChapterSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                          title="Xóa tìm kiếm"
                        >
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filter by Chapter Dropdown */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-44">
                        <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          value={chapterFilter}
                          onChange={(e) => setChapterFilter(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer text-ellipsis overflow-hidden"
                        >
                          <option value="all">Tất cả bài ({allChapterKeys.length})</option>
                          {allChapterKeys.map((cName) => (
                            <option key={cName} value={cName}>
                              {cName} ({grouped[cName].length} câu)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Sort Selector */}
                      <div className="relative flex-1 sm:w-44">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          value={chapterSort}
                          onChange={(e) => setChapterSort(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                        >
                          <option value="default">Thứ tự bài (Bài 1 → 10)</option>
                          <option value="num_desc">Thứ tự bài (Bài 10 → 1)</option>
                          <option value="name_asc">Tên bài (A → Z)</option>
                          <option value="name_desc">Tên bài (Z → A)</option>
                          <option value="questions_desc">Nhiều câu nhất</option>
                          <option value="questions_asc">Ít câu nhất</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Active Filters Summary */}
                  {isFilteringActive && (
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>
                        Hiển thị <strong>{filteredChapterKeys.length}</strong> / {allChapterKeys.length} bài
                        {chapterSearch && ` (khớp "${chapterSearch}")`}
                      </span>
                      <button
                        onClick={() => {
                          setChapterSearch('');
                          setChapterFilter('all');
                          setChapterSort('default');
                        }}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Đặt lại</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* ACCORDION LIST OR EMPTY SEARCH STATE */}
                {filteredChapterKeys.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 space-y-2.5">
                    <Search className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy bài / chương phù hợp</p>
                    <p className="text-xs text-slate-500">Thử tìm kiếm với từ khóa khác hoặc đặt lại bộ lọc.</p>
                    <button
                      onClick={() => {
                        setChapterSearch('');
                        setChapterFilter('all');
                        setChapterSort('default');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all mt-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xóa bộ lọc</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredChapterKeys.map((chName, chIdx) => {
                      const qList = grouped[chName];
                      const isExpanded = !!expandedChapters[chName];

                      // Parse chapter tag naturally
                      const chNum = extractChapterNumber(chName);
                      let chTag = chNum !== 999999 ? `Bài ${chNum}` : `Bài ${chIdx + 1}`;
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
                              <>
                                <button
                                  onClick={() => openRenameChapterModal(chName)}
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline ml-1 font-semibold"
                                  title="Đổi tên bài / chương này để sửa lỗi chính tả"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Đổi tên</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteChapter(chName)}
                                  className="inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:underline ml-1.5 font-semibold"
                                  title="Xóa toàn bộ bài này và các câu hỏi trong bài"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Xóa bài</span>
                                </button>
                              </>
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
            )}
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
                  Quyền riêng tư bộ đề
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditQuizIsPublic(true)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                      editQuizIsPublic
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold">Công khai</div>
                      <div className="text-[10px] font-normal opacity-75">Ai có mã đều thi được</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditQuizIsPublic(false)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                      !editQuizIsPublic
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold">Riêng tư</div>
                      <div className="text-[10px] font-normal opacity-75">Chỉ bạn & Admin</div>
                    </div>
                  </button>
                </div>
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

              {/* AI Auto-Solver Callout */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800/60 my-1">
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Trợ lý AI Phân Tích & Giải Thích</span>
                  </div>
                  <div className="text-[11px] text-purple-700 dark:text-purple-300">
                    Tự động tìm đáp án chuẩn và viết 4 lời giải thích chuyên sâu
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isAiSolving}
                  onClick={handleAiSolveQuestion}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 active:scale-95"
                >
                  {isAiSolving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Gợi Ý & Viết Lời Giải</span>
                    </>
                  )}
                </button>
              </div>

              {aiSolveNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{aiSolveNotice}</span>
                </div>
              )}

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

      {/* Share Quiz Modal */}
      <ShareModal
        quiz={quiz}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
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
