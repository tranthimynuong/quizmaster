import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  FolderPlus
} from 'lucide-react';
import { fetchSubjects, createSubject, updateSubject, deleteSubject } from '../services/api';

export default function SubjectsPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSubjects();
      setSubjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormName('');
    setFormCode('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subj) => {
    setEditingSubject(subj);
    setFormName(subj.name);
    setFormCode(subj.code);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('Vui lòng nhập tên chủ đề / môn học.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, {
          name: formName.trim(),
          code: formCode.trim() || undefined,
        });
      } else {
        await createSubject({
          name: formName.trim(),
          code: formCode.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi lưu chủ đề.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (subj) => {
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa chủ đề "${subj.name}"?\n\nLưu ý: Các bộ đề thuộc chủ đề này vẫn được giữ nguyên và chuyển thành "Bộ đề tự do".`
    );
    if (!confirmDelete) return;

    try {
      await deleteSubject(subj.id);
      loadData();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa chủ đề.');
    }
  };

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <span>Quản Lý Chủ Đề & Môn Học</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Phân loại các bộ đề thi trắc nghiệm theo từng môn học, chuyên đề đào tạo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Chủ Đề Mới</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Tìm theo tên hoặc mã môn học..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Subject Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Đang tải danh sách chủ đề...</p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            Không tìm thấy chủ đề nào
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Hãy tạo chủ đề mới để dễ dàng gom nhóm các bộ đề ôn tập.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            + Tạo chủ đề đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map((subj) => (
            <div
              key={subj.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                    {subj.code}
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(subj)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Chỉnh sửa chủ đề"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(subj)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Xóa chủ đề"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
                  {subj.name}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Hiện có <strong className="text-slate-800 dark:text-slate-200">{subj.quiz_count}</strong> bộ đề
                  </span>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <Link
                  to={`/?subject=${subj.id}`}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Xem các bộ đề</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  to="/create"
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  + Thêm đề vào môn này
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {editingSubject ? 'Chỉnh Sửa Chủ Đề' : 'Thêm Chủ Đề Mới'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingSubject ? 'Cập nhật tên hoặc mã môn học' : 'Tạo phân loại mới cho kho đề thi'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tên Chủ Đề / Môn Học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Kinh tế Vĩ mô, Lập trình Python..."
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Mã môn học (Tùy chọn)
                  </label>
                  <span className="text-[11px] text-slate-400">Tự tạo nếu để trống</span>
                </div>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="VD: ECON_MACRO, PYTHON_DEV..."
                  className="w-full px-4 py-2.5 text-sm font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : editingSubject ? 'Cập nhật' : 'Tạo Chủ Đề'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
