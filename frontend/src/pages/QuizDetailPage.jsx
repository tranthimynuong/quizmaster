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
  X as CloseIcon
} from 'lucide-react';
import { fetchQuizDetail, appendPdfToQuiz, deleteQuiz } from '../services/api';
import ShareModal from '../components/ShareModal';
import ExportPdfModal from '../components/ExportPdfModal';

export default function QuizDetailPage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!quiz?.share_code) return;
    navigator.clipboard.writeText(quiz.share_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Collapsible chapter questions state
  const [expandedChapters, setExpandedChapters] = useState({});

  // PDF Export Modal State
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [exportTargetChapter, setExportTargetChapter] = useState('all');

  // Add new chapter modal state with Drag & Drop and Batch Files
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [newChapterPdfs, setNewChapterPdfs] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isUploadingChapter, setIsUploadingChapter] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  useEffect(() => {
    async function loadQuiz() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchQuizDetail(shareCode);
        setQuiz(data);
      } catch (err) {
        setError(err.message || 'Không thể tải bộ đề');
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [shareCode]);

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

  const removeFile = (idx) => {
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

  // Group chapters and counts
  const chaptersSummary = quiz.chapters_summary || [];

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
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden">
        
        {/* Subtle decorative top bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* TOP ROW: Category pill + Share Code badge (Left) | Utility Action buttons (Right) */}
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
            <button
              onClick={() => {
                setExportTargetChapter('all');
                setIsExportPdfOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-xs transition-all"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-500" />
              <span>Xuất PDF</span>
            </button>

            <button
              onClick={() => setIsShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-xs transition-all"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Chia sẻ</span>
            </button>

            <button
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-semibold transition-all"
              title="Xóa bộ đề này"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          </div>
        </div>

        {/* MIDDLE: Big Title & Description */}
        <div className="py-5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2.5">
            {quiz.title}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
            {quiz.description || 'Bộ đề trắc nghiệm chuẩn hóa với đáp án đúng và lời giải thích chi tiết cho từng phương án lựa chọn.'}
          </p>
        </div>

        {/* BOTTOM ROW: Stats Badges (Left) & Primary CTAs (Right) */}
        <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Stats badges */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs font-semibold text-slate-600 dark:text-slate-300">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{quiz.questions?.length || 0} câu trắc nghiệm</span>
            </div>

            {chaptersSummary.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                <span>{chaptersSummary.length} bài / chương</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
              <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{new Date(quiz.created_at || Date.now()).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to={`/quiz/${quiz.share_code}/practice`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Vào Luyện tập ngay</span>
            </Link>

            <Link
              to={`/quiz/${quiz.share_code}/exam`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-violet-600/25 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Thi thử tính giờ</span>
            </Link>
          </div>

        </div>

      </div>

      {/* UNIFIED CHAPTERS & QUESTIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        
        {/* Main Section: Chapter Accordions with Action Buttons (Học / Luyện tập / Xem câu hỏi / Xuất PDF) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-emerald-600" />
                <span>Các bài & Danh sách câu hỏi ({quiz.questions?.length || 0} câu)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Học lý thuyết, luyện tập riêng từng bài hoặc bấm để xem chi tiết câu hỏi & đáp án.
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
            </div>
          </div>

          {/* Grouped Chapter Accordions with Integrated Study / Practice / Question view */}
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
                  <button
                    onClick={() => setIsAddChapterOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nạp file PDF vào bộ đề</span>
                  </button>
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
                        
                        {/* Title area (clicking toggles accordion) */}
                        <div
                          onClick={() => toggleExpandChapter(chName)}
                          className="flex-1 min-w-0 cursor-pointer select-none pr-2"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                              {chTag}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                              {qList.length} câu
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {chTitle}
                          </h3>
                        </div>

                        {/* Action Buttons: Export PDF, Học, Luyện tập, Xem chi tiết câu hỏi */}
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

                      {/* Accordion Content: Questions List for this chapter */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3 bg-slate-50/50 dark:bg-slate-950/30 animate-fade-in">
                          {qList.map((q, qIdx) => {
                            const correct = (q.correct_answer || 'A').toUpperCase();
                            return (
                              <div
                                key={q.id || qIdx}
                                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100 dark:border-indigo-900/40">
                                    {qIdx + 1}
                                  </span>
                                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed flex-1">
                                    {q.content}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pl-8">
                                  <div className={`p-2 rounded-xl border ${correct === 'A' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 font-semibold text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-bold text-indigo-600 mr-1.5">A.</span> {q.option_a}
                                  </div>
                                  <div className={`p-2 rounded-xl border ${correct === 'B' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 font-semibold text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-bold text-indigo-600 mr-1.5">B.</span> {q.option_b}
                                  </div>
                                  <div className={`p-2 rounded-xl border ${correct === 'C' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 font-semibold text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-bold text-indigo-600 mr-1.5">C.</span> {q.option_c}
                                  </div>
                                  <div className={`p-2 rounded-xl border ${correct === 'D' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 font-semibold text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'}`}>
                                    <span className="font-bold text-indigo-600 mr-1.5">D.</span> {q.option_d}
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
                  <div
                    key={att.id || i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {att.taker_name || 'Học viên ẩn danh'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {att.submitted_at ? new Date(att.submitted_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {att.score}/10
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Share Modal */}
      <ShareModal
        quiz={quiz}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Add New Chapter PDF Modal (With Drag & Drop and Multiple Files support) */}
      {isAddChapterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                    Nạp thêm Bài mới từ PDF
                  </h3>
                  <p className="text-xs text-slate-500">Bộ đề: {quiz.title}</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddChapterOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAppendChapter} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tên Bài / Tiêu đề (Tùy chọn khi nạp 1 file)
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="VD: Bài 2: Các hàm và Module trong Python..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nếu để trống hoặc tải nhiều file cùng lúc, hệ thống sẽ tự động quét tiêu đề hoặc lấy tên file làm tên Bài.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Kéo thả hoặc chọn nhiều file PDF <span className="text-rose-500">*</span>
                </label>
                
                {/* Drag & Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 scale-[1.01]'
                      : 'border-emerald-300 dark:border-emerald-900/80 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20'
                  }`}
                  onClick={() => document.getElementById('batch-pdf-input')?.click()}
                >
                  <Upload className={`w-9 h-9 mx-auto mb-2 transition-transform ${isDragging ? 'scale-110 text-emerald-600' : 'text-emerald-500'}`} />
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    {isDragging ? 'Thả các file PDF vào đây ngay!' : 'Kéo & Thả các file PDF vào đây'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    hoặc <span className="text-emerald-600 dark:text-emerald-400 underline font-semibold">bấm vào đây để chọn hàng loạt file</span>
                  </p>

                  <input
                    id="batch-pdf-input"
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>

                {/* Selected Files List */}
                {newChapterPdfs.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>Đã chọn {newChapterPdfs.length} file PDF:</span>
                      <button
                        type="button"
                        onClick={() => setNewChapterPdfs([])}
                        className="text-rose-500 hover:underline"
                      >
                        Xóa tất cả
                      </button>
                    </div>

                    {newChapterPdfs.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Bỏ file này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddChapterOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploadingChapter || newChapterPdfs.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingChapter ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang nạp {newChapterPdfs.length} file...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Nạp {newChapterPdfs.length > 0 ? `${newChapterPdfs.length} file` : ''} vào bộ đề</span>
                    </>
                  )}
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
              Bạn có chắc chắn muốn xóa bộ đề <strong className="text-slate-900 dark:text-white font-bold">"{quiz.title}"</strong> ({quiz.questions?.length || 0} câu hỏi)? Tất cả câu hỏi và lịch sử làm bài sẽ bị xóa vĩnh viễn khỏi Neon PostgreSQL.
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
