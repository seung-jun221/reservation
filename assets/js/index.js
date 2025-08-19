// ⭐ API URL - 백엔드 배포 후 여기에 URL 입력
const API_URL =
  'https://script.google.com/macros/s/AKfycbx-ktPhpncbuQ3ny78UfN_mgZPq6JAbA8CcLe7-fYQ6A9edGgVgQX19NrSt6btnPv--xA/exec';

let seminarSchedule = [];
let selectedSeminar = null;
let currentReservation = null;
let previousInfo = null;
let isSubmitting = false;
let isPreviousInfoLoaded = false;
let isWaitlistReservation = false;

// 시도 횟수 추적
const attemptTracker = new Map();

// ===== 캐시 관리 =====
const CACHE_KEY = 'seminar_schedule';
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 로컬 스토리지 캐시 함수
function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log('캐시 데이터 유효, 사용함');
        return data;
      } else {
        console.log('캐시 데이터 만료됨');
        localStorage.removeItem(CACHE_KEY);
      }
    }
  } catch (e) {
    console.log('캐시 읽기 실패:', e);
    localStorage.removeItem(CACHE_KEY);
  }
  return null;
}

function setCachedData(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: data,
        timestamp: Date.now(),
      })
    );
    console.log('캐시 저장 완료');
  } catch (e) {
    console.log('캐시 저장 실패:', e);
  }
}

// ===== 페이지 로드 시 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('페이지 로드 시작');

  // 초기 상태 설정
  isPreviousInfoLoaded = false;
  previousInfo = null;
  isWaitlistReservation = false;

  // UI 초기화
  const noticeElement = document.getElementById('infoLoadedNotice');
  if (noticeElement) {
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
  }

  const defaultInfoBox = document.getElementById('defaultInfoBox');
  const reserveBtn = document.getElementById('reserveBtn');
  const selectGuide = document.querySelector('.select-guide');

  // 초기에는 안내 문구와 버튼 숨기기
  if (selectGuide) selectGuide.style.display = 'none';
  if (defaultInfoBox) defaultInfoBox.style.display = 'none';
  if (reserveBtn) reserveBtn.style.display = 'none';

  // 로딩 표시
  const seminarSelectionArea = document.getElementById('seminarSelectionArea');
  seminarSelectionArea.innerHTML = `
    <div class="initial-loading">
      <div class="spinner"></div>
      <p>설명회 정보를 불러오는 중입니다...</p>
      <p style="font-size: 12px; color: #999; margin-top: 5px">잠시만 기다려주세요</p>
    </div>
  `;

  try {
    // 캐시 확인
    const cachedSchedule = getCachedData();

    if (
      cachedSchedule &&
      Array.isArray(cachedSchedule) &&
      cachedSchedule.length > 0
    ) {
      console.log('캐시된 데이터 사용:', cachedSchedule);
      seminarSchedule = cachedSchedule;

      // UI 즉시 업데이트
      updateUIAfterLoad();
      displaySeminarSelection();

      // 백그라운드에서 데이터 갱신
      refreshDataInBackground();
    } else {
      console.log('캐시 없음, 새로 로드');
      // 캐시가 없으면 직접 로드
      await loadSeminarScheduleWithFallback();
    }
  } catch (error) {
    console.error('초기화 중 오류:', error);
    showLoadError();
  }
});

// ===== 메인 로드 함수 (폴백 포함) =====
async function loadSeminarScheduleWithFallback() {
  try {
    const success = await loadSeminarScheduleOptimized();
    if (success) {
      console.log('설명회 정보 로드 성공');
      updateUIAfterLoad();
      displaySeminarSelection();
    } else {
      throw new Error('설명회 로드 실패');
    }
  } catch (error) {
    console.error('로드 실패:', error);

    // 폴백: 기본 설명회 정보 사용
    const fallbackSchedule = getFallbackSchedule();
    if (fallbackSchedule.length > 0) {
      console.log('폴백 데이터 사용');
      seminarSchedule = fallbackSchedule;
      updateUIAfterLoad();
      displaySeminarSelection();

      // 백그라운드에서 재시도
      setTimeout(() => refreshDataInBackground(), 2000);
    } else {
      showLoadError();
    }
  }
}

