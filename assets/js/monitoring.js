// monitoring.js - VIP 설명회 예약 모니터링 시스템

// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 변수 =====
let allReservations = [];
let seminarSchedule = [];
let filteredReservations = [];
let selectedRows = new Set();
let currentFilters = {
  seminar: '',
  status: '',
  studentName: '',
  phone: '',
  school: '',
};
let isLoading = false;
let realtimeSubscription = null;

// 페이지 강제 새로고침 (캐시된 경우)
if (performance.navigation.type === 2) {
  location.reload(true);
}

// 버전 체크 (옵션)
const APP_VERSION = '20250820';
const savedVersion = localStorage.getItem('app_version');
if (savedVersion !== APP_VERSION) {
  localStorage.clear();
  localStorage.setItem('app_version', APP_VERSION);
  if (savedVersion) {
    location.reload(true);
  }
}

// ===== 페이지 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('모니터링 페이지 초기화');

  // 초기 로드
  await loadData();

  // 실시간 구독 설정
  setupRealtimeSubscription();

  // 이벤트 리스너 설정
  setupEventListeners();
});

// ===== 데이터 로드 =====
async function loadData() {
  if (isLoading) return;

  isLoading = true;
  showLoading(true);
  updateConnectionStatus('connecting');

  try {
    // 1. 설명회 정보 로드
    const { data: seminars, error: seminarError } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: true });

    if (seminarError) throw seminarError;

    seminarSchedule = seminars || [];
    console.log('설명회 로드:', seminarSchedule);

    // 2. 예약 정보 로드 - created_at을 registered_at으로 변경
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (reservationError) throw reservationError;

    allReservations = reservations || [];
    console.log('예약 로드:', allReservations);

    // 3. UI 업데이트
    updateSeminarFilter();
    updateStats();
    applyFilters();
    updateLastUpdate();
    updateConnectionStatus('connected');
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    showToast('데이터를 불러올 수 없습니다.', 'error');
    updateConnectionStatus('offline');
  } finally {
    isLoading = false;
    showLoading(false);
  }
}
async function loadData() {
  if (isLoading) return;

  isLoading = true;
  showLoading(true);
  updateConnectionStatus('connecting');

  try {
    // 1. 설명회 정보 로드
    const { data: seminars, error: seminarError } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: true });

    if (seminarError) throw seminarError;

    seminarSchedule = seminars || [];
    console.log('설명회 로드:', seminarSchedule);

    // 2. 예약 정보 로드 - created_at을 registered_at으로 변경
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (reservationError) throw reservationError;

    allReservations = reservations || [];
    console.log('예약 로드:', allReservations);

    // 3. UI 업데이트
    updateSeminarFilter();
    updateStats();
    applyFilters();
    updateLastUpdate();
    updateConnectionStatus('connected');
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    showToast('데이터를 불러올 수 없습니다.', 'error');
    updateConnectionStatus('offline');
  } finally {
    isLoading = false;
    showLoading(false);
  }
}

// ===== 실시간 구독 설정 =====
function setupRealtimeSubscription() {
  // 기존 구독 정리
  if (realtimeSubscription) {
    console.log('기존 구독 해제');
    realtimeSubscription.unsubscribe();
  }

  console.log('새 Realtime 구독 시작...');

  // 새 구독 설정
  realtimeSubscription = supabase
    .channel('custom-all-channel') // 채널명 변경
    .on(
      'postgres_changes',
      {
        event: 'INSERT', // INSERT 먼저 테스트
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        console.log('🔔 INSERT 감지:', payload);
        // 새 예약 추가
        allReservations.unshift(payload.new);
        updateStats();
        applyFilters();
        showToast('새로운 예약이 추가되었습니다!', 'success');
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        console.log('🔔 UPDATE 감지:', payload);
        const index = allReservations.findIndex(
          (r) => r.reservation_id === payload.new.reservation_id
        );
        if (index !== -1) {
          allReservations[index] = payload.new;
          updateStats();
          applyFilters();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        console.log('🔔 DELETE 감지:', payload);
        allReservations = allReservations.filter(
          (r) => r.reservation_id !== payload.old.reservation_id
        );
        updateStats();
        applyFilters();
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error('❌ 구독 에러:', err);
      } else {
        console.log('📡 구독 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 구독 성공!');
          updateConnectionStatus('connected');
        }
      }
    });
}

