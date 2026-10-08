const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') + '/api';

export async function fetchSubjects() {
  const res = await fetch(`${API_BASE}/subjects`);
  if (!res.ok) throw new Error('Không thể tải danh sách môn học');
  return res.json();
}

export async function fetchQuizzes({ subjectId = null, search = '' } = {}) {
  const params = new URLSearchParams();
  if (subjectId) params.append('subject_id', subjectId);
  if (search) params.append('search', search);

  const url = `${API_BASE}/quizzes${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải danh sách bộ đề');
  return res.json();
}

export async function fetchQuizDetail(shareCode) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(shareCode)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Bộ đề không tồn tại hoặc đã bị xóa.');
    throw new Error('Lỗi khi tải chi tiết bộ đề.');
  }
  return res.json();
}

export async function deleteQuiz(identifier) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa bộ đề.');
  }
  return res.json();
}

export function getQuizPdfExportUrl(shareCode, options = {}) {
  const params = new URLSearchParams();
  if (options.chapter && options.chapter !== 'all') params.append('chapter', options.chapter);
  if (options.schoolName) params.append('school_name', options.schoolName);
  if (options.examDuration) params.append('exam_duration', options.examDuration);
  if (options.includeAnswers) params.append('include_answers', options.includeAnswers);
  if (options.includeExplanations !== undefined) params.append('include_explanations', options.includeExplanations);
  if (options.twoColumnOptions !== undefined) params.append('two_column_options', options.twoColumnOptions);

  return `${API_BASE}/quizzes/${encodeURIComponent(shareCode)}/export-pdf${params.toString() ? `?${params.toString()}` : ''}`;
}

export async function createQuiz(quizData) {
  const res = await fetch(`${API_BASE}/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quizData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi tạo bộ đề mới.');
  }
  return res.json();
}

export async function submitQuizAttempt(quizId, submissionData) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submissionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi nộp bài thi.');
  }
  return res.json();
}

export async function parsePdfQuiz(files, { title, subjectId, autoSave = true }) {
  const formData = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach(f => {
    formData.append('files', f);
  });
  if (title) formData.append('title', title);
  if (subjectId) formData.append('subject_id', subjectId);
  formData.append('auto_save', autoSave);

  const res = await fetch(`${API_BASE}/pdf/parse`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi phân tích file PDF.');
  }
  return res.json();
}

export async function appendPdfToQuiz(shareCode, files, chapterName = '') {
  const formData = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach(f => {
    formData.append('files', f);
  });
  if (chapterName) formData.append('chapter_name', chapterName);

  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(shareCode)}/append-pdf`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi thêm bài mới từ PDF.');
  }
  return res.json();
}

export async function createSubject(subjectData) {
  const res = await fetch(`${API_BASE}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subjectData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi tạo chủ đề mới.');
  }
  return res.json();
}

export async function updateSubject(subjectId, subjectData) {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subjectData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cập nhật chủ đề.');
  }
  return res.json();
}

export async function deleteSubject(subjectId) {
  const res = await fetch(`${API_BASE}/subjects/${subjectId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa chủ đề.');
  }
  return res.json();
}