// ===== 폴백 데이터 =====
function getFallbackSchedule() {
  // 기본 설명회 정보 (긴급 시 사용)
  const now = new Date();
  const fallback = [
    {
      id: 'S1755586429207',
      date: '2025-08-26',
      time: '10:30',
      maxCapacity: 100,
      displayCapacity: 100,
      title: '아이스터디 VIP 학부모 설명회 - 대치',
      location: '넥스트닥 (대치동 912-31, 대치스터디타워 5층)',
      duration: '90분',
      reserved: 0,
      available: 100,
      isFull: false,
      isPast: false,
      status: 'active',
    },
    {
      id: 'S1755586585660',
      date: '2025-08-27',
      time: '10:30',
      maxCapacity: 60,
      displayCapacity: 60,
      title: '아이스터디 VIP 학부모 설명회 - 송도',
      location: '바른생각학원 (송도 1공구 노브랜드 건물 5층)',
      duration: '90분',
      reserved: 0,
      available: 60,
      isFull: false,
      isPast: false,
      status: 'active',
    },
    {
      id: 'S1755586850329',
      date: '2025-09-02',
      time: '10:30',
      maxCapacity: 120,
      displayCapacity: 120,
      title: '아이스터디 VIP 학부모 설명회 - 분당',
      location: '수학의 아침 수내캠퍼스',
      duration: '90분',
      reserved: 0,
      available: 120,
      isFull: false,
      isPast: false,
      status: 'active',
    },
  ];

  // 지난 날짜 필터링
  return fallback.filter((s) => {
    const seminarDate = new Date(s.date + 'T' + s.time);
    return seminarDate > now;
  });
}

// ===== 최적화된 로드 함수 =====
// loadSeminarScheduleOptimized 함수를 다음과 같이 수정하세요

