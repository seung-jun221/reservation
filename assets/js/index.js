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

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function () {
  isPreviousInfoLoaded = false;
  previousInfo = null;
  isWaitlistReservation = false;
  const noticeElement = document.getElementById('infoLoadedNotice');
  if (noticeElement) {
    noticeElement.classList.add('hidden');
    noticeElement.style.display = 'none';
  }
  console.log('페이지 로드 - 초기화 완료');

  // 초기 로드 시 설명회 정보 확인
  loadSeminarSchedule()
    .then(() => {
      displaySeminarSelection();
    })
    .catch((error) => {
      console.error('초기 로드 실패:', error);
      showAlert('설명회 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
    });
});

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

// 설명회 정보 로드
async function loadSeminarSchedule() {
  try {
    const response = await fetch(`${API_URL}?action=getSeminarSchedule`);
    if (!response.ok) throw new Error('네트워크 응답 실패');

    const data = await response.json();

    if (data.success && data.schedule && data.schedule.length > 0) {
      // 활성화되고 아직 진행되지 않은 설명회만 필터링
      seminarSchedule = data.schedule.filter(
        (s) => s.status === 'active' && !s.isPast
      );

      console.log('활성 설명회:', seminarSchedule);
      return true;
    } else {
      throw new Error('활성화된 설명회가 없습니다');
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// 설명회 선택 화면 표시
function displaySeminarSelection() {
  const container = document.getElementById('seminarSelectionArea');

  if (seminarSchedule.length === 0) {
    container.innerHTML = `
            <div class="error">
                현재 예약 가능한 설명회가 없습니다.<br>
                추후 일정을 확인해주세요.
            </div>
        `;
    // 선택 가이드 문구 숨기기
    document.querySelector('.select-guide').style.display = 'none';
    return;
  }

  if (seminarSchedule.length === 1) {
    // 설명회가 1개면 자동 선택
    selectSeminar(seminarSchedule[0].id);
    return;
  }

  // 여러 개일 때 선택 화면 (h3 제목 제거)
  container.innerHTML = `
        <div class="seminar-selection">
            <div class="seminar-options">
                ${seminarSchedule
                  .map((seminar) => {
                    const isFull = seminar.reserved >= seminar.maxCapacity;
                    const availablePercent =
                      (seminar.available / seminar.displayCapacity) * 100;
                    const isNearFull = availablePercent < 30 && !isFull;

                    let availabilityBadge = '';
                    if (isFull) {
                      availabilityBadge =
                        '<span class="availability-badge full">마감</span>';
                    } else if (isNearFull) {
                      availabilityBadge =
                        '<span class="availability-badge limited">마감임박</span>';
                    } else {
                      availabilityBadge =
                        '<span class="availability-badge available">예약가능</span>';
                    }

                    return `
                        <div class="seminar-option" onclick="selectSeminar('${
                          seminar.id
                        }')">
                            ${availabilityBadge}
                            <h4>${seminar.title}</h4>
                            <p>${formatDate(seminar.date)} ${formatTime(
                      seminar.time
                    )}</p>
                            <p>${seminar.location}</p>
                        </div>
                    `;
                  })
                  .join('')}
            </div>
        </div>
    `;
}
// 설명회 선택 시
function selectSeminar(seminarId) {
  selectedSeminar = seminarSchedule.find((s) => s.id === seminarId);

  if (!selectedSeminar) {
    showAlert('잘못된 설명회 선택입니다.');
    return;
  }

  // 선택된 설명회 표시 업데이트
  document.querySelectorAll('.seminar-option').forEach((option) => {
    option.classList.remove('selected');
  });

  if (event && event.target) {
    event.target.closest('.seminar-option').classList.add('selected');
  }

  // 선택 가이드 문구를 선택된 설명회 정보로 변경
  document.querySelector('.select-guide').innerHTML = `
        <strong style="color: #1a73e8;">${selectedSeminar.title}</strong> 선택됨
    `;

  // 설명회 정보 업데이트
  updateSelectedSeminarInfo();

  // 예약 버튼 활성화
  const reserveBtn = document.getElementById('reserveBtn');
  reserveBtn.disabled = false;
  reserveBtn.textContent = selectedSeminar.isFull
    ? '대기예약 신청하기'
    : '설명회 예약하기';
  reserveBtn.className = selectedSeminar.isFull
    ? 'btn btn-waitlist'
    : 'btn btn-primary';
}

// 선택된 설명회 정보 업데이트 (잔여석 제거)
function updateSelectedSeminarInfo() {
  const infoBox = document.getElementById('defaultInfoBox');

  if (selectedSeminar) {
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
    if (selectedSeminar.isFull) {
      document.getElementById('fullNotice').classList.remove('hidden');
    } else {
      document.getElementById('fullNotice').classList.add('hidden');
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

// 이전 정보 확인 및 불러오기 (보안 강화 버전)
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
        // 최소 정보만 자동 입력 (학교, 학년)
        document.getElementById('school').value = previousInfo.school || '';
        document.getElementById('grade').value = previousInfo.grade || '';

        // 민감 정보는 힌트만 제공
        const nameHint = document.getElementById('studentNameHint');
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
      // 사용자가 취소한 경우
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
    await loadSeminarSchedule();
    if (!selectedSeminar) {
      showAlert('설명회 정보를 불러올 수 없습니다. 다시 시도해주세요.');
      return;
    }
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '처리중...';
  isSubmitting = true;

  // 대기예약 여부 결정 - selectedSeminar.isFull로만 판단
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
      isWaitlist: isWaitlist, // 대기예약 여부 추가
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
      if (result.isWaitlist) {
        // 대기예약 완료 화면
        document.getElementById('completeTitle').textContent =
          '대기예약이 완료되었습니다';
        document.getElementById('completeSubtitle').textContent =
          '취소자 발생 시 순번대로 연락드리겠습니다.';
        document.getElementById('completionInfo').innerHTML = `
                    <p><strong>예약번호:</strong> ${result.reservationId}</p>
                    <p><strong>대기순번:</strong> ${
                      result.waitlistNumber || '-'
                    }번째</p>
                    <p><strong>설명회:</strong> ${result.seminarInfo.title}</p>
                    <p><strong>날짜:</strong> ${formatDate(
                      result.seminarInfo.date
                    )}</p>
                    <p><strong>시간:</strong> ${formatTime(
                      result.seminarInfo.time
                    )}</p>
                    <p><strong>장소:</strong> ${result.seminarInfo.location}</p>
                    <p><strong>학생명:</strong> ${
                      reservationData.studentName
                    }</p>
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
                    <p><strong>날짜:</strong> ${formatDate(
                      result.seminarInfo.date
                    )}</p>
                    <p><strong>시간:</strong> ${formatTime(
                      result.seminarInfo.time
                    )}</p>
                    <p><strong>소요시간:</strong> ${
                      result.seminarInfo.duration || '90분'
                    }</p>
                    <p><strong>장소:</strong> ${result.seminarInfo.location}</p>
                    <p><strong>학생명:</strong> ${
                      reservationData.studentName
                    }</p>
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
        // 대기번호 파싱 (예: "대기 3번")
        const waitlistMatch = data.reservation.notes.match(/대기\s*(\d+)번/);
        const waitlistNumber = waitlistMatch ? waitlistMatch[1] : '-';
        reservationTypeText = `<p style="color: #c2185b;"><strong>예약 유형:</strong> 대기예약 (${waitlistNumber}번째)</p>`;
      }

      document.getElementById('reservationInfo').innerHTML = `
                <p><strong>예약번호:</strong> ${
                  data.reservation.reservationId
                }</p>
                ${reservationTypeText}
                <p><strong>설명회:</strong> ${
                  data.reservation.seminarInfo.title
                }</p>
                <p><strong>날짜:</strong> ${formatDate(
                  data.reservation.seminarInfo.date
                )}</p>
                <p><strong>시간:</strong> ${formatTime(
                  data.reservation.seminarInfo.time
                )}</p>
                <p><strong>소요시간:</strong> ${
                  data.reservation.seminarInfo.duration || '90분'
                }</p>
                <p><strong>장소:</strong> ${
                  data.reservation.seminarInfo.location
                }</p>
                <p><strong>학생명:</strong> ${data.reservation.studentName}</p>
                <p><strong>연락처:</strong> ${data.reservation.parentPhone}</p>
                <p><strong>학교:</strong> ${data.reservation.school}</p>
                <p><strong>학년:</strong> ${data.reservation.grade}</p>
                <p><strong>수학 선행정도:</strong> ${
                  data.reservation.mathLevel
                }</p>
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
