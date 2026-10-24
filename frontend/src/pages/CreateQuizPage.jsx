import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  Save,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ArrowLeft,
  Share2,
  Copy,
  Check,
  FileCheck,
  FolderPlus,
  X,
  AlertCircle,
  Eye,
  Play,
  GraduationCap,
  Home,
  Globe,
  Lock,
  Zap,
  Cpu,
  FileCode,
  Columns,
  Maximize2,
  Edit3,
  Search,
  Filter,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { fetchSubjects, createQuiz, parsePdfQuiz, createSubject } from '../services/api';
import FormattedContent from '../components/FormattedContent';

export default function CreateQuizPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('manual');
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Quick Subject Creator State
  const [isQuickSubjectOpen, setIsQuickSubjectOpen] = useState(false);
  const [quickSubjName, setQuickSubjName] = useState('');
  const [quickSubjCode, setQuickSubjCode] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [quickSubjError, setQuickSubjError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Questions for manual form with chapter / lesson tagging
  const [questions, setQuestions] = useState([
    {
      chapter: 'Bài 1',
      content: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      explanation_a: '',
      explanation_b: '',
      explanation_c: '',
      explanation_d: '',
    }
  ]);

  // Current active default chapter
  const [defaultChapter, setDefaultChapter] = useState('Bài 1');

  // File upload state (PDF, DOCX, TXT, MD)
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [aiDeepScan, setAiDeepScan] = useState(false);

  // Saving state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdQuiz, setCreatedQuiz] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Preview / Side-by-side Dual Viewer state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFiles, setPreviewFiles] = useState([]); // [{ file, name, size, url, ext }]
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [splitViewMode, setSplitViewMode] = useState('split'); // 'split' | 'doc' | 'questions'
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewChapterFilter, setPreviewChapterFilter] = useState('all');
  const [editingQuestionIdx, setEditingQuestionIdx] = useState(null);
  const [isSavingFromPreview, setIsSavingFromPreview] = useState(false);

  const isValidExamFile = (file) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return ['.pdf', '.docx', '.txt', '.md'].includes(ext);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedDocs = Array.from(e.dataTransfer.files).filter(isValidExamFile);
      if (droppedDocs.length === 0) {
        alert('Vui lòng chỉ thả các file định dạng được hỗ trợ: PDF (.pdf), Word (.docx), Văn bản (.txt, .md)!');
        return;
      }
      setPdfFiles(prev => [...prev, ...droppedDocs]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).filter(isValidExamFile);
      setPdfFiles(prev => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (index) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSubjects();
        setSubjects(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSubjects(false);
      }
    }
    load();
  }, []);

  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        chapter: defaultChapter || 'Bài 1',
        content: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        explanation_a: '',
        explanation_b: '',
        explanation_c: '',
        explanation_d: '',
      }
    ]);
  };

  const handleQuickCreateSubject = async (e) => {
    e.preventDefault();
    if (!quickSubjName.trim()) {
      setQuickSubjError('Vui lòng nhập tên chủ đề.');
      return;
    }

    setCreatingSubject(true);
    setQuickSubjError('');
    try {
      const newSubj = await createSubject({
        name: quickSubjName.trim(),
        code: quickSubjCode.trim() || undefined,
      });
      setSubjects(prev => [...prev, newSubj]);
      setSubjectId(newSubj.id.toString());
      setIsQuickSubjectOpen(false);
      setQuickSubjName('');
      setQuickSubjCode('');
    } catch (err) {
      setQuickSubjError(err.message || 'Lỗi khi tạo chủ đề mới.');
    } finally {
      setCreatingSubject(false);
    }
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      alert('Bộ đề cần có ít nhất 1 câu hỏi.');
      return;
    }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx, field, value) => {
    setQuestions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Submit Manual Quiz
  const handleSubmitManual = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề bộ đề.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content.trim() || !q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        alert(`Câu hỏi số ${i + 1} chưa điền đủ nội dung hoặc các đáp án A/B/C/D.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        subject_id: subjectId ? parseInt(subjectId) : null,
        is_public: isPublic,
        questions: questions.map(q => ({
          chapter: q.chapter?.trim() || 'Bài 1',
          content: q.content.trim(),
          option_a: q.option_a.trim(),
          option_b: q.option_b.trim(),
          option_c: q.option_c.trim(),
          option_d: q.option_d.trim(),
          correct_answer: q.correct_answer.toUpperCase(),
          explanation_a: q.explanation_a?.trim() || `Giải thích cho phương án A`,
          explanation_b: q.explanation_b?.trim() || `Giải thích cho phương án B`,
          explanation_c: q.explanation_c?.trim() || `Giải thích cho phương án C`,
          explanation_d: q.explanation_d?.trim() || `Giải thích cho phương án D`,
        }))
      };

      const res = await createQuiz(payload);
      setCreatedQuiz(res);
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu bộ đề');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse & enter side-by-side preview mode (No immediate DB save)
  const handleScanAndPreview = async (e) => {
    if (e) e.preventDefault();
    if (pdfFiles.length === 0) {
      alert('Vui lòng chọn hoặc kéo thả ít nhất 1 file để tải lên.');
      return;
    }

    setPdfParsing(true);
    try {
      const res = await parsePdfQuiz(pdfFiles, {
        title: title.trim() || undefined,
        subjectId: subjectId ? subjectId : undefined,
        autoSave: false,
        isPublic: isPublic,
        aiDeepScan: aiDeepScan
      });

      if (!res.questions || res.questions.length === 0) {
        alert('Không tìm thấy câu hỏi trắc nghiệm hợp lệ trong tài liệu đã chọn.');
        return;
      }

      // Generate local object URLs for live preview
      const fileObjs = pdfFiles.map(file => {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        let url = '';
        try {
          url = URL.createObjectURL(file);
        } catch (err) {}
        return {
          file,
          name: file.name,
          size: file.size,
          url,
          ext
        };
      });

      setPreviewFiles(fileObjs);
      setActiveFileIndex(0);
      setPreviewQuestions(res.questions);
      setPreviewTitle(title.trim() || res.title || (pdfFiles.length === 1 ? `Đề thi: ${pdfFiles[0].name.replace(/\.[^/.]+$/, '')}` : 'Bộ đề trắc nghiệm tổng hợp'));
      setIsPreviewMode(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.message || 'Lỗi khi phân tích file đề thi');
    } finally {
      setPdfParsing(false);
    }
  };

  const handleConfirmSaveFromPreview = async () => {
    if (!previewTitle.trim()) {
      alert('Vui lòng nhập tiêu đề bộ đề.');
      return;
    }
    if (previewQuestions.length === 0) {
      alert('Bộ đề cần có ít nhất 1 câu hỏi.');
      return;
    }

    setIsSavingFromPreview(true);
    try {
      const payload = {
        title: previewTitle.trim(),
        description: description.trim(),
        subject_id: subjectId ? parseInt(subjectId) : null,
        is_public: isPublic,
        questions: previewQuestions.map(q => ({
          chapter: q.chapter?.trim() || 'Bài 1',
          content: q.content?.trim() || '',
          option_a: q.option_a?.trim() || '',
          option_b: q.option_b?.trim() || '',
          option_c: q.option_c?.trim() || '',
          option_d: q.option_d?.trim() || '',
          correct_answer: (q.correct_answer || 'A').toUpperCase().trim(),
          explanation_a: q.explanation_a?.trim() || 'Giải thích cho phương án A',
          explanation_b: q.explanation_b?.trim() || 'Giải thích cho phương án B',
          explanation_c: q.explanation_c?.trim() || 'Giải thích cho phương án C',
          explanation_d: q.explanation_d?.trim() || 'Giải thích cho phương án D',
          image_url: q.image_url?.trim() || null
        }))
      };

      const res = await createQuiz(payload);
      previewFiles.forEach(f => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
      setIsPreviewMode(false);
      setCreatedQuiz(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu bộ đề');
    } finally {
      setIsSavingFromPreview(false);
    }
  };

  const handleExitPreview = () => {
    if (window.confirm('Bạn có chắc muốn quay lại màn hình chọn file? Các chỉnh sửa câu hỏi chưa lưu sẽ bị hủy.')) {
      previewFiles.forEach(f => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
      setIsPreviewMode(false);
    }
  };

  const handleUpdatePreviewQuestion = (idx, field, val) => {
    setPreviewQuestions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleQuickCorrectAnswer = (idx, letter) => {
    handleUpdatePreviewQuestion(idx, 'correct_answer', letter);
  };

  const handleDeletePreviewQuestion = (idx) => {
    if (previewQuestions.length <= 1) {
      alert('Bộ đề cần có ít nhất 1 câu hỏi.');
      return;
    }
    setPreviewQuestions(prev => prev.filter((_, i) => i !== idx));
    if (editingQuestionIdx === idx) {
      setEditingQuestionIdx(null);
    }
  };

  const handleAddPreviewQuestion = (targetChapter) => {
    const ch = (typeof targetChapter === 'string' && targetChapter.trim())
      ? targetChapter.trim()
      : (previewChapterFilter !== 'all' ? previewChapterFilter : (defaultChapter || 'Bài 1'));
    const newIdx = previewQuestions.length;
    setPreviewQuestions(prev => [
      ...prev,
      {
        chapter: ch,
        content: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        explanation_a: '',
        explanation_b: '',
        explanation_c: '',
        explanation_d: '',
        image_url: null
      }
    ]);
    setEditingQuestionIdx(newIdx);
    setTimeout(() => {
      const el = document.getElementById(`preview-q-${newIdx}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  // Submit PDF / File Upload (Direct Save without preview)
  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (pdfFiles.length === 0) {
      alert('Vui lòng chọn hoặc kéo thả ít nhất 1 file (PDF, Word, TXT, Markdown) để tải lên.');
      return;
    }

    setPdfParsing(true);
    try {
      const res = await parsePdfQuiz(pdfFiles, {
        title: title.trim() || undefined,
        subjectId: subjectId ? subjectId : undefined,
        autoSave: true,
        isPublic: isPublic,
        aiDeepScan: aiDeepScan
      });
      setCreatedQuiz(res.quiz || res);
    } catch (err) {
      alert(err.message || 'Lỗi khi phân tích file đề thi');
    } finally {
      setPdfParsing(false);
    }
  };

  // ================= SIDE-BY-SIDE DUAL VIEWER MODE =================
  if (isPreviewMode) {
    const activeDoc = previewFiles[activeFileIndex] || previewFiles[0];

    // Compute distinct chapters for filter
    const chaptersInPreview = Array.from(new Set(previewQuestions.map(q => q.chapter || 'Bài 1')));

    // Filter preview questions
    const filteredQuestions = previewQuestions
      .map((q, originalIdx) => ({ ...q, originalIdx }))
      .filter(q => {
        if (previewChapterFilter !== 'all' && (q.chapter || 'Bài 1') !== previewChapterFilter) return false;
        if (previewSearch.trim()) {
          const s = previewSearch.toLowerCase();
          const matchContent = (q.content || '').toLowerCase().includes(s);
          const matchOpt = ['a', 'b', 'c', 'd'].some(k => (q[`option_${k}`] || '').toLowerCase().includes(s));
          const matchChap = (q.chapter || '').toLowerCase().includes(s);
          return matchContent || matchOpt || matchChap;
        }
        return true;
      });

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
        {/* Sticky Dual Viewer Navigation Bar */}
        <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 shadow-sm">
          <div className="max-w-[1750px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left: Back & Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={handleExitPreview}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                title="Quay lại màn hình nạp file"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Chế độ Đối Chiếu Song Song
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {previewQuestions.length} câu đã bóc tách
                  </span>
                </div>
                <input
                  type="text"
                  value={previewTitle}
                  onChange={(e) => setPreviewTitle(e.target.value)}
                  placeholder="Tiêu đề bộ đề..."
                  className="w-full text-base sm:text-lg font-black text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 focus:border-indigo-600 focus:outline-none py-0.5"
                />
              </div>
            </div>

            {/* Right: Layout Switcher & Save Button */}
            <div className="flex items-center gap-2.5 shrink-0">
              
              {/* Split Mode Buttons */}
              <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSplitViewMode('split')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    splitViewMode === 'split'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Chia đôi màn hình: File gốc bên trái, câu hỏi bên phải"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Đối chiếu (50/50)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitViewMode('questions')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    splitViewMode === 'questions'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Mở rộng danh sách câu hỏi"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Chỉ câu hỏi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitViewMode('doc')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    splitViewMode === 'doc'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Mở rộng file gốc"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Chỉ file gốc</span>
                </button>
              </div>

              {/* Big Save Button */}
              <button
                type="button"
                onClick={handleConfirmSaveFromPreview}
                disabled={isSavingFromPreview}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSavingFromPreview ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" />
                    <span>Đang lưu vào hệ thống...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Xác nhận & Lưu Bộ Đề</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Studio Content Layout */}
        <div className="max-w-[1750px] mx-auto px-3 sm:px-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* LEFT COLUMN: ORIGINAL FILE VIEWER */}
            {(splitViewMode === 'split' || splitViewMode === 'doc') && (
              <div className={`${splitViewMode === 'doc' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-3`}>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  
                  {/* File Selector Tabs if multiple */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap">
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                      {previewFiles.map((f, fIdx) => (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => setActiveFileIndex(fIdx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            activeFileIndex === fIdx
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span className="uppercase text-[10px] font-mono px-1 py-0.2 bg-black/20 rounded">
                            {f.ext.replace('.', '')}
                          </span>
                          <span className="max-w-[130px] truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>

                    {activeDoc && (
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">
                        {(activeDoc.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>

                  {/* Document Display Canvas */}
                  <div className="w-full h-[calc(100vh-210px)] min-h-[550px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 flex flex-col">
                    {activeDoc && activeDoc.ext === '.pdf' && activeDoc.url ? (
                      <iframe
                        src={`${activeDoc.url}#toolbar=1&navpanes=0`}
                        title="Tài liệu đề thi gốc"
                        className="w-full h-full border-0 bg-slate-900"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/60">
                        <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <FileText className="w-8 h-8" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                          {activeDoc?.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
                          Tài liệu Word / Văn bản đã được trích xuất hoàn tất toàn bộ công thức toán OMML sang LaTeX và các hình vẽ minh hoạ vào bảng câu hỏi bên phải.
                        </p>
                        <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-left text-xs text-indigo-700 dark:text-indigo-300 max-w-md">
                          💡 <strong>Mẹo kiểm tra:</strong> Hãy đối chiếu từng câu hỏi ở cột bên phải, kiểm tra đáp án đúng (tô màu xanh) và chỉnh sửa nếu cần trước khi lưu vào cơ sở dữ liệu.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RIGHT COLUMN: EXTRACTED QUESTIONS & LIVE EDITOR */}
            {(splitViewMode === 'split' || splitViewMode === 'questions') && (
              <div className={`${splitViewMode === 'questions' ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-4`}>
                
                {/* Search & Filter Toolbar */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        placeholder="Tìm kiếm nội dung câu hỏi, đáp án..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Chapter Filter */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={previewChapterFilter}
                        onChange={(e) => setPreviewChapterFilter(e.target.value)}
                        className="w-full sm:w-44 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="all">Tất cả bài ({previewQuestions.length} câu)</option>
                        {chaptersInPreview.map(ch => (
                          <option key={ch} value={ch}>
                            {ch} ({previewQuestions.filter(q => (q.chapter || 'Bài 1') === ch).length} câu)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Add Question Button */}
                    <button
                      type="button"
                      onClick={() => handleAddPreviewQuestion()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-all"
                      title={previewChapterFilter !== 'all' ? `Thêm câu mới vào ${previewChapterFilter}` : 'Thêm câu hỏi mới'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{previewChapterFilter !== 'all' ? `Thêm vào ${previewChapterFilter}` : 'Thêm câu'}</span>
                    </button>
                  </div>

                  {/* Fast Jump Navigator Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                      Nhảy nhanh:
                    </span>
                    {previewQuestions.map((_, pIdx) => (
                      <a
                        key={pIdx}
                        href={`#preview-q-${pIdx}`}
                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0 transition"
                      >
                        {pIdx + 1}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-4 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                  {filteredQuestions.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                      <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy câu hỏi phù hợp</p>
                      <p className="text-xs text-slate-400 mt-1">Thử đổi từ khóa hoặc bộ lọc bài.</p>
                    </div>
                  ) : (
                    filteredQuestions.map((q) => {
                      const idx = q.originalIdx;
                      const isEditing = editingQuestionIdx === idx;
                      const correct = (q.correct_answer || 'A').toUpperCase();

                      return (
                        <div
                          id={`preview-q-${idx}`}
                          key={idx}
                          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-3.5 transition-all scroll-mt-24"
                        >
                          {/* Question Card Top Bar */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={q.chapter || 'Bài 1'}
                                onChange={(e) => handleUpdatePreviewQuestion(idx, 'chapter', e.target.value)}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none"
                                title="Đổi tên Bài / Chương cho câu hỏi này"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddPreviewQuestion(q.chapter || 'Bài 1')}
                                className="px-2 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                                title={`Thêm một câu hỏi mới vào cùng bài "${q.chapter || 'Bài 1'}"`}
                              >
                                <Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">Thêm câu cùng bài</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingQuestionIdx(isEditing ? null : idx)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                                  isEditing
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{isEditing ? 'Đóng sửa' : 'Sửa'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePreviewQuestion(idx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                title="Xóa câu hỏi này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* INLINE EDIT MODE */}
                          {isEditing ? (
                            <div className="space-y-3 pt-1">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Nội dung câu hỏi:
                                </label>
                                <textarea
                                  rows={3}
                                  value={q.content}
                                  onChange={(e) => handleUpdatePreviewQuestion(idx, 'content', e.target.value)}
                                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Ảnh minh hoạ (URL / đính kèm):
                                </label>
                                <input
                                  type="text"
                                  value={q.image_url || ''}
                                  onChange={(e) => handleUpdatePreviewQuestion(idx, 'image_url', e.target.value)}
                                  placeholder="VD: /uploads/questions/... hoặc link ảnh"
                                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {(['a', 'b', 'c', 'd']).map((letter) => {
                                  const upper = letter.toUpperCase();
                                  const isAns = correct === upper;
                                  return (
                                    <div key={letter} className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                          Đáp án {upper}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleQuickCorrectAnswer(idx, upper)}
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                            isAns
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                          }`}
                                        >
                                          {isAns ? '✓ ĐÚNG' : 'Chọn đúng'}
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        value={q[`option_${letter}`] || ''}
                                        onChange={(e) => handleUpdatePreviewQuestion(idx, `option_${letter}`, e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                                      />
                                      <input
                                        type="text"
                                        value={q[`explanation_${letter}`] || ''}
                                        onChange={(e) => handleUpdatePreviewQuestion(idx, `explanation_${letter}`, e.target.value)}
                                        placeholder={`Giải thích cho ${upper}...`}
                                        className="w-full px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-lg text-slate-500"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            /* VIEW MODE WITH KATEX & IMAGES */
                            <div className="space-y-3">
                              {/* Question Content */}
                              <div className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                                <FormattedContent text={q.content} imageUrl={q.image_url} />
                              </div>

                              {/* 4 Options Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                {(['a', 'b', 'c', 'd']).map((letter) => {
                                  const upper = letter.toUpperCase();
                                  const isCorrect = correct === upper;

                                  return (
                                    <div
                                      key={letter}
                                      onClick={() => handleQuickCorrectAnswer(idx, upper)}
                                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                                        isCorrect
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 font-bold text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100/70'
                                      }`}
                                      title={`Nhấp để chọn ${upper} làm đáp án đúng`}
                                    >
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                                        isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                      }`}>
                                        {upper}
                                      </span>
                                      <div className="flex-1 min-w-0 pt-0.5">
                                        <FormattedContent text={q[`option_${letter}`]} compact />
                                      </div>
                                      {isCorrect && (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                          ĐÚNG
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Bar in Right Column */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddPreviewQuestion}
                    className="px-4 py-2.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm câu hỏi mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSaveFromPreview}
                    disabled={isSavingFromPreview}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận & Lưu bộ đề</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  if (createdQuiz) {
    const shareUrl = `${window.location.origin}/quiz/${createdQuiz.share_code}`;
    const questionCount = createdQuiz.questions?.length || createdQuiz.question_count || (createdQuiz.quiz?.questions?.length) || 0;

    const handleCopy = () => {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            Đã tạo bộ đề trắc nghiệm thành công!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Bộ đề <span className="font-bold text-slate-800 dark:text-slate-200">"{createdQuiz.title}"</span> đã được lưu vào hệ thống{questionCount > 0 ? ` với ${questionCount} câu hỏi` : ''}.
          </p>

          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 mb-6 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
              Mã chia sẻ (Share Code)
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-extrabold text-indigo-700 dark:text-indigo-300">
                {createdQuiz.share_code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs sm:text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Đã chép' : 'Sao chép link'}</span>
            </button>
          </div>

          {/* Primary View Action Button */}
          <Link
            to={`/quiz/${createdQuiz.share_code}`}
            className="w-full mb-3 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Eye className="w-5 h-5" />
            <span>Xem Chi Tiết & Danh Sách Câu Hỏi Đã Tạo</span>
          </Link>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link
              to={`/quiz/${createdQuiz.share_code}/practice`}
              className="py-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs sm:text-sm border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-1.5"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Vào Luyện tập ngay</span>
            </Link>
            <Link
              to={`/quiz/${createdQuiz.share_code}/exam`}
              className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Vào Thi thử ngay</span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <button
              onClick={() => {
                setCreatedQuiz(null);
                setTitle('');
                setDescription('');
                setPdfFiles([]);
              }}
              className="font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo thêm bộ đề khác</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <Link
              to="/"
              className="font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Về Trang chủ</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại trang chủ</span>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
          Tạo Bộ Đề Trắc Nghiệm Mới
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Hỗ trợ phân chia câu hỏi theo từng **Bài / Chương / Chủ đề** để học riêng từng bài hoặc thi thử trộn lộn xộn các bài.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Nhập thủ công theo Bài</span>
        </button>

        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'pdf'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Quét từ File (PDF / Word / TXT / MD)</span>
        </button>
      </div>

      {/* COMMON METADATA */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm mb-8 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          Thông tin cơ bản của bộ đề
        </h2>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Tiêu đề bộ đề <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Trắc nghiệm Tổng hợp Giáo dục Quốc phòng HP2..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Môn học / Chủ đề
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickSubjectOpen(true);
                    setQuickSubjError('');
                  }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tạo chủ đề mới</span>
                </button>
              </div>
            </div>

            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Bộ đề tự do / Khác --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Mô tả ngắn
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Đề thi chia theo từng bài từ bài 1 đến bài 5..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* PRIVACY SELECTOR */}
        <div className="pt-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Quyền riêng tư bộ đề
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                isPublic
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-600 ring-2 ring-indigo-600/20'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                isPublic ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${isPublic ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                  Công khai (Public)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Hiển thị trên Trang Chủ và Danh Mục cho mọi người tham gia học & thi thử.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                !isPublic
                  ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                !isPublic ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${!isPublic ? 'text-amber-950 dark:text-amber-200' : 'text-slate-800 dark:text-slate-200'}`}>
                  Riêng tư (Private)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Chỉ bạn và người có liên kết / mã chia sẻ (Share Code) mới có thể vào làm bài.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Quick Subject Creator Modal */}
        {isQuickSubjectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-w-sm w-full shadow-2xl relative">
              <button
                type="button"
                onClick={() => setIsQuickSubjectOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Tạo Nhanh Chủ Đề Mới
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Chủ đề sẽ được tự động chọn sau khi tạo
                  </p>
                </div>
              </div>

              {quickSubjError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{quickSubjError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tên môn học / Chủ đề <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSubjName}
                    onChange={(e) => setQuickSubjName(e.target.value)}
                    placeholder="VD: Triết học Mác-Lênin..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Mã môn học (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={quickSubjCode}
                    onChange={(e) => setQuickSubjCode(e.target.value)}
                    placeholder="VD: MARX_PHIL..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickSubjectOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateSubject}
                    disabled={creatingSubject}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {creatingSubject ? 'Đang tạo...' : 'Tạo & Chọn'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: MANUAL BUILDER WITH CHAPTER SELECTION */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSubmitManual} className="space-y-6">
          
          {/* Quick Chapter Creator Banner */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                Tên Bài / Chương đang soạn:
              </span>
              <span className="text-xs text-slate-500">Các câu hỏi thêm mới sẽ tự động gán vào bài này</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={defaultChapter}
                onChange={(e) => setDefaultChapter(e.target.value)}
                placeholder="VD: Bài 1, Bài 2..."
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu vào {defaultChapter}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4 relative"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.chapter || 'Bài 1'}
                      onChange={(e) => handleQuestionChange(idx, 'chapter', e.target.value)}
                      placeholder="Tên Bài (VD: Bài 1)..."
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Xóa câu hỏi này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Nội dung câu hỏi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={q.content}
                    onChange={(e) => handleQuestionChange(idx, 'content', e.target.value)}
                    placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['a', 'b', 'c', 'd']).map((letter) => {
                    const upperLetter = letter.toUpperCase();
                    return (
                      <div key={letter} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Phương án {upperLetter}
                          </label>
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 cursor-pointer">
                            <input
                              type="radio"
                              name={`correct_${idx}`}
                              checked={q.correct_answer === upperLetter}
                              onChange={() => handleQuestionChange(idx, 'correct_answer', upperLetter)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Đáp án đúng</span>
                          </label>
                        </div>

                        <input
                          type="text"
                          required
                          value={q[`option_${letter}`]}
                          onChange={(e) => handleQuestionChange(idx, `option_${letter}`, e.target.value)}
                          placeholder={`Nội dung đáp án ${upperLetter}...`}
                          className={`w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none ${
                            q.correct_answer === upperLetter
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-400'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}
                        />

                        <input
                          type="text"
                          value={q[`explanation_${letter}`]}
                          onChange={(e) => handleQuestionChange(idx, `explanation_${letter}`, e.target.value)}
                          placeholder={`Giải thích chi tiết vì sao ${upperLetter} đúng/sai...`}
                          className="w-full px-3 py-1.5 text-xs bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-lg text-slate-600 dark:text-slate-400 focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 font-semibold text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm câu hỏi mới</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu bộ đề...' : 'Hoàn tất & Sinh mã chia sẻ'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: MULTI-FORMAT FILE UPLOAD & AI DEEP SCAN */}
      {activeTab === 'pdf' && (
        <form onSubmit={handlePdfUpload} className="space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 scale-[1.01]'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
            }`}
          >
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Kéo & Thả hoặc Chọn tài liệu đề thi
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-4">
              Tải lên một hoặc nhiều tài liệu cùng lúc. Hệ thống tự động bóc tách từng câu hỏi, các phương án A/B/C/D, nhận diện đáp án in đậm / gạch chân / bôi màu và chia theo từng bài.
            </p>

            {/* Supported format badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                PDF (.pdf)
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                Word (.docx)
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                Văn bản (.txt)
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                Markdown (.md)
              </span>
            </div>

            <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
              <FileText className="w-4 h-4" />
              <span>Chọn các file từ máy tính</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            {pdfFiles.length > 0 && (
              <div className="mt-6 text-left max-w-xl mx-auto bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Đã chọn {pdfFiles.length} file tài liệu:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPdfFiles([])}
                    className="text-xs text-rose-500 hover:underline font-semibold"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pdfFiles.map((file, idx) => {
                    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    const badgeColor =
                      ext === '.docx' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' :
                      ext === '.pdf' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300' :
                      ext === '.md' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300' :
                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300';

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${badgeColor}`}>
                            {ext.replace('.', '')}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors shrink-0"
                          title="Bỏ file này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI DEEP SCAN TOGGLE CARD */}
          <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-violet-500/10 dark:from-amber-950/20 dark:via-indigo-950/30 dark:to-violet-950/20 rounded-3xl border border-amber-300/40 dark:border-amber-700/40 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Chế độ Quét Sâu AI (Gemini 1.5 Flash)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Kích hoạt mô hình AI để nhận diện các đề thi định dạng khó: công thức Toán LaTeX (<code className="text-indigo-600 dark:text-indigo-400">$...$</code>), code lập trình, bảng biểu, ảnh tài liệu scan, hoặc văn bản không theo mẫu chuẩn.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {aiDeepScan ? 'Bật Quét Sâu' : 'Quét Thường (Regex)'}
                </span>
                <button
                  type="button"
                  onClick={() => setAiDeepScan(!aiDeepScan)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    aiDeepScan ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={aiDeepScan}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      aiDeepScan ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={pdfParsing || pdfFiles.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
              title="Tự động bóc tách và lưu ngay không qua màn hình đối chiếu"
            >
              <Save className="w-4 h-4" />
              <span>Lưu trực tiếp (Không đối chiếu)</span>
            </button>

            <button
              type="button"
              onClick={handleScanAndPreview}
              disabled={pdfParsing || pdfFiles.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:opacity-95 text-white font-bold text-sm shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {pdfParsing ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin text-amber-300" />
                  <span>
                    {aiDeepScan
                      ? `AI đang phân tích sâu ${pdfFiles.length} file tài liệu...`
                      : `Đang phân tích ${pdfFiles.length} file...`}
                  </span>
                </>
              ) : (
                <>
                  <Columns className="w-4 h-4 text-indigo-200" />
                  <span>
                    {aiDeepScan
                      ? `Quét Sâu AI & Đối Chiếu File Gốc (${pdfFiles.length})`
                      : `Quét & Đối Chiếu Với File Gốc (${pdfFiles.length})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