async function loadSeminarScheduleOptimized() {
  console.log('API 호출 시작');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${API_URL}?action=getSeminarSchedule`, {
      signal: controller.signal,
      method: 'GET',
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API 응답:', data);

    // API 응답 형식 자동 감지
    let scheduleData = [];

    // Case 1: 정상적인 객체 응답 { success: true, schedule: [...] }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.success && data.schedule && Array.isArray(data.schedule)) {
        scheduleData = data.schedule;
      } else if (data.schedule && Array.isArray(data.schedule)) {
        // success 필드가 없어도 schedule이 있으면 처리
        scheduleData = data.schedule;
      }
    }
    // Case 2: 배열이 직접 반환되는 경우
    else if (Array.isArray(data)) {
      scheduleData = data;
    }

    console.log('추출된 schedule 데이터:', scheduleData);

    // 활성화되고 아직 진행되지 않은 설명회만 필터링
    const activeSchedule = scheduleData.filter((s) => {
      // status가 없으면 active로 간주
      const isActive = !s.status || s.status === 'active';
      const isNotPast = !s.isPast;
      return isActive && isNotPast;
    });

    console.log('활성 설명회:', activeSchedule);

    if (activeSchedule.length >= 0) {
      // 0개여도 정상 처리
      seminarSchedule = activeSchedule;
      setCachedData(activeSchedule);
      return true;
    }

    return false;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('요청 시간 초과');
    } else {
      console.error('API 호출 오류:', error);
    }
    return false;
  }
}

// ===== UI 업데이트 =====
function updateUIAfterLoad() {
  console.log('UI 업데이트 시작');

  const selectGuide = document.querySelector('.select-guide');
  const defaultInfoBox = document.getElementById('defaultInfoBox');
  const reserveBtn = document.getElementById('reserveBtn');

  if (selectGuide) {
    selectGuide.style.display = 'block';
    selectGuide.textContent =
      seminarSchedule.length > 0
        ? '참석하실 설명회를 선택해주세요'
        : '현재 예약 가능한 설명회가 없습니다';
  }

  if (defaultInfoBox) {
    defaultInfoBox.style.display = 'block';
    if (seminarSchedule.length === 0) {
      defaultInfoBox.innerHTML = `
        <p style="color: #999;">현재 예약 가능한 설명회가 없습니다.</p>
        <p style="color: #999; font-size: 14px; margin-top: 10px;">추후 일정을 확인해주세요.</p>
      `;
    }
  }

  if (reserveBtn) {
    reserveBtn.style.display = 'block';
    if (seminarSchedule.length === 0) {
      reserveBtn.disabled = true;
      reserveBtn.textContent = '예약 가능한 설명회가 없습니다';
    }
  }
}

// ===== 백그라운드 데이터 갱신 =====
async function refreshDataInBackground() {
  console.log('백그라운드 데이터 갱신 시작');

  try {
    const response = await fetch(`${API_URL}?action=getSeminarSchedule`, {
      method: 'GET',
      cache: 'no-cache',
    });

    if (!response.ok) return;

    const data = await response.json();

    if (data.success && data.schedule && Array.isArray(data.schedule)) {
      const newSchedule = data.schedule.filter(
        (s) => (!s.status || s.status === 'active') && !s.isPast
      );

      // 데이터가 변경되었는지 확인
      if (JSON.stringify(newSchedule) !== JSON.stringify(seminarSchedule)) {
        console.log('데이터 변경 감지, UI 업데이트');
        seminarSchedule = newSchedule;
        setCachedData(newSchedule);
        displaySeminarSelection();
      }
    }
  } catch (error) {
    console.log('백그라운드 업데이트 실패 (무시):', error);
  }
}

// ===== 설명회 선택 화면 표시 =====
function displaySeminarSelection() {
  console.log('설명회 선택 화면 표시, 개수:', seminarSchedule.length);

  const container = document.getElementById('seminarSelectionArea');
  if (!container) {
    console.error('seminarSelectionArea를 찾을 수 없음');
    return;
  }

  // 설명회가 없는 경우
  if (!seminarSchedule || seminarSchedule.length === 0) {
    container.innerHTML = `
      <div class="error" style="background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;">
        <p style="font-size: 16px; margin-bottom: 10px;">현재 예약 가능한 설명회가 없습니다.</p>
        <p style="font-size: 14px;">추후 일정을 확인해주세요.</p>
      </div>
    `;

    // 선택 가이드 문구 숨기기
    const selectGuide = document.querySelector('.select-guide');
    if (selectGuide) selectGuide.style.display = 'none';

    // 예약 버튼 비활성화
    const reserveBtn = document.getElementById('reserveBtn');
    if (reserveBtn) {
      reserveBtn.disabled = true;
      reserveBtn.textContent = '예약 가능한 설명회가 없습니다';
    }
    return;
  }

  // 설명회가 1개면 자동 선택
  if (seminarSchedule.length === 1) {
    console.log('설명회 1개, 자동 선택');
    selectSeminar(seminarSchedule[0].id);

    // 1개일 때도 표시는 해줌
    container.innerHTML = `
      <div class="seminar-selection">
        <div class="seminar-options">
          ${createSeminarOption(seminarSchedule[0], true)}
        </div>
      </div>
    `;
    return;
  }

  // 여러 개일 때 선택 화면
  console.log('설명회 여러 개, 선택 화면 표시');
  container.innerHTML = `
    <div class="seminar-selection">
      <div class="seminar-options">
        ${seminarSchedule
          .map((seminar) => createSeminarOption(seminar, false))
          .join('')}
      </div>
    </div>
  `;
}

// ===== 설명회 옵션 HTML 생성 =====
// 1. createSeminarOption 함수 수정 - 잔여석 정보 제거
function createSeminarOption(seminar, autoSelected) {
  const isFull = seminar.reserved >= seminar.maxCapacity;
  const available =
    seminar.available || seminar.displayCapacity - seminar.reserved;
  const availablePercent =
    (available / (seminar.displayCapacity || seminar.maxCapacity)) * 100;
  const isNearFull = availablePercent < 30 && !isFull;

  let availabilityBadge = '';
  if (isFull) {
    availabilityBadge = '<span class="availability-badge full">마감</span>';
  } else if (isNearFull) {
    availabilityBadge =
      '<span class="availability-badge limited">마감임박</span>';
  } else {
    availabilityBadge =
      '<span class="availability-badge available">예약가능</span>';
  }

  return `
    <div class="seminar-option ${
      autoSelected ? 'selected' : ''
    }" onclick="selectSeminar('${seminar.id}')">
      ${availabilityBadge}
      <h4>${seminar.title}</h4>
      <p>${formatDate(seminar.date)} ${formatTime(seminar.time)}</p>
      <p>${seminar.location}</p>
    </div>
  `;
  // 잔여석 정보 제거됨
}

// ===== 에러 표시 =====
function showLoadError() {
  console.log('에러 화면 표시');

  const container = document.getElementById('seminarSelectionArea');
  if (container) {
    container.innerHTML = `
      <div class="error">
        <p style="font-size: 16px; margin-bottom: 10px;">설명회 정보를 불러올 수 없습니다.</p>
        <p style="font-size: 14px; color: #666;">잠시 후 다시 시도해주세요.</p>
        <button class="btn btn-primary" onclick="retryLoadSeminars()" style="margin-top: 15px;">다시 시도</button>
      </div>
    `;
  }

  const defaultInfoBox = document.getElementById('defaultInfoBox');
  const reserveBtn = document.getElementById('reserveBtn');

  if (defaultInfoBox) {
    defaultInfoBox.style.display = 'block';
    defaultInfoBox.innerHTML =
      '<p style="color: #999;">설명회 정보를 불러올 수 없습니다.</p>';
  }

  if (reserveBtn) {
    reserveBtn.style.display = 'block';
    reserveBtn.disabled = true;
    reserveBtn.textContent = '설명회 정보를 불러오는 중...';
  }
}

// ===== 재시도 =====
async function retryLoadSeminars() {
  console.log('재시도 시작');

  // 캐시 삭제
  localStorage.removeItem(CACHE_KEY);

  const container = document.getElementById('seminarSelectionArea');
  if (container) {
    container.innerHTML = `
      <div class="initial-loading">
        <div class="spinner"></div>
        <p>설명회 정보를 다시 불러오는 중입니다...</p>
        <p style="font-size: 12px; color: #999; margin-top: 5px;">최대 8초 소요</p>
      </div>
    `;
  }

  await loadSeminarScheduleWithFallback();
}

// ===== 이하 기존 함수들 그대로 유지 =====

// 로딩 표시
function showLoading(message = '처리중...') {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <div>${message}</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}

// 알림 메시지 표시
function showAlert(message, duration = 3000) {
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) existingAlert.remove();

  const alert = document.createElement('div');
  alert.className = 'alert';
  alert.textContent = message;
  document.body.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, duration);
}

// 설명회 선택 시
function selectSeminar(seminarId) {
  selectedSeminar = seminarSchedule.find((s) => s.id === seminarId);

  if (!selectedSeminar) {
    showAlert('잘못된 설명회 선택입니다.');
    return;
  }

  console.log('설명회 선택됨:', selectedSeminar);

  // 선택된 설명회 표시 업데이트
  document.querySelectorAll('.seminar-option').forEach((option) => {
    option.classList.remove('selected');
  });

  if (event && event.target) {
    event.target.closest('.seminar-option').classList.add('selected');
  }

  // 선택 가이드 문구를 선택된 설명회 정보로 변경
  const selectGuide = document.querySelector('.select-guide');
  if (selectGuide) {
    selectGuide.innerHTML = `
      <strong style="color: #1a73e8;">${selectedSeminar.title}</strong> 선택됨
    `;
  }

  // 설명회 정보 업데이트
  updateSelectedSeminarInfo();

  // 예약 버튼 활성화
  const reserveBtn = document.getElementById('reserveBtn');
  if (reserveBtn) {
    reserveBtn.disabled = false;
    reserveBtn.textContent = selectedSeminar.isFull
      ? '대기예약 신청하기'
      : '설명회 예약하기';
    reserveBtn.className = selectedSeminar.isFull
      ? 'btn btn-waitlist'
      : 'btn btn-primary';
  }
}

// 2. updateSelectedSeminarInfo 함수 수정 - 잔여석 정보 제거
function updateSelectedSeminarInfo() {
  const infoBox = document.getElementById('defaultInfoBox');

  if (selectedSeminar && infoBox) {
    infoBox.innerHTML = `
      <p><strong>${selectedSeminar.title}</strong></p>
      <ul style="list-style-type: disc; padding-left: 20px;">
        <li>일시: ${formatDate(selectedSeminar.date)} ${formatTime(
      selectedSeminar.time
    )}</li>
        <li>장소: ${selectedSeminar.location}</li>
        <li>대상: 초/중등 학부모님</li>
      </ul>
      <br>
      <p style="font-size: 13px; color: #666;">※ 설명회 참석 후 개별 컨설팅 예약이 가능합니다.</p>
    `;
    // 잔여석 정보 제거됨

    // 마감 안내 표시
    const fullNotice = document.getElementById('fullNotice');
    if (fullNotice) {
      if (selectedSeminar.isFull) {
        fullNotice.classList.remove('hidden');
      } else {
        fullNotice.classList.add('hidden');
      }
    }
  }
}

// Service Worker 등록
//if ('serviceWorker' in navigator) {
//  window.addEventListener('load', () => {
//    navigator.serviceWorker
//      .register('/sw.js')
//      .then((registration) => console.log('SW registered:', registration))
//      .catch((error) => console.log('SW registration failed:', error));
//  });
//}

// 나머지 모든 기존 함수들 그대로 유지
// proceedToReservation, showScreen, checkAttemptLimit, showSecurityModal,
// checkPreviousInfo, goBackFromInfo, validatePhone, handlePhoneSubmit,
// validateForm, handleInfoSubmit, handleCheckSubmit, cancelReservation,
// formatDate, formatTime 등...

// 예약 진행
function proceedToReservation() {
  if (!selectedSeminar) {
    showAlert('먼저 설명회를 선택해주세요.');
    return;
  }

  showScreen('phone');
}

// 화면 전환
function showScreen(screenId) {
  console.log(
    '화면 전환:',
    screenId,
    'isPreviousInfoLoaded:',
    isPreviousInfoLoaded
  );

  // 모든 카드 숨기기
  document.querySelectorAll('.card').forEach((card) => {
    card.classList.add('hidden');
  });

  // 선택된 화면 표시
  document.getElementById(screenId).classList.remove('hidden');

  if (screenId === 'info') {
    const phone = document.getElementById('initialPhone').value;
    document.getElementById('parentPhone').value = phone;

    // 알림 표시 여부 결정
    const noticeElement = document.getElementById('infoLoadedNotice');
    if (isPreviousInfoLoaded === true && previousInfo !== null) {
      console.log('이전 정보 알림 표시');
      noticeElement.classList.remove('hidden');
      noticeElement.style.display = 'flex';
    } else {
      console.log('이전 정보 알림 숨김');
      noticeElement.classList.add('hidden');
      noticeElement.style.display = 'none';
    }

    // 선택한 설명회가 마감인 경우 대기예약 체크박스 표시
    if (selectedSeminar && selectedSeminar.isFull) {
      document.getElementById('waitlistSection').classList.remove('hidden');
      document.getElementById('submitBtn').textContent = '대기예약 신청';
      document.getElementById('submitBtn').className = 'btn btn-waitlist';
      document.getElementById('infoTitle').textContent = '대기예약 신청하기';
      isWaitlistReservation = true;
    } else {
      document.getElementById('waitlistSection').classList.add('hidden');
      document.getElementById('submitBtn').textContent = '예약 확정';
      document.getElementById('submitBtn').className = 'btn btn-primary';
      document.getElementById('infoTitle').textContent = '설명회 예약하기';
      isWaitlistReservation = false;
    }
  } else if (screenId === 'phone') {
    // 전화번호 화면으로 돌아갈 때 상태 초기화
    console.log('phone 화면으로 이동 - 상태 초기화');
    isPreviousInfoLoaded = false;
    previousInfo = null;
    isWaitlistReservation = false;
    const noticeElement = document.getElementById('infoLoadedNotice');
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';

    // 마감 상태에 따라 제목 변경
    if (selectedSeminar && selectedSeminar.isFull) {
      document.getElementById('phoneTitle').textContent = '대기예약 신청하기';
    } else {
      document.getElementById('phoneTitle').textContent = '설명회 예약하기';
    }
  } else if (screenId === 'home') {
    // 홈 화면으로 돌아갈 때도 초기화
    console.log('home 화면으로 이동 - 상태 초기화');
    isPreviousInfoLoaded = false;
    previousInfo = null;
    isWaitlistReservation = false;
    const noticeElement = document.getElementById('infoLoadedNotice');
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
    // 폼 초기화
    document.getElementById('phoneForm').reset();
    document.getElementById('infoForm').reset();
    // 시도 기록 초기화
    attemptTracker.clear();
  } else if (screenId === 'complete') {
    // 완료 화면일 때도 초기화
    isPreviousInfoLoaded = false;
    previousInfo = null;
    isWaitlistReservation = false;
  }
}

// 시도 횟수 확인
function checkAttemptLimit(phone) {
  const now = Date.now();
  const attempts = attemptTracker.get(phone) || { count: 0, firstAttempt: now };

  // 5분 경과 시 초기화
  if (now - attempts.firstAttempt > 5 * 60 * 1000) {
    attempts.count = 0;
    attempts.firstAttempt = now;
  }

  // 5분 내 3회 이상 시도 시 차단
  if (attempts.count >= 3) {
    showAlert('너무 많은 시도가 있었습니다. 5분 후 다시 시도해주세요.');
    return false;
  }

  // 시도 기록
  attempts.count++;
  attemptTracker.set(phone, attempts);
  return true;
}

// 보안 모달 표시
function showSecurityModal() {
  return new Promise((resolve, reject) => {
    const modalHtml = `
      <div class="modal-overlay" id="securityModalOverlay">
        <div class="security-modal">
          <h3>개인정보 보호 확인</h3>
          <p style="margin-bottom: 20px; color: #666;">
            개인정보 보호를 위해 학생 이름의 첫 글자를 입력해주세요.
          </p>
          <input type="text" 
                 id="studentInitialInput" 
                 maxlength="1" 
                 placeholder="예: 홍길동 → 홍"
                 autocomplete="off">
          <div class="btn-group">
            <button class="btn btn-primary" onclick="confirmSecurityModal()">확인</button>
            <button class="btn btn-secondary" onclick="cancelSecurityModal()">취소</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 포커스 설정
    setTimeout(() => {
      document.getElementById('studentInitialInput').focus();
    }, 100);

    // 전역 함수로 resolve/reject 처리
    window.confirmSecurityModal = () => {
      const input = document.getElementById('studentInitialInput').value;
      document.getElementById('securityModalOverlay').remove();
      resolve(input);
    };

    window.cancelSecurityModal = () => {
      document.getElementById('securityModalOverlay').remove();
      reject('cancelled');
    };

    // Enter 키 처리
    document
      .getElementById('studentInitialInput')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          confirmSecurityModal();
        }
      });
  });
}