// ===== 실시간 변경 처리 =====
function handleRealtimeChange(payload) {
  console.log('실시간 변경:', payload);

  if (payload.eventType === 'INSERT') {
    // 새 예약 추가
    allReservations.unshift(payload.new);
    showToast('새로운 예약이 추가되었습니다.', 'success');
  } else if (payload.eventType === 'UPDATE') {
    // 예약 업데이트 - id 대신 reservation_id 사용 가능
    const index = allReservations.findIndex(
      (r) => r.reservation_id === payload.new.reservation_id
    );
    if (index !== -1) {
      allReservations[index] = payload.new;
    }
  } else if (payload.eventType === 'DELETE') {
    // 예약 삭제
    allReservations = allReservations.filter(
      (r) => r.reservation_id !== payload.old.reservation_id
    );
  }

  // UI 업데이트
  updateStats();
  applyFilters();
}

// ===== 이벤트 리스너 설정 =====
function setupEventListeners() {
  // 필터 이벤트
  document
    .getElementById('filterSeminar')
    .addEventListener('change', applyFilters);
  document
    .getElementById('filterStatus')
    .addEventListener('change', applyFilters);

  // 검색 이벤트 (Enter 키)
  ['searchStudentName', 'searchPhone', 'searchSchool'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    }
  });

  // 전체 선택 체크박스
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', toggleSelectAll);
  }
}

// ===== 설명회 필터 업데이트 =====
function updateSeminarFilter() {
  const select = document.getElementById('filterSeminar');
  select.innerHTML = '<option value="">전체 설명회</option>';

  seminarSchedule.forEach((seminar) => {
    const option = document.createElement('option');
    option.value = seminar.id;
    option.textContent = `${formatDateShort(seminar.date)} ${seminar.title}`;
    select.appendChild(option);
  });
}

// ===== 통계 업데이트 =====
function updateStats() {
  let stats = {
    total: 0,
    attended: 0,
    pending: 0,
    waitlist: 0,
  };

  allReservations.forEach((reservation) => {
    if (
      reservation.status === '예약' ||
      reservation.status === '참석' ||
      reservation.status === '불참'
    ) {
      stats.total++;

      if (reservation.status === '참석') {
        stats.attended++;
      } else if (reservation.status === '예약') {
        stats.pending++;
      }
    } else if (reservation.status === '대기') {
      stats.waitlist++;
    }
  });

  // 통계 카드 업데이트
  document.getElementById('totalReservations').textContent = stats.total;
  document.getElementById('totalAttended').textContent = stats.attended;
  document.getElementById('totalPending').textContent = stats.pending;
  document.getElementById('totalWaitlist').textContent = stats.waitlist;
}

// ===== 필터 적용 =====
function applyFilters() {
  // 필터 값 가져오기
  currentFilters = {
    seminar: document.getElementById('filterSeminar').value,
    status: document.getElementById('filterStatus').value,
    studentName: document
      .getElementById('searchStudentName')
      .value.toLowerCase(),
    phone: document.getElementById('searchPhone').value.replace(/-/g, ''),
    school: document.getElementById('searchSchool').value.toLowerCase(),
  };

  // 필터링
  filteredReservations = allReservations.filter((reservation) => {
    // 설명회 필터
    if (
      currentFilters.seminar &&
      reservation.seminar_id !== currentFilters.seminar
    ) {
      return false;
    }

    // 상태 필터
    if (currentFilters.status && reservation.status !== currentFilters.status) {
      return false;
    }

    // 학생명 검색
    if (
      currentFilters.studentName &&
      !reservation.student_name
        .toLowerCase()
        .includes(currentFilters.studentName)
    ) {
      return false;
    }

    // 전화번호 검색
    if (
      currentFilters.phone &&
      !reservation.parent_phone.includes(currentFilters.phone)
    ) {
      return false;
    }

    // 학교 검색
    if (
      currentFilters.school &&
      !reservation.school.toLowerCase().includes(currentFilters.school)
    ) {
      return false;
    }

    return true;
  });

  // 테이블 업데이트
  updateTable();

  // 결과 개수 표시
  document.getElementById(
    'recordInfo'
  ).textContent = `전체 ${filteredReservations.length}건`;
}

