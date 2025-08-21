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

// ===== 페이지네이션 관련 변수 =====
let currentPage = 1;
let entriesPerPage = 20;
let totalPages = 1;

// ===== 전환율 분석 관련 변수 =====
let funnelData = {
  visit: 0,
  select: 0,
  phone: 0,
  reservation: 0,
  attendance: 0,
  consulting: 0,
};

let funnelPeriod = 'week';

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

  // 전환율 분석 추가
  await loadFunnelData();
  await loadCheckinData();

  // 실시간 구독
  setupRealtimeSubscription();

  // 이벤트 리스너
  setupEventListeners();

  // 자동 새로고침 제거 (Supabase Realtime 사용)
  // 30초 자동 새로고침 제거됨
});

// ===== 디바이스 체크 =====
function checkDevice() {
  const wasMobile = isMobile;
  isMobile = window.innerWidth <= 768;

  if (wasMobile !== isMobile) {
    // 디바이스 변경 시 UI 재렌더링
    updateTable();

    // 모바일일 때 페이지당 항목 수 조정
    if (isMobile) {
      entriesPerPage = 10;
      document.getElementById('entriesPerPageMobile').value = '10';
    } else {
      entriesPerPage = 20;
      document.getElementById('entriesPerPage').value = '20';
    }
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

    // 3. 현재 필터 상태 저장
    const savedFilters = { ...currentFilters };
    const savedSeminarValue = document.getElementById('filterSeminar')?.value;

    // 4. UI 업데이트
    updateSeminarFilter();

    // 5. 필터 상태 복원
    if (savedSeminarValue) {
      document.getElementById('filterSeminar').value = savedSeminarValue;
      currentFilters.seminar = savedSeminarValue;
    }
    Object.assign(currentFilters, savedFilters);

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

// ===== 전환율 데이터 로드 =====
async function loadFunnelData() {
  try {
    console.log('전환율 데이터 로드 시작...');

    // 기간 설정
    const endDate = new Date();
    let startDate = new Date();

    switch (funnelPeriod) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'all':
        startDate = new Date('2025-01-01');
        break;
    }

    // 실제 예약 데이터만 사용
    const totalReservations = allReservations.filter(
      (r) =>
        new Date(r.registered_at) >= startDate &&
        new Date(r.registered_at) <= endDate
    ).length;

    const confirmedReservations = allReservations.filter(
      (r) =>
        r.status === '예약' &&
        new Date(r.registered_at) >= startDate &&
        new Date(r.registered_at) <= endDate
    ).length;

    const attendedReservations = allReservations.filter(
      (r) =>
        r.status === '참석' &&
        new Date(r.registered_at) >= startDate &&
        new Date(r.registered_at) <= endDate
    ).length;

    // 실제 데이터 기반 퍼널 (추정치)
    funnelData = {
      visit: totalReservations * 10, // GA 연동 필요
      select: totalReservations * 5, // 이벤트 추적 필요
      phone: totalReservations * 2, // 이벤트 추적 필요
      reservation: totalReservations,
      attendance: attendedReservations,
      consulting: 0, // 컨설팅 API 연동 필요
    };

    updateFunnelUI();
    updateConversionCards();
  } catch (error) {
    console.error('전환율 데이터 로드 실패:', error);
    showEmptyFunnelState();
  }
}

// 빈 전환율 상태 표시
function showEmptyFunnelState() {
  document.querySelectorAll('[id$="Count"]').forEach((el) => {
    if (el) el.textContent = '0';
  });
  document.querySelectorAll('[id$="Rate"]').forEach((el) => {
    if (el) el.textContent = '0%';
  });
  document.querySelectorAll('[id$="Conversion"]').forEach((el) => {
    if (el) el.textContent = '0%';
  });
}

// 퍼널 UI 업데이트
function updateFunnelUI() {
  const stages = [
    'visit',
    'select',
    'phone',
    'reservation',
    'attendance',
    'consulting',
  ];

  stages.forEach((stage, index) => {
    const count = funnelData[stage];
    const percentage =
      funnelData.visit > 0 ? (count / funnelData.visit) * 100 : 0;

    const countElement = document.getElementById(`${stage}Count`);
    if (countElement) {
      animateNumber(countElement, count);
    }

    const rateElement = document.getElementById(`${stage}Rate`);
    if (rateElement && stage !== 'visit') {
      rateElement.textContent = `${percentage.toFixed(1)}%`;
    }

    // 단계별 전환율 추가
    if (index > 0) {
      const prevStage = stages[index - 1];
      const conversionRate =
        funnelData[prevStage] > 0
          ? ((funnelData[stage] / funnelData[prevStage]) * 100).toFixed(1)
          : '0';

      const conversionElement = document.getElementById(
        `${prevStage}To${stage.charAt(0).toUpperCase() + stage.slice(1)}Rate`
      );
      if (conversionElement) {
        conversionElement.textContent = `${conversionRate}%`;
      }
    }
  });
}

// 전환율 카드 업데이트
function updateConversionCards() {
  const bookingRate =
    funnelData.visit > 0
      ? ((funnelData.reservation / funnelData.visit) * 100).toFixed(1)
      : '0.0';
  const bookingElement = document.getElementById('bookingConversion');
  if (bookingElement) bookingElement.textContent = `${bookingRate}%`;

  const attendanceRate =
    funnelData.reservation > 0
      ? ((funnelData.attendance / funnelData.reservation) * 100).toFixed(1)
      : '0.0';
  const attendanceElement = document.getElementById('attendanceConversion');
  if (attendanceElement) attendanceElement.textContent = `${attendanceRate}%`;

  const consultingRate =
    funnelData.attendance > 0
      ? ((funnelData.consulting / funnelData.attendance) * 100).toFixed(1)
      : '0.0';
  const consultingElement = document.getElementById('consultingConversion');
  if (consultingElement) consultingElement.textContent = `${consultingRate}%`;

  const finalRate =
    funnelData.visit > 0
      ? ((funnelData.consulting / funnelData.visit) * 100).toFixed(2)
      : '0.00';
  const finalElement = document.getElementById('finalConversion');
  if (finalElement) finalElement.textContent = `${finalRate}%`;
}

// 숫자 애니메이션
function animateNumber(element, target) {
  const start = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
  const duration = 1000;
  const steps = 30;
  const increment = (target - start) / steps;
  let current = start;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    current += increment;

    if (step >= steps) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, duration / steps);
}

