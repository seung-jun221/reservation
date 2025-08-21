// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 변수 =====
let currentSeminar = null;
let duplicateReservations = [];
let selectedReservation = null;
let isTestMode = false;

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('체크인 페이지 초기화');

  // URL 파라미터 확인
  const urlParams = new URLSearchParams(window.location.search);
  const seminarId = urlParams.get('sid');
  isTestMode = urlParams.get('test') === 'true';

  if (!seminarId) {
    showError('설명회 정보가 없습니다', '올바른 QR 코드를 스캔해주세요.');
    return;
  }

  // 설명회 정보 로드
  await loadSeminar(seminarId);

  // 이벤트 리스너 설정
  setupEventListeners();
});

// ===== 설명회 정보 로드 =====
async function loadSeminar(seminarId) {
  try {
    showLoading('설명회 정보를 확인하는 중...');

    const { data: seminar, error } = await supabase
      .from('seminars')
      .select('*')
      .eq('id', seminarId)
      .single();

    if (error || !seminar) {
      hideLoading();
      showError('설명회를 찾을 수 없습니다', '올바른 QR 코드를 스캔해주세요.');
      return;
    }

    currentSeminar = seminar;

    // 날짜 체크 (테스트 모드가 아닌 경우)
    if (!isTestMode) {
      const seminarDate = new Date(seminar.date + 'T' + seminar.time);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const seminarDay = new Date(
        seminarDate.getFullYear(),
        seminarDate.getMonth(),
        seminarDate.getDate()
      );

      // 오늘 날짜가 아니면 에러
      if (today.getTime() !== seminarDay.getTime()) {
        hideLoading();
        showError('체크인 불가', '설명회 당일에만 체크인이 가능합니다.');
        return;
      }

      // 설명회 시작 1시간 전부터 종료 2시간 후까지만 체크인 가능
      const checkInStartTime = new Date(seminarDate.getTime() - 60 * 60 * 1000); // 1시간 전
      const checkInEndTime = new Date(seminarDate.getTime() + 180 * 60 * 1000); // 3시간 후

      if (now < checkInStartTime || now > checkInEndTime) {
        hideLoading();
        showError(
          '체크인 시간이 아닙니다',
          `체크인은 ${formatTime(checkInStartTime)} ~ ${formatTime(
            checkInEndTime
          )} 사이에만 가능합니다.`
        );
        return;
      }
    }

    // 설명회 정보 표시
    displaySeminarInfo(seminar);

    // 전화번호 입력 화면 표시
    hideLoading();
    showStep('phoneStep');
  } catch (error) {
    console.error('설명회 로드 실패:', error);
    hideLoading();
    showError('오류가 발생했습니다', '잠시 후 다시 시도해주세요.');
  }
}

// ===== 설명회 정보 표시 =====
function displaySeminarInfo(seminar) {
  const titleElement = document.getElementById('seminarTitle');
  if (titleElement) {
    const location = seminar.title.split('-').pop()?.trim() || seminar.title;
    titleElement.textContent = `${location} - ${formatDate(
      seminar.date
    )} ${formatTime(seminar.time)}`;
  }
}

// ===== 이벤트 리스너 설정 =====
function setupEventListeners() {
  // 전화번호 입력 폼
  const phoneForm = document.getElementById('phoneForm');
  if (phoneForm) {
    phoneForm.addEventListener('submit', handlePhoneSubmit);
  }

  // 중복 확인 폼
  const duplicateForm = document.getElementById('duplicateForm');
  if (duplicateForm) {
    duplicateForm.addEventListener('submit', handleDuplicateSubmit);
  }

  // 전화번호 입력 자동 포맷
  const phoneLast4 = document.getElementById('phoneLast4');
  if (phoneLast4) {
    phoneLast4.addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }

  const phoneMiddle4 = document.getElementById('phoneMiddle4');
  if (phoneMiddle4) {
    phoneMiddle4.addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }
}