// ===== 필터 초기화 =====
function resetFilters() {
  document.getElementById('filterSeminar').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('searchStudentName').value = '';
  document.getElementById('searchPhone').value = '';
  document.getElementById('searchSchool').value = '';

  applyFilters();
  showToast('필터가 초기화되었습니다.');
}

// ===== 테이블 업데이트 =====
function updateTable() {
  const tbody = document.getElementById('tableBody');

  if (filteredReservations.length === 0) {
    tbody.innerHTML = '';
    document.getElementById('noDataContainer').classList.remove('hidden');
    document.getElementById('dataTable').classList.add('hidden');
    return;
  }

  document.getElementById('noDataContainer').classList.add('hidden');
  document.getElementById('dataTable').classList.remove('hidden');

  tbody.innerHTML = filteredReservations
    .map((reservation, index) => {
      const seminar = seminarSchedule.find(
        (s) => s.id === reservation.seminar_id
      );
      const isChecked = selectedRows.has(reservation.id);

      return `
            <tr class="${isChecked ? 'selected' : ''}" id="row-${
        reservation.id
      }">
                <td class="checkbox-column">
                    <input type="checkbox" 
                           value="${reservation.id}" 
                           ${isChecked ? 'checked' : ''}
                           onchange="toggleRowSelection(${reservation.id})">
                </td>
                <td>${index + 1}</td>
                <td>${reservation.reservation_id}</td>
                <td>${seminar ? seminar.title : '-'}</td>
                <td>${highlightText(
                  reservation.student_name,
                  currentFilters.studentName
                )}</td>
                <td>${formatPhoneNumber(reservation.parent_phone)}</td>
                <td>${highlightText(
                  reservation.school,
                  currentFilters.school
                )}</td>
                <td>${reservation.grade}</td>
                <td>${reservation.math_level || '-'}</td>
                <td>${formatDateTime(reservation.registered_at)}</td>
                <td>${getStatusBadge(reservation.status)}</td>
                <td>${reservation.attendance || '-'}</td>
                <td>${getActionButtons(reservation)}</td>
            </tr>
        `;
    })
    .join('');
}

// ===== 상태 배지 생성 =====
function getStatusBadge(status) {
  const badges = {
    예약: '<span class="status-badge reserved">예약</span>',
    참석: '<span class="status-badge attended">참석</span>',
    불참: '<span class="status-badge absent">불참</span>',
    취소: '<span class="status-badge cancelled">취소</span>',
    대기: '<span class="status-badge waitlist">대기</span>',
  };
  return badges[status] || status;
}

// ===== 액션 버튼 생성 =====
function getActionButtons(reservation) {
  if (reservation.status === '참석' || reservation.status === '불참') {
    return `<span style="font-size: 12px; color: #666;">${reservation.status} 처리됨</span>`;
  }

  return `
        <div class="action-buttons">
            <button class="action-btn attend" onclick="updateAttendance(${reservation.id}, '참석')">참석</button>
            <button class="action-btn absent" onclick="updateAttendance(${reservation.id}, '불참')">불참</button>
            <button class="action-btn edit" onclick="openEditModal(${reservation.id})">수정</button>
        </div>
    `;
}

