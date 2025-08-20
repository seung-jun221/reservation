// monitoring-v2.js - 개선된 VIP 설명회 예약 모니터링 시스템

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
let isMobile = window.innerWidth <= 768;
let currentDropdownId = null;

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

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('모니터링 v2 초기화');

  // 모바일 체크
  checkDevice();
  window.addEventListener('resize', checkDevice);

  // 초기 데이터 로드
  await loadData();

  // 실시간 구독
  setupRealtimeSubscription();

  // 이벤트 리스너
  setupEventListeners();

  // 자동 새로고침 (30초)
  setInterval(() => {
    if (!isLoading) {
      loadData(false);
    }
  }, 30000);
});

// ===== 디바이스 체크 =====
function checkDevice() {
  const wasMobile = isMobile;
  isMobile = window.innerWidth <= 768;

  if (wasMobile !== isMobile) {
    // 디바이스 변경 시 UI 재렌더링
    updateTable();
  }
}

// ===== 데이터 로드 =====
async function loadData(showLoadingState = true) {
  if (isLoading) return;

  isLoading = true;
  if (showLoadingState) {
    showLoading(true);
  }
  updateConnectionStatus('connecting');

  try {
    // 1. 설명회 정보 로드
    const { data: seminars, error: seminarError } = await supabase
      .from('seminars')
      .select('*')
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (seminarError) throw seminarError;

    seminarSchedule = seminars || [];
    console.log('설명회 로드:', seminarSchedule.length, '개');

    // 2. 예약 정보 로드
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (reservationError) throw reservationError;

    allReservations = reservations || [];
    console.log('예약 로드:', allReservations.length, '개');

    // 3. UI 업데이트
    updateSeminarFilter();
    updateStats();
    updateSeminarStats();
    applyFilters();
    updateConnectionStatus('connected');
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    showToast('데이터를 불러올 수 없습니다.', 'error');
    updateConnectionStatus('offline');
  } finally {
    isLoading = false;
    if (showLoadingState) {
      showLoading(false);
    }
  }
}

// ===== 실시간 구독 =====
function setupRealtimeSubscription() {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }

  realtimeSubscription = supabase
    .channel('reservations-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations' },
      (payload) => {
        console.log('실시간 변경:', payload);
        handleRealtimeChange(payload);
      }
    )
    .subscribe((status) => {
      console.log('구독 상태:', status);
      if (status === 'SUBSCRIBED') {
        updateConnectionStatus('connected');
      }
    });
}

// ===== 실시간 변경 처리 =====
function handleRealtimeChange(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  switch (eventType) {
    case 'INSERT':
      allReservations.unshift(newRecord);
      showToast('새로운 예약이 추가되었습니다!', 'success');
      break;

    case 'UPDATE':
      const index = allReservations.findIndex((r) => r.id === newRecord.id);
      if (index !== -1) {
        allReservations[index] = newRecord;
      }
      break;

    case 'DELETE':
      allReservations = allReservations.filter((r) => r.id !== oldRecord.id);
      break;
  }

  // UI 업데이트
  updateStats();
  updateSeminarStats();
  applyFilters();
}

// ===== 통계 업데이트 =====
function updateStats() {
  const stats = {
    total: 0,
    attended: 0,
    pending: 0,
    cancelled: 0,
  };

  allReservations.forEach((r) => {
    if (r.status === '예약') stats.pending++;
    else if (r.status === '참석') stats.attended++;
    else if (r.status === '취소') stats.cancelled++;

    if (r.status !== '대기') stats.total++;
  });

  // 미니 카드 업데이트
  animateNumber('totalAll', stats.total);
  animateNumber('totalAttended', stats.attended);
  animateNumber('totalPending', stats.pending);
  animateNumber('totalCancelled', stats.cancelled);
}

