// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 변수 =====
let currentQR = null;
let selectedSeminar = null;
let realtimeSubscription = null;
let statsInterval = null;

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('QR Generator 초기화');
  await loadSeminars();
  setupRealtimeUpdates();

  // 이벤트 리스너 설정
  const seminarSelect = document.getElementById('seminarSelect');
  if (seminarSelect) {
    seminarSelect.addEventListener('change', handleSeminarChange);
  }
});

// ===== 설명회 목록 로드 =====
async function loadSeminars() {
  try {
    showLoading('설명회 목록을 불러오는 중...');

    const { data: seminars, error } = await supabase
      .from('seminars')
      .select('*')
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (error) throw error;

    const select = document.getElementById('seminarSelect');
    select.innerHTML = '<option value="">설명회를 선택하세요</option>';

    seminars.forEach((seminar) => {
      const option = document.createElement('option');
      option.value = seminar.id;
      const date = formatDate(seminar.date);
      option.textContent = `${date} - ${seminar.title}`;
      select.appendChild(option);
    });

    hideLoading();
    console.log(`${seminars.length}개 설명회 로드 완료`);
  } catch (error) {
    console.error('설명회 로드 실패:', error);
    hideLoading();
    showToast('설명회 목록을 불러올 수 없습니다.', 'error');
  }
}

// ===== 설명회 선택 처리 =====
async function handleSeminarChange(event) {
  const seminarId = event.target.value;

  if (!seminarId) {
    resetDisplay();
    return;
  }

  try {
    // 설명회 정보 가져오기
    const { data: seminar, error } = await supabase
      .from('seminars')
      .select('*')
      .eq('id', seminarId)
      .single();

    if (error) throw error;

    selectedSeminar = seminar;
    displaySeminarInfo(seminar);
    generateQRCode(seminar);
    await loadStats(seminarId);

    // 통계 자동 새로고침 시작
    startStatsRefresh(seminarId);

    // 미리보기 버튼 활성화 및 안내 문구 숨기기
    enablePreviewButton();
  } catch (error) {
    console.error('설명회 정보 로드 실패:', error);
    showToast('설명회 정보를 불러올 수 없습니다.', 'error');
  }
}

// ===== 미리보기 버튼 활성화 =====
function enablePreviewButton() {
  const previewBtn = document.getElementById('previewBtn');
  const previewHint = document.getElementById('previewHint');

  if (previewBtn) {
    previewBtn.disabled = false;
    previewBtn.innerHTML = '📱 체크인 페이지 미리보기';
  }

  if (previewHint) {
    previewHint.style.display = 'none';
  }
}

// ===== 미리보기 버튼 비활성화 =====
function disablePreviewButton() {
  const previewBtn = document.getElementById('previewBtn');
  const previewHint = document.getElementById('previewHint');

  if (previewBtn) {
    previewBtn.disabled = true;
    previewBtn.innerHTML = '📱 체크인 페이지 미리보기';
  }

  if (previewHint) {
    previewHint.style.display = 'block';
    previewHint.textContent = '먼저 상단에서 설명회를 선택해주세요';
  }
}

// ===== 설명회 정보 표시 =====
function displaySeminarInfo(seminar) {
  document.getElementById('seminarInfo').style.display = 'block';
  document.getElementById('infoTitle').textContent = seminar.title;
  document.getElementById('infoDateTime').textContent = `${formatDate(
    seminar.date
  )} ${formatTime(seminar.time)}`;
  document.getElementById('infoLocation').textContent = seminar.location || '-';
  document.getElementById('infoCapacity').textContent = `${
    seminar.display_capacity || seminar.max_capacity
  }명`;
}

// ===== QR 코드 생성 =====
function generateQRCode(seminar) {
  const container = document.getElementById('qrcode');
  container.innerHTML = '';

  // QR 코드에 포함될 URL
  const baseUrl = window.location.origin;
  const checkInUrl = `${baseUrl}/checkin.html?sid=${seminar.id}`;

  // QR 코드 생성
  currentQR = new QRCode(container, {
    text: checkInUrl,
    width: 256,
    height: 256,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });

  // URL 표시
  document.getElementById('qrUrl').style.display = 'block';
  document.getElementById('urlText').textContent = checkInUrl;

  // 액션 버튼 활성화
  document.getElementById('qrActions').style.display = 'flex';
  document.getElementById('guideSection').style.display = 'block';

  console.log('QR 코드 생성 완료:', checkInUrl);
}

// ===== 통계 로드 =====
async function loadStats(seminarId) {
  try {
    // 전체 예약 수
    const { count: totalCount } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('seminar_id', seminarId)
      .in('status', ['예약', '참석']);

    // 체크인 완료 수
    const { count: checkedInCount } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('seminar_id', seminarId)
      .eq('status', '참석')
      .not('attendance_checked_at', 'is', null);

    // 미체크인 수
    const pendingCount = (totalCount || 0) - (checkedInCount || 0);

    // 통계 표시
    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('totalReservations').textContent = totalCount || 0;
    document.getElementById('checkedInCount').textContent = checkedInCount || 0;
    document.getElementById('pendingCount').textContent = pendingCount;

    // 체크인율 계산
    const rate =
      totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;
    document.getElementById('checkInRate').textContent = `${rate}%`;
  } catch (error) {
    console.error('통계 로드 실패:', error);
  }
}

