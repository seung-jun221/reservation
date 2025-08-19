// ⭐ Supabase 설정
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ===== Supabase로 설명회 정보 로드 =====
async function loadSeminarScheduleOptimized() {
  console.log('Supabase에서 설명회 정보 로드 시작');

  try {
    // 1. Supabase에서 활성 설명회 가져오기
    const { data: seminars, error } = await supabase
      .from('seminars')
      .select('*')
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase 오류:', error);
      return false;
    }

    console.log('Supabase 설명회 데이터:', seminars);

    // 2. 각 설명회의 예약 수 계산
    const scheduleWithStatus = [];

    for (let seminar of seminars) {
      // 예약 수 가져오기
      const { count: reservedCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('seminar_id', seminar.id)
        .eq('status', '예약');

      const reserved = reservedCount || 0;
      const available = seminar.display_capacity - reserved;

      // 날짜 확인 (지난 설명회 제외)
      const seminarDateTime = new Date(seminar.date + 'T' + seminar.time);
      const now = new Date();
      const isPast = seminarDateTime < now;

      if (!isPast) {
        scheduleWithStatus.push({
          id: seminar.id,
          title: seminar.title,
          date: seminar.date,
          time: seminar.time.substring(0, 5), // "10:30:00" → "10:30"
          location: seminar.location,
          maxCapacity: seminar.max_capacity,
          displayCapacity: seminar.display_capacity,
          duration: seminar.duration,
          reserved: reserved,
          available: available,
          isFull: reserved >= seminar.max_capacity,
          isPast: false,
          status: seminar.status,
        });
      }
    }

    console.log('활성 설명회:', scheduleWithStatus);

    // 3. 전역 변수 업데이트
    seminarSchedule = scheduleWithStatus;

    // 4. 캐시 저장
    setCachedData(scheduleWithStatus);

    return true;
  } catch (error) {
    console.error('API 호출 오류:', error);
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

// ===== 백그라운드 데이터 갱신 (Supabase) =====
async function refreshDataInBackground() {
  console.log('백그라운드 데이터 갱신 시작 (Supabase)');

  try {
    // Supabase에서 다시 로드
    await loadSeminarScheduleOptimized();
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

// ===== 설명회 옵션 HTML 생성 (잔여석 제거) =====
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
        <p style="font-size: 12px; color: #999; margin-top: 5px;">잠시만 기다려주세요</p>
      </div>
    `;
  }

  await loadSeminarScheduleWithFallback();
}

// ===== 기본 UI 함수들 =====

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

// 선택된 설명회 정보 업데이트 (잔여석 제거)
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
    if (noticeElement) {
      noticeElement.classList.add('hidden');
      noticeElement.style.display = 'none';
    }

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
    if (noticeElement) {
      noticeElement.classList.add('hidden');
      noticeElement.style.display = 'none';
    }
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
  if (noticeElement) {
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
  }

  showScreen('info');
}

// 정보 입력 화면에서 뒤로 가기
function goBackFromInfo() {
  console.log('뒤로 버튼 클릭 - 상태 초기화');
  isPreviousInfoLoaded = false;
  previousInfo = null;
  isWaitlistReservation = false;
  const noticeElement = document.getElementById('infoLoadedNotice');
  if (noticeElement) {
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
  }
  showScreen('phone');
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

// ===== 유틸리티 함수 =====
function hashPassword(password) {
  const SECURITY_SALT = 'math-morning-2025-secret';
  const str = password + SECURITY_SALT;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 11) {
    return (
      cleaned.substring(0, 3) +
      '-' +
      cleaned.substring(3, 7) +
      '-' +
      cleaned.substring(7, 11)
    );
  }
  return phone;
}

// ===== Supabase 연동 함수들 =====

// 예약 생성 (Supabase 버전)
async function handleInfoSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;
  if (!validateForm()) return;

  // 설명회 정보 재확인
  if (!selectedSeminar) {
    showAlert('설명회를 다시 선택해주세요.');
    showScreen('home');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '처리중...';
  isSubmitting = true;

  const isWaitlist = selectedSeminar.isFull;

  showLoading(isWaitlist ? '대기예약 처리 중...' : '예약 처리 중...');

  try {
    const parentPhone = document
      .getElementById('parentPhone')
      .value.replace(/-/g, '');

    // 1. 중복 체크
    const { data: existing } = await supabase
      .from('reservations')
      .select('*')
      .eq('parent_phone', parentPhone)
      .eq('seminar_id', selectedSeminar.id)
      .in('status', ['예약', '대기']);

    if (existing && existing.length > 0) {
      hideLoading();
      showAlert('이미 해당 설명회에 예약이 존재합니다.');
      submitBtn.disabled = false;
      submitBtn.textContent = isWaitlist ? '대기예약 신청' : '예약 확정';
      isSubmitting = false;
      return;
    }

    // 2. 대기번호 계산 (대기예약인 경우)
    let waitlistNumber = null;
    if (isWaitlist) {
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('seminar_id', selectedSeminar.id)
        .eq('status', '대기');

      waitlistNumber = (count || 0) + 1;
    }

    // 3. 예약 데이터 준비
    const reservationData = {
      reservation_id: 'SR' + Date.now(),
      seminar_id: selectedSeminar.id,
      student_name: document.getElementById('studentName').value.trim(),
      parent_phone: parentPhone,
      school: document.getElementById('school').value.trim(),
      grade: document.getElementById('grade').value,
      math_level: document.getElementById('mathLevel').value.trim(),
      password: hashPassword(document.getElementById('password').value),
      privacy_consent: document.getElementById('privacyConsent').checked
        ? 'Y'
        : 'N',
      status: isWaitlist ? '대기' : '예약',
      notes: isWaitlist ? `대기 ${waitlistNumber}번` : '',
      waitlist_number: waitlistNumber,
    };

    // 4. 예약 저장
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    if (error) throw error;

    hideLoading();

    // 5. 완료 화면 표시
    if (isWaitlist) {
      document.getElementById('completeTitle').textContent =
        '대기예약이 완료되었습니다';
      document.getElementById('completeSubtitle').textContent =
        '취소자 발생 시 순번대로 연락드리겠습니다.';
      document.getElementById('completionInfo').innerHTML = `
        <p><strong>예약번호:</strong> ${reservationData.reservation_id}</p>
        <p><strong>대기순번:</strong> ${waitlistNumber}번째</p>
        <p><strong>설명회:</strong> ${selectedSeminar.title}</p>
        <p><strong>날짜:</strong> ${formatDate(selectedSeminar.date)}</p>
        <p><strong>시간:</strong> ${formatTime(selectedSeminar.time)}</p>
        <p><strong>장소:</strong> ${selectedSeminar.location}</p>
        <p><strong>학생명:</strong> ${reservationData.student_name}</p>
        <p style="color: #c2185b; margin-top: 10px;"><strong>※ 대기예약입니다</strong></p>
      `;
      document.getElementById('completeInfoBox').innerHTML = `
        <p><strong>대기예약 안내사항</strong></p>
        <ul>
          <li>취소자 발생 시 대기 순번대로 개별 연락드립니다.</li>
          <li>연락을 받지 못하실 경우 다음 순번으로 넘어갑니다.</li>
          <li>대기예약도 언제든 취소 가능합니다.</li>
        </ul>
      `;
    } else {
      document.getElementById('completeTitle').textContent =
        '예약이 완료되었습니다';
      document.getElementById('completeSubtitle').textContent =
        '설명회에서 뵙겠습니다.';
      document.getElementById('completionInfo').innerHTML = `
        <p><strong>예약번호:</strong> ${reservationData.reservation_id}</p>
        <p><strong>설명회:</strong> ${selectedSeminar.title}</p>
        <p><strong>날짜:</strong> ${formatDate(selectedSeminar.date)}</p>
        <p><strong>시간:</strong> ${formatTime(selectedSeminar.time)}</p>
        <p><strong>장소:</strong> ${selectedSeminar.location}</p>
        <p><strong>학생명:</strong> ${reservationData.student_name}</p>
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

    // 캐시 무효화
    localStorage.removeItem(CACHE_KEY);

    // 플래그 초기화
    previousInfo = null;
    isPreviousInfoLoaded = false;
    isWaitlistReservation = false;
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

// 예약 확인 (Supabase 버전)
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
    // 1. 예약 조회
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('parent_phone', phone)
      .eq('password', hashPassword(password))
      .in('status', ['예약', '대기'])
      .order('id', { ascending: false })
      .limit(1);

    if (error || !reservations || reservations.length === 0) {
      hideLoading();
      showAlert('예약을 찾을 수 없거나 비밀번호가 일치하지 않습니다.');
      submitBtn.disabled = false;
      submitBtn.textContent = '예약 확인하기';
      return;
    }

    const reservation = reservations[0];

    // 2. 설명회 정보 가져오기
    const { data: seminar } = await supabase
      .from('seminars')
      .select('*')
      .eq('id', reservation.seminar_id)
      .single();

    hideLoading();

    // 3. 전역 변수에 저장
    currentReservation = {
      ...reservation,
      seminarInfo: seminar,
    };

    // 4. 예약 정보 표시
    let reservationTypeText = '';
    if (reservation.status === '대기') {
      const waitlistNumber = reservation.waitlist_number || '-';
      reservationTypeText = `<p style="color: #c2185b;"><strong>예약 유형:</strong> 대기예약 (${waitlistNumber}번째)</p>`;
    }

    document.getElementById('reservationInfo').innerHTML = `
      <p><strong>예약번호:</strong> ${reservation.reservation_id}</p>
      ${reservationTypeText}
      <p><strong>설명회:</strong> ${seminar.title}</p>
      <p><strong>날짜:</strong> ${formatDate(seminar.date)}</p>
      <p><strong>시간:</strong> ${formatTime(seminar.time.substring(0, 5))}</p>
      <p><strong>장소:</strong> ${seminar.location}</p>
      <p><strong>학생명:</strong> ${reservation.student_name}</p>
      <p><strong>연락처:</strong> ${formatPhoneNumber(
        reservation.parent_phone
      )}</p>
      <p><strong>학교:</strong> ${reservation.school}</p>
      <p><strong>학년:</strong> ${reservation.grade}</p>
      <p><strong>수학 선행정도:</strong> ${reservation.math_level}</p>
    `;

    showScreen('result');
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    showAlert('예약 조회 중 오류가 발생했습니다.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '예약 확인하기';
  }
}

// 예약 취소 (Supabase 버전)
async function cancelReservation() {
  if (!confirm('정말로 예약을 취소하시겠습니까?')) {
    return;
  }

  const password = prompt('비밀번호를 입력해주세요 (6자리 숫자):');
  if (!password || password.length !== 6 || !/^\d{6}$/.test(password)) {
    showAlert('올바른 비밀번호를 입력해주세요.');
    return;
  }

  // 비밀번호 확인
  if (hashPassword(password) !== currentReservation.password) {
    showAlert('비밀번호가 일치하지 않습니다.');
    return;
  }

  showLoading('예약 취소 중...');

  try {
    // 예약 상태를 '취소'로 업데이트
    const { error } = await supabase
      .from('reservations')
      .update({ status: '취소' })
      .eq('id', currentReservation.id);

    if (error) throw error;

    hideLoading();

    // 캐시 무효화
    localStorage.removeItem(CACHE_KEY);

    showAlert('예약이 취소되었습니다.');
    showScreen('home');
    document.getElementById('checkForm').reset();
    currentReservation = null;
  } catch (error) {
    hideLoading();
    console.error('Error:', error);
    showAlert('예약 취소 중 오류가 발생했습니다.');
  }
}

// 이전 정보 확인 (Supabase 버전)
async function checkPreviousInfo() {
  const phone = document.getElementById('initialPhone').value.replace(/-/g, '');

  if (!phone) {
    showAlert('연락처를 입력해주세요.');
    return;
  }

  if (!validatePhone(document.getElementById('initialPhone').value)) return;

  if (!checkAttemptLimit(phone)) return;

  try {
    const studentInitial = await showSecurityModal();

    if (!studentInitial || studentInitial.length !== 1) {
      showAlert('학생 이름의 첫 글자를 정확히 입력해주세요.');
      return;
    }

    showLoading('이전 정보 확인 중...');

    // Supabase에서 가장 최근 예약 조회
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('parent_phone', phone)
      .order('id', { ascending: false })
      .limit(1);

    hideLoading();

    if (
      data &&
      data.length > 0 &&
      data[0].student_name.charAt(0) === studentInitial
    ) {
      previousInfo = {
        studentName: data[0].student_name,
        school: data[0].school,
        grade: data[0].grade,
        mathLevel: data[0].math_level,
      };

      isPreviousInfoLoaded = true;

      showScreen('info');

      setTimeout(() => {
        document.getElementById('school').value = previousInfo.school || '';
        document.getElementById('grade').value = previousInfo.grade || '';

        const maskedName =
          previousInfo.studentName.substring(0, 1) +
          '○'.repeat(previousInfo.studentName.length - 1);
        document.getElementById(
          'studentName'
        ).placeholder = `예: ${maskedName}`;

        document.getElementById('mathLevel').placeholder = '다시 입력해주세요';

        showAlert(
          '학교와 학년 정보를 불러왔습니다. 나머지 정보는 직접 입력해주세요.'
        );
      }, 100);
    } else {
      showAlert('일치하는 정보가 없습니다.');
      isPreviousInfoLoaded = false;
      previousInfo = null;
    }
  } catch (error) {
    hideLoading();

    if (error === 'cancelled') {
      return;
    }

    console.error('Error:', error);
    showAlert('정보 확인 중 오류가 발생했습니다.');
    isPreviousInfoLoaded = false;
    previousInfo = null;
  }
}