// ===== 설명회별 통계 =====
function updateSeminarStats() {
  const statsHtml = [];
  const listHtml = [];

  seminarSchedule.forEach((seminar, index) => {
    const reservations = allReservations.filter(
      (r) =>
        r.seminar_id === seminar.id &&
        r.status !== '취소' &&
        r.status !== '대기'
    );
    const count = reservations.length;
    const capacity = seminar.display_capacity || seminar.max_capacity;
    const percent = Math.round((count / capacity) * 100);

    // 지역명 추출
    const location = seminar.title.split('-').pop()?.trim() || seminar.title;

    // 날짜 포맷
    const date = new Date(seminar.date);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    // 색상 결정
    let colorClass = '';
    if (percent >= 80) colorClass = 'danger';
    else if (percent >= 50) colorClass = 'warning';

    // 차트 뷰용 카드
    statsHtml.push(`
      <div class="seminar-card">
        <div class="seminar-card-header">
          <div>
            <div class="seminar-card-title">${location}</div>
            <div class="seminar-card-date">${dateStr} ${seminar.time.substring(
      0,
      5
    )}</div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${percent}%"></div>
        </div>
        <div class="seminar-card-stats">
          <span class="seminar-card-count">${count} / ${capacity}명</span>
          <span class="seminar-card-percent">${percent}%</span>
        </div>
      </div>
    `);

    // 리스트 뷰용
    listHtml.push(`
      <div class="seminar-list-item">
        <span class="seminar-list-name">${location}</span>
        <span class="seminar-list-date">${dateStr}</span>
        <span class="seminar-list-count">${count}/${capacity}</span>
        <span class="seminar-list-percent ${colorClass}">${percent}%</span>
      </div>
    `);
  });

  const seminarCards = document.getElementById('seminarCards');
  if (seminarCards) seminarCards.innerHTML = statsHtml.join('');

  const seminarList = document.getElementById('seminarList');
  if (seminarList) seminarList.innerHTML = listHtml.join('');
}

// ===== 통계 뷰 토글 =====
function toggleStatsView(view) {
  const chartView = document.getElementById('chartView');
  const listView = document.getElementById('listView');
  const buttons = document.querySelectorAll('.view-toggle .toggle-btn');

  buttons.forEach((btn) => btn.classList.remove('active'));

  if (view === 'chart') {
    chartView.classList.remove('hidden');
    listView.classList.add('hidden');
    buttons[0].classList.add('active');
  } else {
    chartView.classList.add('hidden');
    listView.classList.remove('hidden');
    buttons[1].classList.add('active');
  }
}

// ===== 필터 토글 =====
function toggleFilters() {
  const panel = document.getElementById('filterPanel');
  if (isMobile) {
    panel.classList.toggle('expanded');
  } else {
    panel.classList.toggle('collapsed');
  }
}