// 체크인 데이터 로드
async function loadCheckinData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayCheckins, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('attendance_status', 'attended')
      .gte('check_in_time', today.toISOString())
      .order('check_in_time', { ascending: false });

    if (error) throw error;

    const checkinElement = document.getElementById('todayCheckins');
    if (checkinElement) checkinElement.textContent = todayCheckins?.length || 0;

    const { data: pending } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'confirmed')
      .is('attendance_status', null)
      .gte('seminar_date', today.toISOString());

    const pendingElement = document.getElementById('pendingCheckins');
    if (pendingElement) pendingElement.textContent = pending?.length || 0;

    if (todayCheckins && todayCheckins.length > 0) {
      updateRecentCheckins(todayCheckins.slice(0, 5));
    }
  } catch (error) {
    console.error('체크인 데이터 로드 실패:', error);
  }
}

// 최근 체크인 목록 업데이트
function updateRecentCheckins(checkins) {
  const container = document.getElementById('recentCheckins');
  if (!container) return;

  if (!checkins || checkins.length === 0) {
    container.innerHTML =
      '<div class="empty-state">오늘 체크인 내역이 없습니다</div>';
    return;
  }

  container.innerHTML = checkins
    .map((checkin) => {
      const checkInTime = new Date(checkin.check_in_time);
      const timeString = checkInTime.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return `
      <div class="checkin-item">
        <div class="checkin-info">
          <span class="checkin-time">${timeString}</span>
          <span class="checkin-name">${checkin.student_name}</span>
        </div>
        <span class="checkin-status">체크인 완료</span>
      </div>
    `;
    })
    .join('');
}

// QR 생성기 열기
function openQRGenerator() {
  window.open('/qr-generator.html', '_blank', 'width=600,height=700');
}

// ===== window 객체에 함수 등록 (HTML에서 호출용) =====
window.updateFunnelPeriod = function () {
  const select = document.getElementById('funnelPeriod');
  if (select) {
    funnelPeriod = select.value;
    loadFunnelData();
  }
};

window.openQRGenerator = openQRGenerator;

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
  loadFunnelData(); // 전환율도 업데이트
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