// ===== 통계 자동 새로고침 =====
function startStatsRefresh(seminarId) {
  // 기존 인터벌 제거
  if (statsInterval) {
    clearInterval(statsInterval);
  }

  // 10초마다 통계 새로고침
  statsInterval = setInterval(() => {
    if (selectedSeminar && selectedSeminar.id === seminarId) {
      loadStats(seminarId);
    }
  }, 10000);
}

// ===== 실시간 업데이트 설정 =====
function setupRealtimeUpdates() {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }

  realtimeSubscription = supabase
    .channel('qr-checkin-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        if (selectedSeminar && payload.new?.seminar_id === selectedSeminar.id) {
          console.log('실시간 업데이트 감지');
          loadStats(selectedSeminar.id);
        }
      }
    )
    .subscribe();
}

// ===== QR 코드 다운로드 =====
function downloadQR() {
  if (!currentQR || !selectedSeminar) return;

  const canvas = document.querySelector('#qrcode canvas');
  if (!canvas) {
    showToast('QR 코드를 먼저 생성해주세요.', 'error');
    return;
  }

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR_${selectedSeminar.title}_${formatDate(
    selectedSeminar.date
  )}.png`;
  a.click();

  showToast('QR 코드가 다운로드되었습니다.', 'success');
}

// ===== QR 코드 인쇄 =====
function printQR() {
  if (!currentQR || !selectedSeminar) {
    showToast('QR 코드를 먼저 생성해주세요.', 'error');
    return;
  }

  window.print();
}

// ===== URL 복사 =====
async function copyUrl() {
  const urlText = document.getElementById('urlText').textContent;

  try {
    await navigator.clipboard.writeText(urlText);

    const btn = document.querySelector('.btn-copy');
    const originalText = btn.textContent;
    btn.textContent = '복사됨!';
    btn.style.background = 'var(--success-color)';

    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);

    showToast('URL이 복사되었습니다.', 'success');
  } catch (err) {
    console.error('복사 실패:', err);
    // 폴백: 텍스트 선택
    const textElement = document.getElementById('urlText');
    const range = document.createRange();
    range.selectNode(textElement);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    showToast('URL을 수동으로 복사해주세요.', 'info');
  }
}

// ===== 통계 새로고침 =====
function refreshStats() {
  if (!selectedSeminar) {
    showToast('먼저 설명회를 선택해주세요.', 'warning');
    return;
  }

  loadStats(selectedSeminar.id);
  showToast('통계를 새로고침했습니다.', 'success');
}

// ===== 체크인 페이지 미리보기 =====
function openCheckinPage() {
  if (!selectedSeminar) {
    showToast('먼저 설명회를 선택해주세요', 'warning');
    return;
  }

  // 선택된 설명회 ID와 함께 체크인 페이지 열기
  // test=true 파라미터 추가하여 날짜 체크 스킵
  window.open(`/checkin.html?sid=${selectedSeminar.id}&test=true`, '_blank');
}

// ===== 화면 초기화 =====
function resetDisplay() {
  document.getElementById('seminarInfo').style.display = 'none';
  document.getElementById('statsSection').style.display = 'none';
  document.getElementById('qrUrl').style.display = 'none';
  document.getElementById('qrActions').style.display = 'none';
  document.getElementById('guideSection').style.display = 'none';

  const qrContainer = document.getElementById('qrcode');
  qrContainer.innerHTML = `
    <div class="qr-placeholder">
      <div class="placeholder-icon">📱</div>
      <p>설명회를 선택하면 QR 코드가 생성됩니다</p>
    </div>
  `;

  selectedSeminar = null;
  currentQR = null;

  // 통계 새로고침 중지
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }

  // 미리보기 버튼 비활성화
  disablePreviewButton();
}

// ===== 유틸리티 함수 =====

// 날짜 포맷팅
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[date.getDay()];
  return `${year}.${month}.${day}(${dayName})`;
}

// 시간 포맷팅
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}시${minutes !== '00' ? ` ${minutes}분` : ''}`;
}

// 로딩 표시
function showLoading(message = '처리 중...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
  }
}

// 로딩 숨기기
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
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

// 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    to {
      transform: translateX(120%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ===== 페이지 언로드 시 정리 =====
window.addEventListener('beforeunload', () => {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }
  if (statsInterval) {
    clearInterval(statsInterval);
  }
});

// ===== 전역 함수로 노출 (HTML에서 호출용) =====
window.downloadQR = downloadQR;
window.printQR = printQR;
window.copyUrl = copyUrl;
window.refreshStats = refreshStats;
window.openCheckinPage = openCheckinPage;