// ===== 빠른 필터 (모바일) =====
function quickFilter(type) {
  // 버튼 활성화 처리
  document.querySelectorAll('.quick-filter-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // 필터 적용
  switch (type) {
    case 'all':
      currentFilters.status = '';
      break;
    case 'reserved':
      currentFilters.status = '예약';
      break;
    case 'attended':
      currentFilters.status = '참석';
      break;
    case 'waitlist':
      currentFilters.status = '대기';
      break;
  }

  // 상태 필터 셀렉트도 업데이트
  document.getElementById('filterStatus').value = currentFilters.status;

  applyFilters();
}

// ===== 필터 적용 =====
function applyFilters() {
  // 필터 값 가져오기
  currentFilters = {
    seminar: document.getElementById('filterSeminar').value,
    status: document.getElementById('filterStatus').value,
    studentName: document.getElementById('searchStudent').value.toLowerCase(),
    phone:
      document.getElementById('searchPhone')?.value.replace(/-/g, '') || '',
    school: document.getElementById('searchSchool')?.value.toLowerCase() || '',
  };

  // 필터링
  filteredReservations = allReservations.filter((r) => {
    if (currentFilters.seminar && r.seminar_id !== currentFilters.seminar)
      return false;
    if (currentFilters.status && r.status !== currentFilters.status)
      return false;
    if (
      currentFilters.studentName &&
      !r.student_name.toLowerCase().includes(currentFilters.studentName)
    )
      return false;
    if (currentFilters.phone && !r.parent_phone.includes(currentFilters.phone))
      return false;
    if (
      currentFilters.school &&
      !r.school.toLowerCase().includes(currentFilters.school)
    )
      return false;
    return true;
  });

  // 테이블 업데이트
  updateTable();
}

// ===== 필터 초기화 =====
function resetFilters() {
  document.getElementById('filterSeminar').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('searchStudent').value = '';

  const phoneInput = document.getElementById('searchPhone');
  if (phoneInput) phoneInput.value = '';

  const schoolInput = document.getElementById('searchSchool');
  if (schoolInput) schoolInput.value = '';

  // 빠른 필터 초기화
  document.querySelectorAll('.quick-filter-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector('.quick-filter-btn').classList.add('active');

  applyFilters();
  showToast('필터가 초기화되었습니다.');
}

// ===== 테이블 업데이트 =====
function updateTable() {
  const desktopTable = document.querySelector('.desktop-table');
  const mobileList = document.querySelector('.mobile-list');
  const emptyState = document.getElementById('emptyState');
  const tbody = document.getElementById('desktopTableBody');
  const mobileContainer = document.getElementById('mobileList');

  // 먼저 기존 데이터를 모두 비움
  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (filteredReservations.length === 0) {
    // 데이터가 없을 때
    if (emptyState) emptyState.classList.remove('hidden');
    if (desktopTable) desktopTable.classList.add('hidden');
    if (mobileList) mobileList.classList.add('hidden');
    return;
  }

  // 데이터가 있을 때
  if (emptyState) emptyState.classList.add('hidden');

  if (isMobile) {
    if (mobileList) mobileList.classList.remove('hidden');
    if (desktopTable) desktopTable.classList.add('hidden');
    updateMobileList();
  } else {
    if (desktopTable) desktopTable.classList.remove('hidden');
    if (mobileList) mobileList.classList.add('hidden');
    updateDesktopTable();
  }
}

// ===== 데스크톱 테이블 업데이트 =====
function updateDesktopTable() {
  const tbody = document.getElementById('desktopTableBody');
  if (!tbody) return;

  tbody.innerHTML = filteredReservations
    .map((r, index) => {
      const seminar = seminarSchedule.find((s) => s.id === r.seminar_id);
      const isChecked = selectedRows.has(r.id);

      // 지역명만 추출
      const location = seminar
        ? seminar.title.split('-').pop()?.trim().substring(0, 2) || '기타'
        : '-';

      // 날짜 간소화
      const dateTime = r.registered_at
        ? new Date(r.registered_at)
            .toLocaleDateString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            .replace(/\. /g, '.')
            .replace(/\./g, '/')
            .substring(0, 14)
        : '-';

      return `
      <tr class="${isChecked ? 'selected' : ''}" id="row-${r.id}">
        <td class="checkbox-col">
          <input type="checkbox" 
                 value="${r.id}" 
                 ${isChecked ? 'checked' : ''}
                 onchange="toggleRowSelection(${r.id})">
        </td>
        <td>${index + 1}</td>
        <td title="${r.reservation_id}">${r.reservation_id}</td>
        <td title="${seminar ? seminar.title : '-'}">${location}</td>
        <td>${r.student_name}</td>
        <td>${formatPhoneNumber(r.parent_phone)}</td>
        <td title="${r.school}">${r.school}</td>
        <td>${r.grade}</td>
        <td title="${r.math_level || '-'}">${r.math_level || '-'}</td>
        <td>${dateTime}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td class="action-col">
          <button class="dropdown-btn" onclick="toggleDropdown(event, ${
            r.id
          })" title="액션">
            ⋮
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

// ===== 모바일 리스트 업데이트 =====
function updateMobileList() {
  const container = document.getElementById('mobileList');
  if (!container) return;

  container.innerHTML = filteredReservations
    .map((r) => {
      const seminar = seminarSchedule.find((s) => s.id === r.seminar_id);
      const isChecked = selectedRows.has(r.id);

      // 지역명 추출 (2글자)
      const location = seminar
        ? seminar.title.split('-').pop()?.trim().substring(0, 2) || '기타'
        : '기타';

      return `
      <div class="mobile-card ${isChecked ? 'selected' : ''}" id="mobile-${
        r.id
      }">
        <div class="mobile-card-row">
          <div class="mobile-card-info">
            <span class="mobile-card-seminar">${location}</span>
            <span class="mobile-card-divider">|</span>
            <span class="mobile-card-name">${r.student_name}</span>
            <span class="mobile-card-divider">|</span>
            <span class="mobile-card-school">${r.school}</span>
            <span class="mobile-card-divider">|</span>
            <span class="mobile-card-grade">${r.grade}</span>
          </div>
          ${getStatusBadge(r.status)}
        </div>
      </div>
    `;
    })
    .join('');
}

// ===== 드롭다운 토글 =====
function toggleDropdown(event, reservationId) {
  event.stopPropagation();

  const dropdown = document.getElementById('dropdownMenu');
  const btn = event.target;
  const rect = btn.getBoundingClientRect();

  // 현재 예약 ID 저장
  currentDropdownId = reservationId;

  // 드롭다운 위치 설정
  dropdown.style.top = rect.bottom + window.scrollY + 'px';
  dropdown.style.left =
    Math.min(rect.left - 130, window.innerWidth - 200) + 'px';

  // 표시/숨김 토글
  dropdown.classList.toggle('hidden');
}

// ===== 드롭다운 액션 처리 =====
function handleDropdownAction(action) {
  const dropdown = document.getElementById('dropdownMenu');
  dropdown.classList.add('hidden');

  if (!currentDropdownId) return;

  switch (action) {
    case 'edit':
      openEditModal(currentDropdownId);
      break;
    case 'attend':
      updateAttendance(currentDropdownId, '참석');
      break;
    case 'absent':
      updateAttendance(currentDropdownId, '불참');
      break;
    case 'cancel':
      updateAttendance(currentDropdownId, '취소');
      break;
  }

  currentDropdownId = null;
}

// ===== 상태 배지 =====
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

    // 로컬 업데이트
    const reservation = allReservations.find((r) => r.id === id);
    if (reservation) {
      reservation.status = status;
      reservation.attendance = status;
    }

    // UI 업데이트
    updateStats();
    updateSeminarStats();
    applyFilters();
    showToast(`${status} 처리되었습니다.`, 'success');
  } catch (error) {
    console.error('참석 상태 업데이트 실패:', error);
    showToast('처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 행 선택 =====
function toggleRowSelection(id) {
  if (selectedRows.has(id)) {
    selectedRows.delete(id);
    document.getElementById(`row-${id}`)?.classList.remove('selected');
    document.getElementById(`mobile-${id}`)?.classList.remove('selected');
  } else {
    selectedRows.add(id);
    document.getElementById(`row-${id}`)?.classList.add('selected');
    document.getElementById(`mobile-${id}`)?.classList.add('selected');
  }

  updateSelectionBar();
}

// ===== 전체 선택 =====
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll(
    '#desktopTableBody input[type="checkbox"]'
  );

  if (selectAll.checked) {
    checkboxes.forEach((cb) => {
      cb.checked = true;
      const id = parseInt(cb.value);
      selectedRows.add(id);
      document.getElementById(`row-${id}`)?.classList.add('selected');
    });
  } else {
    clearSelection();
  }

  updateSelectionBar();
}

// ===== 선택 초기화 =====
function clearSelection() {
  selectedRows.clear();
  document.querySelectorAll('.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
  updateSelectionBar();
}

// ===== 선택 바 업데이트 =====
function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  const count = document.getElementById('selectedCount');

  if (bar && count) {
    if (selectedRows.size > 0) {
      bar.classList.remove('hidden');
      count.textContent = selectedRows.size;
    } else {
      bar.classList.add('hidden');
    }
  }
}

// ===== 일괄 업데이트 =====
async function bulkUpdate(status) {
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

    // 로컬 업데이트
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
    updateSeminarStats();
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

// ===== 편집 모달 =====
function openEditModal(id) {
  const reservation = allReservations.find((r) => r.id === id);
  if (!reservation) return;

  // 폼 채우기
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

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
  document.getElementById('editForm').reset();
}

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

    // 로컬 업데이트
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

// ===== 엑셀 다운로드 =====
function exportToExcel() {
  let csv = '\uFEFF'; // BOM
  csv +=
    '번호,예약번호,설명회,학생명,연락처,학교,학년,수학선행,예약일시,상태,참석여부,메모\n';

  filteredReservations.forEach((r, index) => {
    const seminar = seminarSchedule.find((s) => s.id === r.seminar_id);
    csv += `${index + 1},`;
    csv += `"${r.reservation_id}",`;
    csv += `"${seminar ? seminar.title : '-'}",`;
    csv += `"${r.student_name}",`;
    csv += `"${formatPhoneNumber(r.parent_phone)}",`;
    csv += `"${r.school}",`;
    csv += `"${r.grade}",`;
    csv += `"${r.math_level || '-'}",`;
    csv += `"${formatDateTime(r.registered_at)}",`;
    csv += `"${r.status}",`;
    csv += `"${r.attendance || '-'}",`;
    csv += `"${r.notes || '-'}"\n`;
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

  // FAB 메뉴 닫기
  if (isMobile) {
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu) fabMenu.classList.add('hidden');
  }
}

// ===== FAB 메뉴 토글 =====
function toggleFabMenu() {
  const menu = document.getElementById('fabMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function showBulkActions() {
  // 일괄 선택 모드 활성화
  document.querySelectorAll('.mobile-card').forEach((card) => {
    card.style.cursor = 'pointer';
    card.onclick = function () {
      const id = parseInt(this.id.replace('mobile-', ''));
      toggleRowSelection(id);
    };
  });

  showToast('카드를 탭하여 선택하세요');
  const fabMenu = document.getElementById('fabMenu');
  if (fabMenu) fabMenu.classList.add('hidden');
}

// ===== 유틸리티 함수들 =====

// 새로고침
function refreshData() {
  loadData();
  showToast('데이터를 새로고침했습니다.');
}

// 설명회 필터 업데이트
function updateSeminarFilter() {
  const select = document.getElementById('filterSeminar');
  if (!select) return;

  select.innerHTML = '<option value="">전체 설명회</option>';

  seminarSchedule.forEach((seminar) => {
    const option = document.createElement('option');
    option.value = seminar.id;
    option.textContent = `${formatDateShort(seminar.date)} ${seminar.title}`;
    select.appendChild(option);
  });
}

// 숫자 애니메이션
function animateNumber(elementId, target) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const current = parseInt(element.textContent) || 0;
  if (current === target) return;

  const increment = target > current ? 1 : -1;
  const step = Math.abs(target - current) / 20;

  let value = current;
  const timer = setInterval(() => {
    value += increment * Math.ceil(step);
    if (
      (increment > 0 && value >= target) ||
      (increment < 0 && value <= target)
    ) {
      value = target;
      clearInterval(timer);
    }
    element.textContent = value;
  }, 30);
}

// 날짜 포맷팅
function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

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

// 연결 상태 업데이트
function updateConnectionStatus(status) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  if (statusDot && statusText) {
    statusDot.className = 'status-dot';

    switch (status) {
      case 'connected':
        statusDot.classList.add('connected');
        statusText.textContent = '실시간';
        break;
      case 'connecting':
        statusText.textContent = '연결중';
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
  const loadingState = document.getElementById('loadingState');
  const desktopTable = document.querySelector('.desktop-table');
  const mobileList = document.querySelector('.mobile-list');
  const emptyState = document.getElementById('emptyState');

  if (show) {
    if (loadingState) loadingState.classList.remove('hidden');
    if (desktopTable) desktopTable.classList.add('hidden');
    if (mobileList) mobileList.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
  } else {
    if (loadingState) loadingState.classList.add('hidden');
    // 로딩이 끝나면 updateTable이 호출되므로 여기서는 숨김 처리만
  }
}

// 빈 상태 표시 - 이 함수들은 더 이상 필요 없으므로 제거하거나 단순화
function showEmptyState() {
  const emptyState = document.getElementById('emptyState');
  const desktopTable = document.querySelector('.desktop-table');
  const mobileList = document.querySelector('.mobile-list');

  if (emptyState) emptyState.classList.remove('hidden');
  if (desktopTable) desktopTable.classList.add('hidden');
  if (mobileList) mobileList.classList.add('hidden');
}

function hideEmptyState() {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.classList.add('hidden');

  if (isMobile) {
    const mobileList = document.querySelector('.mobile-list');
    if (mobileList) mobileList.classList.remove('hidden');
  } else {
    const desktopTable = document.querySelector('.desktop-table');
    if (desktopTable) desktopTable.classList.remove('hidden');
  }
}

// 토스트 메시지
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== 이벤트 리스너 설정 =====
function setupEventListeners() {
  // 필터 이벤트
  const filterSeminar = document.getElementById('filterSeminar');
  if (filterSeminar) {
    filterSeminar.addEventListener('change', applyFilters);
  }

  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', applyFilters);
  }

  // 검색 이벤트 (Enter 키)
  ['searchStudent', 'searchPhone', 'searchSchool'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    }
  });

  // 문서 클릭 이벤트 (드롭다운 닫기)
  document.addEventListener('click', function (e) {
    // 드롭다운 메뉴 닫기
    if (
      !e.target.closest('.dropdown-btn') &&
      !e.target.closest('#dropdownMenu')
    ) {
      const dropdown = document.getElementById('dropdownMenu');
      if (dropdown) dropdown.classList.add('hidden');
    }

    // FAB 메뉴 닫기
    if (!e.target.closest('.fab-container')) {
      const fabMenu = document.getElementById('fabMenu');
      if (fabMenu) fabMenu.classList.add('hidden');
    }
  });
}

// ===== 페이지 언로드 시 정리 =====
window.addEventListener('beforeunload', () => {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }
});
