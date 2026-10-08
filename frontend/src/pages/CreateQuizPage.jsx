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
  Home
} from 'lucide-react';
import { fetchSubjects, createQuiz, parsePdfQuiz, createSubject } from '../services/api';

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

  // PDF upload state
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);

  // Saving state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdQuiz, setCreatedQuiz] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedPdfs = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (droppedPdfs.length === 0) {
        alert('Vui lòng chỉ thả các file định dạng .pdf!');
        return;
      }
      setPdfFiles(prev => [...prev, ...droppedPdfs]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
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

  // Submit PDF Upload
  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (pdfFiles.length === 0) {
      alert('Vui lòng chọn hoặc kéo thả ít nhất 1 file PDF để tải lên.');
      return;
    }

    setPdfParsing(true);
    try {
      const res = await parsePdfQuiz(pdfFiles, {
        title: title.trim() || undefined,
        subjectId: subjectId ? subjectId : undefined,
        autoSave: true
      });
      setCreatedQuiz(res.quiz || res);
    } catch (err) {
      alert(err.message || 'Lỗi khi phân tích file PDF');
    } finally {
      setPdfParsing(false);
    }
  };

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
          <span>Tải file PDF (Tự động nhận diện Bài)</span>
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

      {/* TAB 2: PDF UPLOAD */}
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
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Kéo & Thả hoặc Chọn một/nhiều file PDF
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Bạn có thể tải lên một hoặc nhiều file PDF cùng lúc (ví dụ: <code className="text-indigo-600 dark:text-indigo-400 font-mono">chuong-1.pdf, chuong-2.pdf</code>). Hệ thống sẽ tự động gộp và phân chia theo từng bài.
            </p>

            <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
              <FileText className="w-4 h-4" />
              <span>Chọn các file PDF từ máy tính</span>
              <input
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            {pdfFiles.length > 0 && (
              <div className="mt-6 text-left max-w-lg mx-auto bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Đã chọn {pdfFiles.length} file PDF:
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
                  {pdfFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
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
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pdfParsing || pdfFiles.length === 0}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold text-sm shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {pdfParsing
                  ? `Đang phân tích ${pdfFiles.length} file & tạo bộ đề...`
                  : `Phân tích ${pdfFiles.length > 0 ? `${pdfFiles.length} file ` : ''}PDF & Tạo Bộ Đề`}
              </span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
