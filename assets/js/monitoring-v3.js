// monitoring-v3.js - VIP 설명회 통합 모니터링 시스템

// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 변수 =====
let allReservations = [];
let allTestApplications = [];
let allConsultingSlots = [];
let currentTab = 'dashboard';
let currentSeminarFilter = 'all';

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('모니터링 v3 초기화');

  // 초기 데이터 로드
  await MonitoringCore.loadAllData();

  // 실시간 구독 설정
  MonitoringCore.setupRealtimeSubscriptions();

  // 이벤트 리스너 설정
  MonitoringCore.setupEventListeners();

  // 대시보드 초기화
  DashboardModule.initialize();
});

// ===== 코어 모듈 =====
const MonitoringCore = {
  async loadAllData() {
    try {
      showLoading(true);

      // 병렬로 데이터 로드
      const [reservations, testApps, consultings] = await Promise.all([
        this.loadReservations(),
        this.loadTestApplications(),
        this.loadConsultingSlots(),
      ]);

      allReservations = reservations || [];
      allTestApplications = testApps || [];
      allConsultingSlots = consultings || [];

      // 각 모듈 업데이트
      this.updateAllModules();
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      showToast('데이터를 불러올 수 없습니다', 'error');
    } finally {
      showLoading(false);
    }
  },

  async loadReservations() {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    return data;
  },

  async loadTestApplications() {
    const { data, error } = await supabase
      .from('test_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async loadConsultingSlots() {
    const { data, error } = await supabase
      .from('consulting_slots')
      .select('*, consulting_reservations(*)')
      .order('date', { ascending: true });

    if (error) throw error;
    return data;
  },

  updateAllModules() {
    // 탭에 따라 업데이트
    switch (currentTab) {
      case 'dashboard':
        DashboardModule.update();
        break;
      case 'seminar':
        SeminarModule.update();
        break;
      case 'checkin':
        CheckinModule.update();
        break;
      case 'test':
        TestModule.update();
        break;
      case 'consulting':
        ConsultingModule.update();
        break;
    }
  },

  switchTab(tabName) {
    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // 탭 컨텐츠 전환
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    currentTab = tabName;
    this.updateAllModules();
  },

  setupRealtimeSubscriptions() {
    // reservations 실시간 구독
    supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          console.log('Reservation 변경:', payload);
          this.handleRealtimeUpdate('reservations', payload);
        }
      )
      .subscribe();

    // test_applications 실시간 구독
    supabase
      .channel('test-applications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'test_applications' },
        (payload) => {
          console.log('Test Application 변경:', payload);
          this.handleRealtimeUpdate('test_applications', payload);
        }
      )
      .subscribe();
  },

  handleRealtimeUpdate(table, payload) {
    // 데이터 재로드
    this.loadAllData();

    // 토스트 메시지
    if (payload.eventType === 'INSERT') {
      showToast(
        `새로운 ${
          table === 'reservations' ? '예약' : '진단검사 신청'
        }이 추가되었습니다`,
        'info'
      );
    }
  },

  setupEventListeners() {
    // 글로벌 설명회 필터
    document
      .getElementById('globalSeminarFilter')
      ?.addEventListener('change', (e) => {
        currentSeminarFilter = e.target.value;
        this.updateAllModules();
      });

    // 새로고침 버튼은 이미 onclick으로 연결됨
  },

  refreshData() {
    this.loadAllData();
    showToast('데이터를 새로고침했습니다', 'success');
  },

  exportData() {
    // 현재 탭에 따라 다른 데이터 내보내기
    switch (currentTab) {
      case 'seminar':
        this.exportSeminarData();
        break;
      case 'test':
        this.exportTestData();
        break;
      case 'checkin':
        this.exportCheckinData();
        break;
      default:
        this.exportAllData();
    }
  },

  exportTestData() {
    let csv = '\uFEFF'; // BOM
    csv +=
      'No,학생명,학교,학년,수학선행,검사유형,HME학년,신청시간,다운로드시간\n';

    allTestApplications.forEach((item, index) => {
      csv += `${index + 1},`;
      csv += `"${item.student_name}",`;
      csv += `"${item.school}",`;
      csv += `"${item.grade}",`;
      csv += `"${item.math_level || '-'}",`;
      csv += `"${item.test_type || '미선택'}",`;
      csv += `"${item.hme_grade || '-'}",`;
      csv += `"${formatDateTime(item.created_at)}",`;
      csv += `"${
        item.downloaded_at ? formatDateTime(item.downloaded_at) : '미다운로드'
      }"\n`;
    });

    downloadCSV(
      csv,
      `진단검사_신청_${new Date().toLocaleDateString('ko-KR')}.csv`
    );
  },

  exportAllData() {
    showToast('전체 데이터를 내보냅니다', 'info');
    // 구현 필요
  },
};

// ===== 유틸리티 함수 =====
function formatDateTime(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  // ISO 문자열에 타임존 정보 확인
  if (dateString.includes('+09:00')) {
    // 이미 KST
    return date.toLocaleString('ko-KR');
  } else if (dateString.endsWith('Z')) {
    // UTC를 KST로 변환
    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kstDate.toLocaleString('ko-KR');
  } else {
    // 타임존 정보가 없으면 로컬 시간으로 간주
    return date.toLocaleString('ko-KR');
  }
}

function formatDateShort(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// 전역 노출
window.MonitoringCore = MonitoringCore;
