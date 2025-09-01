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
let currentPhone = '';
let isOfflineRegistration = false;

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
      const checkInStartTime = new Date(seminarDate.getTime() - 60 * 60 * 1000);
      const checkInEndTime = new Date(seminarDate.getTime() + 180 * 60 * 1000);

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

  // 오프라인 등록 폼
  const offlineForm = document.getElementById('offlineForm');
  if (offlineForm) {
    offlineForm.addEventListener('submit', handleOfflineSubmit);
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

  // 현장등록 전화번호 자동 포맷팅 추가
  const offlinePhone = document.getElementById('offlinePhone');
  if (offlinePhone) {
    offlinePhone.addEventListener('input', function (e) {
      let value = e.target.value.replace(/[^0-9]/g, '');

      if (value.length > 3 && value.length <= 7) {
        value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
      } else if (value.length > 7 && value.length <= 10) {
        value = value.replace(/(\d{3})(\d{3})(\d{1,4})/, '$1-$2-$3');
      } else if (value.length > 10) {
        value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }

      e.target.value = value;
    });
  }
}

// ===== 전화번호 제출 처리 (수정) =====
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
      // 예약이 없는 경우 - 팝업 메시지 후 현장 등록으로 진행
      showToast('개인정보 확인이 안되어 입력창으로 이동합니다.', 'info');

      // 짧은 딜레이 후 현장 등록 화면으로 이동
      setTimeout(() => {
        // currentPhone 초기화 (전체 번호를 받을 준비)
        currentPhone = '';
        showOfflineRegistration(last4);
      }, 1500);
      return;
    }

    if (reservations.length === 1) {
      // 중복 없음 - 바로 체크인 처리
      selectedReservation = reservations[0];
      isOfflineRegistration = false;
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

// ===== 현장 등록 화면 표시 (수정) =====
function showOfflineRegistration(last4) {
  // 전체 전화번호 입력 필드로 변경
  const phoneInput = document.getElementById('offlinePhone');

  // 뒷 4자리만 미리 채워두고 앞자리 입력 가능하게
  phoneInput.value = '';
  phoneInput.placeholder = '010-0000-0000';
  phoneInput.setAttribute('data-last4', last4); // 뒷 4자리 저장

  // readonly 속성 제거하여 편집 가능하게
  phoneInput.removeAttribute('readonly');

  // 화면 전환
  showStep('infoStep');

  // 전화번호 입력 필드에 포커스
  setTimeout(() => {
    phoneInput.focus();
    // 안내 메시지 표시
    showToast('전체 전화번호를 입력해주세요', 'info');
  }, 100);
}

// ===== 현장 등록 처리 (수정) =====
async function handleOfflineSubmit(event) {
  event.preventDefault();

  const phoneValue = document.getElementById('offlinePhone').value.trim();
  const studentName = document
    .getElementById('offlineStudentName')
    .value.trim();
  const school = document.getElementById('offlineSchool').value.trim();
  const grade = document.getElementById('offlineGrade').value;
  const mathLevel = document.getElementById('offlineMathLevel').value.trim();
  const privacyConsent = document.getElementById('offlinePrivacy').checked;

  // 전화번호 유효성 검사
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  const cleanPhone = phoneValue.replace(/-/g, '');

  if (!phoneRegex.test(cleanPhone)) {
    showToast('올바른 전화번호 형식을 입력해주세요 (010-0000-0000)', 'error');
    return;
  }

  // 전화번호 포맷팅 (하이픈 추가)
  let formattedPhone = cleanPhone;
  if (cleanPhone.length === 11) {
    formattedPhone = cleanPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (cleanPhone.length === 10) {
    formattedPhone = cleanPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }

  // 뒷 4자리 검증 (필요한 경우)
  const last4 = document
    .getElementById('offlinePhone')
    .getAttribute('data-last4');
  if (last4 && !formattedPhone.endsWith(last4)) {
    showToast('입력한 전화번호 뒷 4자리가 일치하지 않습니다.', 'error');
    return;
  }

  if (!privacyConsent) {
    showToast('개인정보 수집 및 이용에 동의해주세요.', 'error');
    return;
  }

  showLoading('체크인 처리 중...');

  try {
    // 간단한 비밀번호 생성 (현장등록은 000000)
    const hashedPassword = hashPassword('000000');

    // 실제 전화번호 저장
    currentPhone = formattedPhone;

    // 예약 데이터 생성
    const reservationData = {
      reservation_id: 'OFFLINE' + Date.now(),
      seminar_id: currentSeminar.id,
      student_name: studentName,
      parent_phone: formattedPhone, // 실제 전화번호 저장
      school: school,
      grade: grade,
      math_level: mathLevel,
      password: hashedPassword,
      privacy_consent: 'Y',
      status: '참석',
      attendance: '참석',
      attendance_checked_at: new Date().toISOString(),
      attendance_checked_by: 'QR체크인(현장)',
      checkin_type: 'offline',
      notes: '현장 등록',
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    if (error) throw error;

    selectedReservation = data;
    isOfflineRegistration = true;

    hideLoading();
    showToast('체크인이 완료되었습니다!', 'success');
    showCompleteStep();
  } catch (error) {
    console.error('현장 등록 실패:', error);
    hideLoading();
    showToast('등록 처리 중 오류가 발생했습니다.', 'error');
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

// ===== 중복 확인 제출 처리 (수정) =====
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
    // 일치하는 예약이 없으면 팝업 후 현장 등록으로
    showToast('개인정보 확인이 안되어 입력창으로 이동합니다.', 'info');

    setTimeout(() => {
      // 전체 전화번호 설정
      currentPhone = `010${middle4}${last4}`;
      showOfflineRegistration(last4);
    }, 1500);
    return;
  }

  selectedReservation = matched;
  isOfflineRegistration = false;
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
        checkin_type: 'online',
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

// ===== 완료 화면 표시 (개선) =====
function showCompleteStep() {
  // 참석자 이름 표시
  const nameElement = document.getElementById('attendeeName');
  if (nameElement && selectedReservation) {
    nameElement.textContent = `${selectedReservation.student_name} 학부모님`;
  }

  // 추가 정보 표시 (필요시)
  const completeInfo = document.getElementById('completeInfo');
  if (completeInfo && selectedReservation) {
    const registrationType = isOfflineRegistration ? '현장 등록' : '사전 예약';
    completeInfo.innerHTML = `
      <div style="text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 5px 0; color: #666;">등록 구분: <strong>${registrationType}</strong></p>
        <p style="margin: 5px 0; color: #666;">체크인 시간: <strong>${formatTime(
          new Date()
        )}</strong></p>
      </div>
    `;
  }

  // 화면 전환
  showStep('completeStep');
}

// ===== 진단검사 선택 =====
async function selectTest() {
  if (!selectedReservation) return;

  showLoading('처리 중...');

  try {
    // 선택 저장
    const { error } = await supabase
      .from('reservations')
      .update({
        post_checkin_choice: 'test',
        post_checkin_at: new Date().toISOString(),
      })
      .eq('id', selectedReservation.id);

    if (error) throw error;

    hideLoading();

    // 최종 안내 화면 표시
    document.getElementById('finalIcon').textContent = '📝';
    document.getElementById('finalTitle').textContent =
      '진단검사 신청이 완료되었습니다';
    document.getElementById('finalDesc').textContent =
      '오늘중으로 진단검사를 예약할 수 있는 링크를 발송해드리겠습니다.';

    showStep('finalStep');
  } catch (error) {
    console.error('선택 저장 실패:', error);
    hideLoading();
    showToast('처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 상담 선택 =====
async function selectConsult() {
  if (!selectedReservation) return;

  showLoading('처리 중...');

  try {
    // 선택 저장
    const { error } = await supabase
      .from('reservations')
      .update({
        post_checkin_choice: 'consult',
        post_checkin_at: new Date().toISOString(),
      })
      .eq('id', selectedReservation.id);

    if (error) throw error;

    hideLoading();

    // 최종 안내 화면 표시
    document.getElementById('finalIcon').textContent = '💬';
    document.getElementById('finalTitle').textContent =
      '상담 요청이 완료되었습니다';
    document.getElementById('finalDesc').textContent =
      '내일까지 개별 전화연락드리겠습니다.';

    showStep('finalStep');
  } catch (error) {
    console.error('선택 저장 실패:', error);
    hideLoading();
    showToast('처리 중 오류가 발생했습니다.', 'error');
  }
}

// ===== 현장 예약 진행 =====
function proceedOfflineReg() {
  const last4 = document.getElementById('phoneLast4').value || '0000';
  showOfflineRegistration(last4);
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

// 비밀번호 해싱
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
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);

    date = new Date();
    date.setHours(hours, minutes);
  } else if (timeStr instanceof Date) {
    date = timeStr;
  } else {
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
window.selectTest = selectTest;
window.selectConsult = selectConsult;
window.goHome = goHome;
window.backToPhoneStep = backToPhoneStep;
window.proceedOfflineReg = proceedOfflineReg;