// ===== 참석 상태 업데이트 =====
async function updateAttendance(id, status) {
  if (!confirm(`${status} 처리하시겠습니까?`)) return;

  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        status: status,
        attendance: status,
        attendance_checked_at: new Date().toISOString(),
        attendance_checked_by: '관리자',
      })
      .eq('id', id);

    if (error) throw error;

    // 로컬 데이터 업데이트
    const reservation = allReservations.find((r) => r.id === id);
    if (reservation) {
      reservation.status = status;
      reservation.attendance = status;
    }

    // UI 업데이트
    updateStats();
    applyFilters();
    showToast(`${status} 처리되었습니다.`, 'success');
  } catch (error) {
    console.error('참석 상태 업데이트 실패:', error);
    showToast('처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 편집 모달 열기 =====
function openEditModal(id) {
  const reservation = allReservations.find((r) => r.id === id);
  if (!reservation) return;

  // 모달에 데이터 채우기
  document.getElementById('editId').value = reservation.id;
  document.getElementById('editStudentName').value = reservation.student_name;
  document.getElementById('editPhone').value = formatPhoneNumber(
    reservation.parent_phone
  );
  document.getElementById('editSchool').value = reservation.school;
  document.getElementById('editGrade').value = reservation.grade;
  document.getElementById('editMathLevel').value = reservation.math_level || '';
  document.getElementById('editNotes').value = reservation.notes || '';

  // 모달 표시
  document.getElementById('editModal').classList.remove('hidden');
}

// ===== 편집 모달 닫기 =====
function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
  document.getElementById('editForm').reset();
}

// ===== 편집 저장 =====
async function saveEdit() {
  const id = document.getElementById('editId').value;
  const updates = {
    student_name: document.getElementById('editStudentName').value,
    parent_phone: document.getElementById('editPhone').value.replace(/-/g, ''),
    school: document.getElementById('editSchool').value,
    grade: document.getElementById('editGrade').value,
    math_level: document.getElementById('editMathLevel').value,
    notes: document.getElementById('editNotes').value,
  };

  try {
    const { error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // 로컬 데이터 업데이트
    const reservation = allReservations.find((r) => r.id === parseInt(id));
    if (reservation) {
      Object.assign(reservation, updates);
    }

    // UI 업데이트
    applyFilters();
    closeEditModal();
    showToast('수정되었습니다.', 'success');
  } catch (error) {
    console.error('수정 실패:', error);
    showToast('수정 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 행 선택 토글 =====
function toggleRowSelection(id) {
  if (selectedRows.has(id)) {
    selectedRows.delete(id);
    document.getElementById(`row-${id}`).classList.remove('selected');
  } else {
    selectedRows.add(id);
    document.getElementById(`row-${id}`).classList.add('selected');
  }

  updateBulkActions();
}

// ===== 전체 선택 토글 =====
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll(
    '#tableBody input[type="checkbox"]'
  );

  if (selectAll.checked) {
    checkboxes.forEach((cb) => {
      cb.checked = true;
      const id = parseInt(cb.value);
      selectedRows.add(id);
      document.getElementById(`row-${id}`).classList.add('selected');
    });
  } else {
    clearSelection();
  }

  updateBulkActions();
}

// ===== 선택 초기화 =====
function clearSelection() {
  selectedRows.clear();
  document
    .querySelectorAll('#tableBody input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
    });
  document.querySelectorAll('#tableBody tr').forEach((row) => {
    row.classList.remove('selected');
  });
  document.getElementById('selectAll').checked = false;
  updateBulkActions();
}

// ===== 일괄 작업 UI 업데이트 =====
function updateBulkActions() {
  const bulkActions = document.getElementById('bulkActions');
  const selectedCount = document.getElementById('selectedCount');

  if (selectedRows.size > 0) {
    bulkActions.classList.remove('hidden');
    selectedCount.textContent = selectedRows.size;
  } else {
    bulkActions.classList.add('hidden');
  }
}

// ===== 일괄 상태 업데이트 =====
async function bulkUpdateStatus(status) {
  if (selectedRows.size === 0) {
    showToast('선택된 항목이 없습니다.', 'warning');
    return;
  }

  if (
    !confirm(`선택한 ${selectedRows.size}개 항목을 ${status} 처리하시겠습니까?`)
  ) {
    return;
  }

  try {
    const promises = Array.from(selectedRows).map((id) =>
      supabase
        .from('reservations')
        .update({
          status: status,
          attendance: status === '취소' ? null : status,
          attendance_checked_at: new Date().toISOString(),
          attendance_checked_by: '관리자',
        })
        .eq('id', id)
    );

    await Promise.all(promises);

    // 로컬 데이터 업데이트
    selectedRows.forEach((id) => {
      const reservation = allReservations.find((r) => r.id === id);
      if (reservation) {
        reservation.status = status;
        if (status !== '취소') {
          reservation.attendance = status;
        }
      }
    });

    // UI 업데이트
    clearSelection();
    updateStats();
    applyFilters();
    showToast(
      `${selectedRows.size}개 항목이 ${status} 처리되었습니다.`,
      'success'
    );
  } catch (error) {
    console.error('일괄 처리 실패:', error);
    showToast('처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 엑셀 다운로드 =====
function exportToExcel() {
  // CSV 형식으로 데이터 생성
  let csv = '\uFEFF'; // BOM 추가 (한글 깨짐 방지)
  csv +=
    '번호,예약번호,설명회,학생명,연락처,학교,학년,수학 선행정도,예약일시,상태,참석여부,메모\n';

  filteredReservations.forEach((reservation, index) => {
    const seminar = seminarSchedule.find(
      (s) => s.id === reservation.seminar_id
    );
    csv += `${index + 1},`;
    csv += `"${reservation.reservation_id}",`;
    csv += `"${seminar ? seminar.title : '-'}",`;
    csv += `"${reservation.student_name}",`;
    csv += `"${formatPhoneNumber(reservation.parent_phone)}",`;
    csv += `"${reservation.school}",`;
    csv += `"${reservation.grade}",`;
    csv += `"${reservation.math_level || '-'}",`;
    csv += `"${formatDateTime(reservation.registered_at)}",`;
    csv += `"${reservation.status}",`;
    csv += `"${reservation.attendance || '-'}",`;
    csv += `"${reservation.notes || '-'}"\n`;
  });

  // 다운로드
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `VIP_설명회_예약_${new Date().toLocaleDateString(
    'ko-KR'
  )}.csv`;
  link.click();

  showToast('엑셀 파일이 다운로드됩니다.');
}

// ===== 새로고침 =====
function refreshData() {
  loadData();
}

// ===== 유틸리티 함수들 =====

// 날짜 포맷팅 (짧은 형식)
function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 날짜 포맷팅
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${
    date.getMonth() + 1
  }월 ${date.getDate()}일(${days[date.getDay()]})`;
}

// 시간 포맷팅
function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}시${minutes !== '00' ? ` ${minutes}분` : ''}`;
}

// 날짜시간 포맷팅
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const date = new Date(dateTimeStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 전화번호 포맷팅
function formatPhoneNumber(phone) {
  if (!phone) return '-';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(
      3,
      7
    )}-${cleaned.substring(7, 11)}`;
  }
  return phone;
}

// 텍스트 하이라이트
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;

  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// 정규식 특수문자 이스케이프
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 마지막 업데이트 시간 표시
function updateLastUpdate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ko-KR');
  const dateStr = now.toLocaleDateString('ko-KR');
  const element = document.getElementById('lastUpdate');
  if (element) {
    element.textContent = `마지막 업데이트: ${dateStr} ${timeStr}`;
  }
}

// 연결 상태 업데이트
function updateConnectionStatus(status) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  if (statusDot && statusText) {
    statusDot.className = 'status-dot';

    switch (status) {
      case 'connected':
        statusDot.classList.add('connected');
        statusText.textContent = '연결됨';
        break;
      case 'connecting':
        statusDot.classList.add('connecting');
        statusText.textContent = '연결중...';
        break;
      case 'offline':
        statusDot.classList.add('offline');
        statusText.textContent = '오프라인';
        break;
    }
  }
}

// 로딩 표시
function showLoading(show) {
  const loadingContainer = document.getElementById('loadingContainer');
  const dataTable = document.getElementById('dataTable');

  if (show) {
    if (loadingContainer) loadingContainer.classList.remove('hidden');
    if (dataTable) dataTable.classList.add('hidden');
  } else {
    if (loadingContainer) loadingContainer.classList.add('hidden');
    if (dataTable) dataTable.classList.remove('hidden');
  }
}

// 토스트 메시지
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast show';

  if (type === 'success') {
    toast.classList.add('success');
  } else if (type === 'error') {
    toast.classList.add('error');
  } else if (type === 'warning') {
    toast.classList.add('warning');
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== 페이지 언로드 시 정리 =====
window.addEventListener('beforeunload', () => {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }
});