// 이전 정보 확인 및 불러오기
async function checkPreviousInfo() {
  const phone = document.getElementById('initialPhone').value.replace(/-/g, '');

  if (!phone) {
    showAlert('연락처를 입력해주세요.');
    return;
  }

  if (!validatePhone(document.getElementById('initialPhone').value)) return;

  // 시도 횟수 확인
  if (!checkAttemptLimit(phone)) return;

  try {
    // 보안 확인 모달 표시
    const studentInitial = await showSecurityModal();

    if (!studentInitial || studentInitial.length !== 1) {
      showAlert('학생 이름의 첫 글자를 정확히 입력해주세요.');
      return;
    }

    showLoading('이전 정보 확인 중...');

    const response = await fetch(
      `${API_URL}?action=checkPreviousInfo&phone=${encodeURIComponent(
        phone
      )}&initial=${encodeURIComponent(studentInitial)}`
    );
    const data = await response.json();

    hideLoading();

    if (data.success && data.hasPreviousInfo) {
      previousInfo = data.previousInfo;
      console.log('이전 정보 찾음 - isPreviousInfoLoaded를 true로 설정');
      isPreviousInfoLoaded = true;

      // 바로 다음 화면으로 이동
      showScreen('info');

      setTimeout(() => {
        // 최소 정보만 자동 입력
        document.getElementById('school').value = previousInfo.school || '';
        document.getElementById('grade').value = previousInfo.grade || '';

        // 민감 정보는 힌트만 제공
        if (previousInfo.studentName && previousInfo.studentName.length > 0) {
          const maskedName =
            previousInfo.studentName.substring(0, 1) +
            '○'.repeat(previousInfo.studentName.length - 1);
          document.getElementById(
            'studentName'
          ).placeholder = `예: ${maskedName}`;
        }

        // 수학 선행정도는 입력하도록 유도
        document.getElementById('mathLevel').placeholder = '다시 입력해주세요';

        showAlert(
          '학교와 학년 정보를 불러왔습니다. 나머지 정보는 직접 입력해주세요.'
        );
      }, 100);
    } else {
      showAlert('일치하는 정보가 없습니다.');
      console.log('이전 정보 없음 - 상태 초기화');
      isPreviousInfoLoaded = false;
      previousInfo = null;
      const noticeElement = document.getElementById('infoLoadedNotice');
      noticeElement.classList.add('hidden');
      noticeElement.style.display = 'none';
    }
  } catch (error) {
    hideLoading();

    if (error === 'cancelled') {
      return;
    }

    console.error('Error:', error);
    showAlert('정보 확인 중 오류가 발생했습니다.');
    console.log('오류 발생 - 상태 초기화');
    isPreviousInfoLoaded = false;
    previousInfo = null;
    const noticeElement = document.getElementById('infoLoadedNotice');
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
  }
}