// ===== 설명회별 통계 (재참석자 포함) =====
function updateSeminarStats() {
  const statsHtml = [];
  const listHtml = [];

  seminarSchedule.forEach((seminar, index) => {
    // 현재 설명회의 예약자들
    const currentReservations = allReservations.filter(
      (r) =>
        r.seminar_id === seminar.id &&
        r.status !== '취소' &&
        r.status !== '대기'
    );

    // 재참석자 계산
    let returningCount = 0;
    let newCount = 0;

    currentReservations.forEach((reservation) => {
      // 전화번호 정규화
      const phoneNumber = reservation.parent_phone?.replace(/[^0-9]/g, '');

      if (phoneNumber) {
        // 이전 설명회 참석 여부 확인
        const hasAttendedBefore = allReservations.some(
          (r) =>
            r.id !== reservation.id && // 현재 예약 제외
            r.parent_phone?.replace(/[^0-9]/g, '') === phoneNumber &&
            r.status === '참석' &&
            new Date(r.registered_at) < new Date(reservation.registered_at) // 이전 날짜
        );

        if (hasAttendedBefore) {
          returningCount++;
        } else {
          newCount++;
        }
      } else {
        newCount++; // 전화번호 없으면 신규로 간주
      }
    });

    const totalCount = currentReservations.length;
    const capacity = seminar.display_capacity || seminar.max_capacity || 100;
    const totalPercent = Math.round((totalCount / capacity) * 100);
    const newPercent = Math.round((newCount / capacity) * 100);
    const returningPercent = Math.round((returningCount / capacity) * 100);

    // 지역명 추출
    const location = seminar.title.split('-').pop()?.trim() || seminar.title;

    // 날짜 포맷
    const date = new Date(seminar.date);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    // 색상 결정
    let colorClass = '';
    if (totalPercent >= 80) colorClass = 'danger';
    else if (totalPercent >= 50) colorClass = 'warning';

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
        <div class="progress-bar stacked">
          ${
            newCount > 0
              ? `<div class="progress-fill new ${colorClass}" 
                  style="width: ${newPercent}%" 
                  title="신규: ${newCount}명"></div>`
              : ''
          }
          ${
            returningCount > 0
              ? `<div class="progress-fill returning ${colorClass}" 
                  style="width: ${returningPercent}%" 
                  title="재참석: ${returningCount}명"></div>`
              : ''
          }
        </div>
        <div class="seminar-card-stats">
          <span class="seminar-card-count">
            ${totalCount} / ${capacity}명
            ${
              returningCount > 0
                ? `<span class="returning-info">(재참석 ${returningCount}명)</span>`
                : ''
            }
          </span>
          <span class="seminar-card-percent">${totalPercent}%</span>
        </div>
      </div>
    `);

    // 리스트 뷰용
    listHtml.push(`
      <div class="seminar-list-item">
        <span class="seminar-list-name">${location}</span>
        <span class="seminar-list-date">${dateStr}</span>
        <span class="seminar-list-count">
          ${totalCount}/${capacity}
          ${returningCount > 0 ? `<small>(재${returningCount})</small>` : ''}
        </span>
        <span class="seminar-list-percent ${colorClass}">${totalPercent}%</span>
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

  // 필터 적용 후 첫 페이지로 이동
  currentPage = 1;

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

  currentFilters = {
    seminar: '',
    status: '',
    studentName: '',
    phone: '',
    school: '',
  };

  currentPage = 1;
  applyFilters();
  showToast('필터가 초기화되었습니다.');
}

// ===== 테이블 업데이트 (페이지네이션 포함) =====
function updateTable() {
  const desktopTable = document.querySelector('.desktop-table');
  const mobileList = document.querySelector('.mobile-list');
  const emptyState = document.getElementById('emptyState');
  const tbody = document.getElementById('desktopTableBody');
  const mobileContainer = document.getElementById('mobileList');

  // 페이지네이션 계산
  totalPages = Math.ceil(filteredReservations.length / entriesPerPage);

  // 현재 페이지가 총 페이지수를 초과하면 마지막 페이지로
  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  }

  // 현재 페이지 데이터만 추출
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const pageData = filteredReservations.slice(startIndex, endIndex);

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
    updateMobileList(pageData, startIndex);
  } else {
    if (desktopTable) desktopTable.classList.remove('hidden');
    if (mobileList) mobileList.classList.add('hidden');
    updateDesktopTable(pageData, startIndex);
  }

  // 페이지네이션 UI 업데이트
  updatePagination();

  // 전체 개수 업데이트
  document.getElementById('totalEntries').textContent =
    filteredReservations.length;
  const mobileTotal = document.getElementById('totalEntriesMobile');
  if (mobileTotal) mobileTotal.textContent = filteredReservations.length;
}

