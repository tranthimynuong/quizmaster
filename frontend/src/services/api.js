const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') + '/api';

export function getAuthToken() {
  return localStorage.getItem('quizmaster_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('quizmaster_token', token);
  } else {
    localStorage.removeItem('quizmaster_token');
  }
}

export function getAuthHeaders(isJson = true) {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ================= AUTH SERVICES =================
export async function loginUser(credentials) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Đăng nhập không thành công.');
  }
  return res.json();
}

export async function registerUser(userData) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Đăng ký không thành công.');
  }
  return res.json();
}

export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setAuthToken(null);
      return null;
    }
    throw new Error('Không thể tải thông tin người dùng.');
  }
  return res.json();
}

export async function updateUserProfile(profileData) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể cập nhật thông tin.');
  }
  return res.json();
}

export async function changePassword(passwordData) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(passwordData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể đổi mật khẩu.');
  }
  return res.json();
}

// ================= USER MANAGEMENT (ADMIN) =================
export async function createAdminUser(userData) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = 'Không thể tạo người dùng mới.';
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ');
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchAdminUsers({ search = '', role = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);

  const url = `${API_BASE}/users${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải danh sách người dùng.');
  }
  return res.json();
}

export async function updateUserRole(userId, role) {
  const res = await fetch(`${API_BASE}/users/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể đổi vai trò.');
  }
  return res.json();
}

export async function updateUserStatus(userId, isActive) {
  const res = await fetch(`${API_BASE}/users/${userId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể cập nhật trạng thái.');
  }
  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xóa người dùng.');
  }
  return res.json();
}

// ================= QUIZ SERVICES =================
export async function fetchSubjects() {
  const res = await fetch(`${API_BASE}/subjects`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Không thể tải danh sách môn học');
  return res.json();
}

export async function fetchQuizzes({ subjectId = null, search = '' } = {}) {
  const params = new URLSearchParams();
  if (subjectId) params.append('subject_id', subjectId);
  if (search) params.append('search', search);

  const url = `${API_BASE}/quizzes${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Không thể tải danh sách bộ đề');
  return res.json();
}

export async function fetchMyQuizzes() {
  const res = await fetch(`${API_BASE}/quizzes/my/created`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải đề thi cá nhân.');
  }
  return res.json();
}

export async function fetchMyHistory() {
  const res = await fetch(`${API_BASE}/quizzes/my/history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải lịch sử làm bài.');
  }
  return res.json();
}

export async function fetchQuizDetail(shareCode) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(shareCode)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Bộ đề không tồn tại hoặc đã bị xóa.');
    throw new Error('Lỗi khi tải chi tiết bộ đề.');
  }
  return res.json();
}

export async function deleteQuiz(identifier) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa bộ đề.');
  }
  return res.json();
}

export async function updateQuiz(identifier, quizData) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(quizData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cập nhật thông tin bộ đề.');
  }
  return res.json();
}

export async function renameQuizChapter(identifier, oldChapterName, newChapterName) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}/rename-chapter`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      old_chapter_name: oldChapterName,
      new_chapter_name: newChapterName
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi đổi tên bài/chương.');
  }
  return res.json();
}

export async function updateQuizQuestion(identifier, questionId, questionData) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}/questions/${questionId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(questionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi cập nhật câu hỏi.');
  }
  return res.json();
}

export async function deleteQuizQuestion(identifier, questionId) {
  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(identifier)}/questions/${questionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa câu hỏi.');
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
    body: JSON.stringify(submissionData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi nộp bài thi.');
  }
  return res.json();
}

export async function parsePdfQuiz(files, { title, subjectId, autoSave = true, isPublic = true }) {
  const formData = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach(f => {
    formData.append('files', f);
  });
  if (title) formData.append('title', title);
  if (subjectId) formData.append('subject_id', subjectId);
  formData.append('auto_save', autoSave);
  formData.append('is_public', isPublic);

  const headers = getAuthHeaders(false);

  const res = await fetch(`${API_BASE}/pdf/parse`, {
    method: 'POST',
    headers,
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

  const headers = getAuthHeaders(false);

  const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(shareCode)}/append-pdf`, {
    method: 'POST',
    headers,
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi xóa chủ đề.');
  }
  return res.json();
}