// 정보 입력 화면에서 뒤로 가기
function goBackFromInfo() {
  console.log('뒤로 버튼 클릭 - 상태 초기화');
  isPreviousInfoLoaded = false;
  previousInfo = null;
  isWaitlistReservation = false;
  const noticeElement = document.getElementById('infoLoadedNotice');
  noticeElement.classList.add('hidden');
  noticeElement.style.display = 'none';
  showScreen('phone');
}

// 전화번호 검증
function validatePhone(phone) {
  const cleaned = phone.replace(/-/g, '');
  const phoneRegex = /^01[0-9]{8,9}$/;

  if (!phoneRegex.test(cleaned)) {
    showAlert('올바른 휴대폰 번호를 입력해주세요.');
    return false;
  }
  return true;
}

// 전화번호 자동 포맷팅
document.getElementById('initialPhone').addEventListener('input', function (e) {
  let value = e.target.value.replace(/[^0-9]/g, '');
  if (value.length >= 4 && value.length <= 7) {
    value = value.slice(0, 3) + '-' + value.slice(3);
  } else if (value.length >= 8) {
    value =
      value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
  }
  e.target.value = value;
});

document.getElementById('checkPhone').addEventListener('input', function (e) {
  let value = e.target.value.replace(/[^0-9]/g, '');
  if (value.length >= 4 && value.length <= 7) {
    value = value.slice(0, 3) + '-' + value.slice(3);
  } else if (value.length >= 8) {
    value =
      value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
  }
  e.target.value = value;
});