// ===== 전화번호 제출 처리 =====
async function handlePhoneSubmit(event) {
  event.preventDefault();

  const last4 = document.getElementById('phoneLast4').value;

  if (last4.length !== 4) {
    showToast('전화번호 뒷 4자리를 입력해주세요', 'error');
    return;
  }

  showLoading('예약 정보를 확인하는 중...');

  try {
    // 뒷 4자리로 예약 검색
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('seminar_id', currentSeminar.id)
      .like('parent_phone', `%${last4}`)
      .in('status', ['예약', '참석']);

    if (error) throw error;

    hideLoading();

    if (!reservations || reservations.length === 0) {
      showError(
        '예약을 찾을 수 없습니다',
        '예약 시 등록한 전화번호를 확인해주세요.'
      );
      return;
    }

    if (reservations.length === 1) {
      // 중복 없음 - 바로 체크인 처리
      selectedReservation = reservations[0];
      await processCheckIn();
    } else {
      // 중복 발견 - 추가 확인 필요
      duplicateReservations = reservations;
      showDuplicateStep(last4);
    }
  } catch (error) {
    console.error('예약 확인 실패:', error);
    hideLoading();
    showToast('오류가 발생했습니다. 다시 시도해주세요.', 'error');
  }
}

// ===== 중복 확인 화면 표시 =====
function showDuplicateStep(last4) {
  // 뒷 4자리 표시
  document.getElementById('phoneSuffix').textContent = `-${last4}`;

  // 화면 전환
  showStep('duplicateStep');

  // 포커스 설정
  setTimeout(() => {
    document.getElementById('phoneMiddle4').focus();
  }, 100);
}

// ===== 중복 확인 제출 처리 =====
async function handleDuplicateSubmit(event) {
  event.preventDefault();

  const middle4 = document.getElementById('phoneMiddle4').value;
  const last4 = document.getElementById('phoneLast4').value;

  if (middle4.length !== 4) {
    showToast('전화번호 중간 4자리를 입력해주세요', 'error');
    return;
  }

  // 중복 예약 중에서 일치하는 것 찾기
  const fullPattern = middle4 + last4;
  const matched = duplicateReservations.find((r) =>
    r.parent_phone.includes(fullPattern)
  );

  if (!matched) {
    showToast('일치하는 예약을 찾을 수 없습니다', 'error');
    return;
  }

  selectedReservation = matched;
  await processCheckIn();
}