// ===== 데스크톱 테이블 업데이트 =====
function updateDesktopTable(pageData, startIndex) {
  const tbody = document.getElementById('desktopTableBody');
  if (!tbody) return;

  tbody.innerHTML = pageData
    .map((r, index) => {
      const seminar = seminarSchedule.find((s) => s.id === r.seminar_id);
      const isChecked = selectedRows.has(r.id);
      const globalIndex = startIndex + index + 1; // 전체 번호

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
        <td>${globalIndex}</td>
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
function updateMobileList(pageData, startIndex) {
  const container = document.getElementById('mobileList');
  if (!container) return;

  container.innerHTML = pageData
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

  // 모바일 페이지 정보 업데이트
  const pageInfo = document.getElementById('mobilePageInfo');
  if (pageInfo) {
    pageInfo.textContent = `${currentPage} / ${totalPages || 1}`;
  }
}

// ===== 페이지네이션 UI 업데이트 =====
function updatePagination() {
  const pageNumbers = document.getElementById('pageNumbers');
  if (!pageNumbers) return;

  pageNumbers.innerHTML = '';

  // 페이지 번호 생성 로직
  const maxButtons = isMobile ? 5 : 10;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  // 첫 페이지
  if (startPage > 1) {
    pageNumbers.innerHTML += `
      <button class="page-number" onclick="changePage(1)">1</button>
    `;
    if (startPage > 2) {
      pageNumbers.innerHTML += `<span class="page-ellipsis">...</span>`;
    }
  }

  // 페이지 번호들
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.innerHTML += `
      <button class="page-number ${i === currentPage ? 'active' : ''}" 
              onclick="changePage(${i})">${i}</button>
    `;
  }

  // 마지막 페이지
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageNumbers.innerHTML += `<span class="page-ellipsis">...</span>`;
    }
    pageNumbers.innerHTML += `
      <button class="page-number" onclick="changePage(${totalPages})">${totalPages}</button>
    `;
  }

  // 버튼 활성화/비활성화
  const firstBtn = document.getElementById('firstPageBtn');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const lastBtn = document.getElementById('lastPageBtn');

  if (firstBtn) firstBtn.disabled = currentPage === 1;
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn)
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
  if (lastBtn)
    lastBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// ===== 페이지 변경 함수들 =====
function changePage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  updateTable();

  // 테이블 상단으로 스크롤
  document
    .querySelector('.table-section')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToFirstPage() {
  changePage(1);
}

function goToPrevPage() {
  changePage(currentPage - 1);
}

function goToNextPage() {
  changePage(currentPage + 1);
}

function goToLastPage() {
  changePage(totalPages);
}

function changeEntriesPerPage() {
  const selectDesktop = document.getElementById('entriesPerPage');
  const selectMobile = document.getElementById('entriesPerPageMobile');

  if (isMobile && selectMobile) {
    entriesPerPage = parseInt(selectMobile.value);
  } else if (selectDesktop) {
    entriesPerPage = parseInt(selectDesktop.value);
  }

  currentPage = 1; // 첫 페이지로 리셋
  updateTable();
}

// window 객체에 페이지네이션 함수 등록
window.changePage = changePage;
window.goToFirstPage = goToFirstPage;
window.goToPrevPage = goToPrevPage;
window.goToNextPage = goToNextPage;
window.goToLastPage = goToLastPage;
window.changeEntriesPerPage = changeEntriesPerPage;
window.toggleStatsView = toggleStatsView;
window.toggleFilters = toggleFilters;
window.quickFilter = quickFilter;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;

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

window.toggleDropdown = toggleDropdown;

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

window.handleDropdownAction = handleDropdownAction;

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

window.toggleRowSelection = toggleRowSelection;

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

window.toggleSelectAll = toggleSelectAll;

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

window.clearSelection = clearSelection;

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

window.bulkUpdate = bulkUpdate;

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

window.closeEditModal = closeEditModal;

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

window.saveEdit = saveEdit;

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

window.exportToExcel = exportToExcel;

// ===== FAB 메뉴 토글 =====
function toggleFabMenu() {
  const menu = document.getElementById('fabMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

window.toggleFabMenu = toggleFabMenu;

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

window.showBulkActions = showBulkActions;

// ===== 유틸리티 함수들 =====

// 새로고침
function refreshData() {
  loadData();
  showToast('데이터를 새로고침했습니다.');
}

window.refreshData = refreshData;

// 설명회 필터 업데이트
function updateSeminarFilter() {
  const select = document.getElementById('filterSeminar');
  if (!select) return;

  const currentValue = select.value; // 현재 선택값 저장

  select.innerHTML = '<option value="">전체 설명회</option>';

  seminarSchedule.forEach((seminar) => {
    const option = document.createElement('option');
    option.value = seminar.id;
    option.textContent = `${formatDateShort(seminar.date)} ${seminar.title}`;
    select.appendChild(option);
  });

  // 이전 선택값 복원
  select.value = currentValue;
}

// 숫자 애니메이션 (id 방식)
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