// 비밀번호 입력 제한
document.getElementById('password').addEventListener('input', function (e) {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

document
  .getElementById('checkPassword')
  .addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

// 전화번호 폼 제출
function handlePhoneSubmit(event) {
  event.preventDefault();

  const phone = document.getElementById('initialPhone').value;
  if (!validatePhone(phone)) return;

  // 다음 버튼으로 넘어갈 때는 플래그 초기화
  console.log('다음 버튼 클릭 - 상태 초기화');
  isPreviousInfoLoaded = false;
  previousInfo = null;

  // 알림 박스도 확실히 숨기기
  const noticeElement = document.getElementById('infoLoadedNotice');
  noticeElement.classList.add('hidden');
  noticeElement.style.display = 'none';

  showScreen('info');
}

// 폼 검증
function validateForm() {
  const fields = [
    { id: 'studentName', name: '학생명', minLength: 2 },
    { id: 'school', name: '학교', minLength: 2 },
    { id: 'mathLevel', name: '수학 선행정도', minLength: 2 },
  ];

  for (const field of fields) {
    const value = document.getElementById(field.id).value.trim();
    if (value.length < field.minLength) {
      showAlert(`${field.name}을(를) 정확히 입력해주세요.`);
      return false;
    }
  }

  const grade = document.getElementById('grade').value;
  if (!grade) {
    showAlert('학년을 선택해주세요.');
    return false;
  }

  const password = document.getElementById('password').value;
  if (password.length !== 6) {
    showAlert('비밀번호는 6자리 숫자여야 합니다.');
    return false;
  }

  // 개인정보 동의 체크
  const privacyConsent = document.getElementById('privacyConsent').checked;
  if (!privacyConsent) {
    showAlert('개인정보 수집 및 이용에 동의해주세요.');
    return false;
  }

  // 대기예약의 경우 체크박스 확인
  if (isWaitlistReservation && selectedSeminar.isFull) {
    const waitlistConsent = document.getElementById('waitlistConsent').checked;
    if (!waitlistConsent) {
      showAlert('대기예약을 원하시면 대기예약 동의에 체크해주세요.');
      return false;
    }
  }

  return true;
}

// 예약 정보 폼 제출
async function handleInfoSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;
  if (!validateForm()) return;

  // 설명회 정보 재확인
  if (!selectedSeminar) {
    showAlert('설명회 정보를 다시 불러오는 중입니다...');
    await loadSeminarScheduleOptimized();
    if (!selectedSeminar) {
      showAlert('설명회 정보를 불러올 수 없습니다. 다시 시도해주세요.');
      return;
    }
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '처리중...';
  isSubmitting = true;

  // 대기예약 여부 결정
  const isWaitlist = selectedSeminar.isFull;

  showLoading(isWaitlist ? '대기예약 처리 중...' : '예약 처리 중...');

  try {
    const reservationData = {
      action: 'createReservation',
      seminarId: selectedSeminar.id,
      studentName: document.getElementById('studentName').value.trim(),
      parentPhone: document
        .getElementById('parentPhone')
        .value.replace(/-/g, ''),
      school: document.getElementById('school').value.trim(),
      grade: document.getElementById('grade').value,
      mathLevel: document.getElementById('mathLevel').value.trim(),
      password: document.getElementById('password').value,
      privacyConsent: document.getElementById('privacyConsent').checked,
      isWaitlist: isWaitlist,
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(reservationData),
    });

    const result = await response.json();

    hideLoading();

    if (result.success) {
      // 캐시 무효화
      localStorage.removeItem(CACHE_KEY);

      if (result.isWaitlist) {
        // 대기예약 완료 화면
        document.getElementById('completeTitle').textContent =
          '대기예약이 완료되었습니다';
        document.getElementById('completeSubtitle').textContent =
          '취소자 발생 시 순번대로 연락드리겠습니다.';
        document.getElementById('completionInfo').innerHTML = `
          <p><strong>예약번호:</strong> ${result.reservationId}</p>
          <p><strong>대기순번:</strong> ${result.waitlistNumber || '-'}번째</p>
          <p><strong>설명회:</strong> ${result.seminarInfo.title}</p>
          <p><strong>날짜:</strong> ${formatDate(result.seminarInfo.date)}</p>
          <p><strong>시간:</strong> ${formatTime(result.seminarInfo.time)}</p>
          <p><strong>장소:</strong> ${result.seminarInfo.location}</p>
          <p><strong>학생명:</strong> ${reservationData.studentName}</p>
          <p style="color: #c2185b; margin-top: 10px;"><strong>※ 대기예약입니다</strong></p>
        `;
        document.getElementById('completeInfoBox').innerHTML = `
          <p><strong>대기예약 안내사항</strong></p>
          <ul>
            <li>취소자 발생 시 대기 순번대로 개별 연락드립니다.</li>
            <li>연락을 받지 못하실 경우 다음 순번으로 넘어갑니다.</li>
            <li>대기예약도 언제든 취소 가능합니다.</li>
            <li>정규 예약으로 전환 시 별도 안내드립니다.</li>
          </ul>
        `;
      } else {
        // 일반 예약 완료 화면
        document.getElementById('completeTitle').textContent =
          '예약이 완료되었습니다';
        document.getElementById('completeSubtitle').textContent =
          '설명회에서 뵙겠습니다.';
        document.getElementById('completionInfo').innerHTML = `
          <p><strong>예약번호:</strong> ${result.reservationId}</p>
          <p><strong>설명회:</strong> ${result.seminarInfo.title}</p>
          <p><strong>날짜:</strong> ${formatDate(result.seminarInfo.date)}</p>
          <p><strong>시간:</strong> ${formatTime(result.seminarInfo.time)}</p>
          <p><strong>소요시간:</strong> ${
            result.seminarInfo.duration || '90분'
          }</p>
          <p><strong>장소:</strong> ${result.seminarInfo.location}</p>
          <p><strong>학생명:</strong> ${reservationData.studentName}</p>
        `;
        document.getElementById('completeInfoBox').innerHTML = `
          <p><strong>안내사항</strong></p>
          <ul>
            <li>설명회 시작 10분 전까지 도착해주세요.</li>
            <li>주차공간이 협소하니 대중교통 이용을 권장합니다.</li>
            <li>설명회 참석 후 개별 컨설팅 예약이 가능합니다.</li>
            <li>설명회는 90분간 진행됩니다.</li>
          </ul>
        `;
      }

      showScreen('complete');

      // 폼 초기화
      document.getElementById('infoForm').reset();
      document.getElementById('phoneForm').reset();
      const noticeElement = document.getElementById('infoLoadedNotice');
      noticeElement.classList.add('hidden');
      noticeElement.style.display = 'none';

      // 플래그 초기화
      previousInfo = null;
      isPreviousInfoLoaded = false;
      isWaitlistReservation = false;
      console.log('예약 완료 - 상태 초기화');
    } else {
      if (result.existingReservation) {
        if (
          confirm(result.message + '\n\n예약 확인 화면으로 이동하시겠습니까?')
        ) {
          showScreen('check');
          document.getElementById('checkPhone').value =
            reservationData.parentPhone;
        }
      } else {
        showAlert(result.message || '예약 중 오류가 발생했습니다.');
      }
    }
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    showAlert('예약 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isWaitlist ? '대기예약 신청' : '예약 확정';
    isSubmitting = false;
  }
}

// 예약 확인 폼 제출
async function handleCheckSubmit(event) {
  event.preventDefault();

  const phone = document.getElementById('checkPhone').value.replace(/-/g, '');
  const password = document.getElementById('checkPassword').value;

  if (!validatePhone(document.getElementById('checkPhone').value)) return;

  if (password.length !== 6) {
    showAlert('비밀번호는 6자리 숫자여야 합니다.');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '확인중...';

  showLoading('예약 정보 확인 중...');

  try {
    const response = await fetch(
      `${API_URL}?action=checkReservation&phone=${encodeURIComponent(
        phone
      )}&password=${encodeURIComponent(password)}`
    );
    const data = await response.json();

    hideLoading();

    if (data.success && data.reservation) {
      currentReservation = data.reservation;

      let reservationTypeText = '';
      if (data.reservation.status === '대기') {
        const waitlistMatch = data.reservation.notes.match(/대기\s*(\d+)번/);
        const waitlistNumber = waitlistMatch ? waitlistMatch[1] : '-';
        reservationTypeText = `<p style="color: #c2185b;"><strong>예약 유형:</strong> 대기예약 (${waitlistNumber}번째)</p>`;
      }

      document.getElementById('reservationInfo').innerHTML = `
        <p><strong>예약번호:</strong> ${data.reservation.reservationId}</p>
        ${reservationTypeText}
        <p><strong>설명회:</strong> ${data.reservation.seminarInfo.title}</p>
        <p><strong>날짜:</strong> ${formatDate(
          data.reservation.seminarInfo.date
        )}</p>
        <p><strong>시간:</strong> ${formatTime(
          data.reservation.seminarInfo.time
        )}</p>
        <p><strong>소요시간:</strong> ${
          data.reservation.seminarInfo.duration || '90분'
        }</p>
        <p><strong>장소:</strong> ${data.reservation.seminarInfo.location}</p>
        <p><strong>학생명:</strong> ${data.reservation.studentName}</p>
        <p><strong>연락처:</strong> ${data.reservation.parentPhone}</p>
        <p><strong>학교:</strong> ${data.reservation.school}</p>
        <p><strong>학년:</strong> ${data.reservation.grade}</p>
        <p><strong>수학 선행정도:</strong> ${data.reservation.mathLevel}</p>
      `;
      showScreen('result');
    } else {
      showAlert(
        data.message || '예약을 찾을 수 없거나 비밀번호가 일치하지 않습니다.'
      );
    }
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    showAlert('예약 조회 중 오류가 발생했습니다.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '예약 확인하기';
  }
}

// 예약 취소
async function cancelReservation() {
  if (!confirm('정말로 예약을 취소하시겠습니까?')) {
    return;
  }

  const password = prompt('비밀번호를 입력해주세요 (6자리 숫자):');
  if (!password || password.length !== 6 || !/^\d{6}$/.test(password)) {
    showAlert('올바른 비밀번호를 입력해주세요.');
    return;
  }

  showLoading('예약 취소 중...');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'cancelReservation',
        reservationId: currentReservation.reservationId,
        password: password,
      }),
    });

    const result = await response.json();

    hideLoading();

    if (result.success) {
      // 캐시 무효화
      localStorage.removeItem(CACHE_KEY);

      showAlert('예약이 취소되었습니다.');
      showScreen('home');
      document.getElementById('checkForm').reset();
      currentReservation = null;
    } else {
      showAlert(result.message || '취소 중 오류가 발생했습니다.');
    }
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    showAlert('예약 취소 중 오류가 발생했습니다.');
  }
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