// ===== 체크인 처리 =====
async function processCheckIn() {
  if (!selectedReservation) return;

  // 이미 체크인한 경우 확인
  if (
    selectedReservation.status === '참석' &&
    selectedReservation.attendance_checked_at
  ) {
    const checkedTime = new Date(selectedReservation.attendance_checked_at);
    showToast(`이미 ${formatTime(checkedTime)}에 체크인하셨습니다.`, 'info');
    showCompleteStep();
    return;
  }

  showLoading('출석 처리 중...');

  try {
    // 체크인 업데이트
    const { error } = await supabase
      .from('reservations')
      .update({
        status: '참석',
        attendance: '참석',
        attendance_checked_at: new Date().toISOString(),
        attendance_checked_by: 'QR체크인',
      })
      .eq('id', selectedReservation.id);

    if (error) throw error;

    hideLoading();
    showToast('출석이 확인되었습니다!', 'success');
    showCompleteStep();
  } catch (error) {
    console.error('체크인 처리 실패:', error);
    hideLoading();
    showToast('체크인 처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 완료 화면 표시 =====
function showCompleteStep() {
  // 참석자 이름 표시
  const nameElement = document.getElementById('attendeeName');
  if (nameElement && selectedReservation) {
    nameElement.textContent = `${selectedReservation.student_name} 학부모님`;
  }

  // 혜택 타이머 (오늘 자정까지)
  updateBenefitTimer();

  // 화면 전환
  showStep('completeStep');
}

// ===== 혜택 타이머 업데이트 =====
function updateBenefitTimer() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);

  const updateTimer = () => {
    const current = new Date();
    const remaining = midnight - current;

    if (remaining <= 0) {
      const timerElement = document.getElementById('benefitTimer');
      if (timerElement) {
        timerElement.textContent = '종료됨';
        timerElement.style.color = 'var(--gray-500)';
      }
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    const timerElement = document.getElementById('benefitTimer');
    if (timerElement) {
      timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(
        minutes
      ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  };

  updateTimer();
  setInterval(updateTimer, 1000); // 1초마다 업데이트
}

// ===== 컨설팅 예약 페이지로 이동 =====
function goToConsulting() {
  // 컨설팅 예약 페이지로 이동 (추후 구현)
  const consultingUrl = `/consulting.html?code=${selectedReservation.reservation_id.slice(
    -4
  )}`;
  window.location.href = consultingUrl;
}

// ===== 링크 복사 =====
async function copyLink() {
  const consultingUrl = `${window.location.origin}/consulting.html?ref=${selectedReservation.reservation_id}`;

  try {
    await navigator.clipboard.writeText(consultingUrl);

    // 버튼 텍스트 변경
    const copyBtn = document.querySelector('.btn-copy');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '복사 완료!';
    copyBtn.style.background = 'var(--success-color)';
    copyBtn.style.color = 'white';

    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '';
      copyBtn.style.color = '';
    }, 2000);

    showToast(
      '링크가 복사되었습니다! 카카오톡 나와의 채팅에 붙여넣기 해주세요.',
      'success'
    );
  } catch (err) {
    console.error('복사 실패:', err);
    showToast('링크 복사에 실패했습니다.', 'error');
  }
}

// ===== 카카오톡 공유 =====
function shareKakao() {
  // 카카오톡 공유 (Kakao SDK 필요)
  showToast('카카오톡 공유 기능은 준비 중입니다.', 'info');
}

// ===== 홈으로 이동 =====
function goHome() {
  window.location.href = '/';
}

// ===== 뒤로 가기 =====
function backToPhoneStep() {
  showStep('phoneStep');
  document.getElementById('phoneMiddle4').value = '';
}

// ===== 다시 시도 =====
function retryCheckIn() {
  location.reload();
}

// ===== 화면 전환 =====
function showStep(stepId) {
  // 모든 섹션 숨기기
  const sections = document.querySelectorAll('.section-card');
  sections.forEach((section) => {
    section.classList.add('hidden');
  });

  // 선택된 섹션만 표시
  const targetSection = document.getElementById(stepId);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }
}

// ===== 에러 표시 =====
function showError(title, message) {
  document
    .getElementById('errorStep')
    .querySelector('.error-title').textContent = title;
  document.getElementById('errorStep').querySelector('.error-desc').innerHTML =
    message;
  showStep('errorStep');
}

// ===== 로딩 표시 =====
function showLoading(message = '처리 중...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
  }
}

// ===== 로딩 숨기기 =====
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ===== 토스트 메시지 =====
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
    <span>${icons[type]}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // 3초 후 자동 제거
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== 유틸리티 함수 =====

// 날짜 포맷팅
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[date.getDay()];
  return `${month}/${day}(${dayName})`;
}

// 시간 포맷팅
function formatTime(timeStr) {
  let date;

  if (typeof timeStr === 'string' && timeStr.includes(':')) {
    // "10:30" 또는 "10:30:00" 형식 처리
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);

    date = new Date();
    date.setHours(hours, minutes);
  } else if (timeStr instanceof Date) {
    // Date 객체인 경우
    date = timeStr;
  } else {
    // ISO 문자열 등 다른 형식
    date = new Date(timeStr);
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? '오전' : '오후';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinute = String(minutes).padStart(2, '0');

  return `${period} ${displayHour}:${displayMinute}`;
}

// ===== 전역 함수 등록 (HTML에서 호출) =====
window.goToConsulting = goToConsulting;
window.copyLink = copyLink;
window.shareKakao = shareKakao;
window.goHome = goHome;
window.backToPhoneStep = backToPhoneStep;
window.retryCheckIn = retryCheckIn;
