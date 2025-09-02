// monitoring-v3.js - 개선된 VIP 설명회 통합 모니터링 시스템

// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 상태 관리 =====
const globalState = {
  selectedSeminar: null, // null = 전체, 또는 seminar_id
  seminarInfo: null,
  seminars: [],
  cache: {
    reservations: [],
    testApplications: [],
    consultingSlots: [],
    consultingReservations: [],
  },
  filters: {
    status: '',
    searchText: '',
    dateRange: null,
  },
  currentTab: 'dashboard',
  realtimeSubscriptions: [],
};

// ===== 데이터 저장소 (필터링 전 원본) =====
let allReservations = [];
let allTestApplications = [];
let allConsultingSlots = [];
let allConsultingReservations = [];
let allSeminars = [];

// ===== 필터링된 데이터 (전역 접근 가능) =====
window.filteredReservations = [];
window.filteredTestApplications = [];
window.filteredConsultingSlots = [];
window.filteredConsultingReservations = [];

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async function () {
  console.log('모니터링 v3 개선버전 초기화');

  // 초기 데이터 로드
  await MonitoringCore.initialize();
});

// ===== 코어 모듈 =====
const MonitoringCore = {
  async initialize() {
    try {
      showLoading(true);

      // 설명회 정보 먼저 로드
      await this.loadSeminars();

      // 전체 데이터 로드
      await this.loadAllData();

      // UI 초기화
      this.initializeUI();

      // 실시간 구독 설정
      this.setupRealtimeSubscriptions();

      // 이벤트 리스너 설정
      this.setupEventListeners();

      // 대시보드 초기화
      DashboardModule.initialize();

      showToast('모니터링 시스템 준비 완료', 'success');
    } catch (error) {
      console.error('초기화 실패:', error);
      showToast('시스템 초기화 실패', 'error');
    } finally {
      showLoading(false);
    }
  },

  async loadSeminars() {
    const { data: seminars, error } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('설명회 로드 실패:', error);
      return;
    }

    // ID는 문자열로 유지
    allSeminars = seminars || [];
    globalState.seminars = allSeminars;
    console.log('설명회 데이터 로드:', allSeminars.length, '개');
    console.log(
      '설명회 ID 샘플:',
      allSeminars.map((s) => s.id)
    );

    // 설명회 선택기 업데이트
    this.updateSeminarSelector();
  },

  updateSeminarSelector() {
    const selector = document.getElementById('globalSeminarFilter');
    if (!selector) return;

    // 기존 옵션 유지 (전체, 구분선)
    selector.innerHTML = `
      <option value="all">📊 전체 설명회</option>
      <option value="divider" disabled>──────────────</option>
    `;

    // 설명회 옵션 추가
    allSeminars.forEach((seminar) => {
      const date = new Date(seminar.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

      // 제목에서 위치 추출
      let location = '설명회';
      if (seminar.title) {
        const parts = seminar.title.split('-');
        if (parts.length > 1) {
          location = parts[parts.length - 1].trim();
        } else {
          // 하이픈이 없으면 제목을 짧게 표시
          location =
            seminar.title
              .replace('VIP 학부모 설명회', '')
              .replace('수학의 아침', '수학')
              .trim() || '설명회';
        }
      }

      const option = document.createElement('option');
      option.value = seminar.id; // 문자열 ID 그대로 사용
      option.textContent = `${dateStr} ${location}`;
      selector.appendChild(option);
    });

    console.log(
      '설명회 선택기 업데이트 완료:',
      allSeminars.map((s) => ({ id: s.id, title: s.title }))
    );
  },

  async loadAllData() {
    try {
      console.log('전체 데이터 로드 시작...');

      // 병렬로 모든 데이터 로드
      const [reservations, testApps, consultingSlots, consultingReservations] =
        await Promise.all([
          this.loadReservations(),
          this.loadTestApplications(),
          this.loadConsultingSlots(),
          this.loadConsultingReservations(),
        ]);

      allReservations = reservations || [];
      allTestApplications = testApps || [];
      allConsultingSlots = consultingSlots || [];
      allConsultingReservations = consultingReservations || [];

      // 데이터 캐시
      globalState.cache.reservations = allReservations;
      globalState.cache.testApplications = allTestApplications;
      globalState.cache.consultingSlots = allConsultingSlots;
      globalState.cache.consultingReservations = allConsultingReservations;

      console.log('데이터 로드 완료:', {
        예약: allReservations.length,
        진단검사: allTestApplications.length,
        컨설팅슬롯: allConsultingSlots.length,
        컨설팅예약: allConsultingReservations.length,
      });

      // 필터링 적용
      this.applyGlobalFilter();
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      throw error;
    }
  },

  async loadReservations() {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error) throw error;

    // ID는 문자열로 유지
    console.log('예약 데이터 로드 완료:', (data || []).length);
    if (data && data.length > 0) {
      console.log('예약 샘플 seminar_id:', data[0].seminar_id);
    }
    return data || [];
  },

  async loadTestApplications() {
    const { data, error } = await supabase
      .from('test_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('진단검사 데이터 로드 완료:', (data || []).length);
    return data || [];
  },

  async loadConsultingSlots() {
    const { data, error } = await supabase
      .from('consulting_slots')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;

    console.log('컨설팅 슬롯 로드 완료:', (data || []).length);
    return data || [];
  },

  async loadConsultingReservations() {
    const { data, error } = await supabase
      .from('consulting_reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('컨설팅 예약 로드 완료:', (data || []).length);
    return data || [];
  },

  applyGlobalFilter() {
    const seminarId = globalState.selectedSeminar;

    console.log('필터링 시작 - 선택된 설명회 ID:', seminarId);
    console.log('전체 예약 데이터:', allReservations.length);
    console.log(
      '전체 설명회 목록:',
      allSeminars.map((s) => ({ id: s.id, title: s.title }))
    );

    // 첫 번째 예약 데이터의 구조 확인
    if (allReservations.length > 0) {
      console.log('예약 데이터 샘플:', {
        id: allReservations[0].id,
        seminar_id: allReservations[0].seminar_id,
        student_name: allReservations[0].student_name,
      });
    }

    // 설명회 필터링
    if (!seminarId || seminarId === 'all' || seminarId === null) {
      // 전체 선택시
      window.filteredReservations = [...allReservations];
      window.filteredTestApplications = [...allTestApplications];
      window.filteredConsultingSlots = [...allConsultingSlots];
      window.filteredConsultingReservations = [...allConsultingReservations];

      console.log('전체 데이터 표시');
    } else {
      // 특정 설명회 선택시 - 문자열로 비교
      console.log('선택된 설명회 ID (문자열):', seminarId);

      // 예약 데이터 필터링 - 문자열로 비교
      window.filteredReservations = allReservations.filter((r) => {
        // seminar_id 또는 seminars_id 체크 (테이블 구조가 다를 수 있음)
        const rSeminarId = r.seminar_id || r.seminars_id || r.seminar;

        if (rSeminarId === undefined || rSeminarId === null) {
          return false;
        }

        // 문자열로 비교
        return String(rSeminarId) === String(seminarId);
      });

      console.log(
        `설명회 "${seminarId}" 필터링 결과:`,
        window.filteredReservations.length,
        '건'
      );

      if (window.filteredReservations.length === 0) {
        console.warn('필터링된 예약이 없습니다. 데이터를 확인하세요.');
      }

      // 해당 설명회 예약자들의 ID와 전화번호 추출
      const reservationIds = window.filteredReservations.map((r) => r.id);
      const phoneNumbers = window.filteredReservations
        .map((r) => r.parent_phone?.replace(/-/g, ''))
        .filter((p) => p);
      const studentNames = window.filteredReservations
        .map((r) => r.student_name)
        .filter((n) => n);

      console.log('매칭 데이터:', {
        IDs: reservationIds.length,
        전화번호: phoneNumbers.length,
        학생이름: studentNames.length,
      });

      // 진단검사는 reservation_id 또는 phone/name으로 필터링
      window.filteredTestApplications = allTestApplications.filter((t) => {
        // 1. reservation_id로 매칭
        if (t.reservation_id && reservationIds.includes(t.reservation_id)) {
          return true;
        }

        // 2. 전화번호로 매칭 (하이픈 제거하고 비교)
        if (t.parent_phone) {
          const cleanPhone = t.parent_phone.replace(/-/g, '');
          if (phoneNumbers.includes(cleanPhone)) {
            return true;
          }
        }

        // 3. 학생 이름으로 매칭
        if (t.student_name && studentNames.includes(t.student_name)) {
          return true;
        }

        return false;
      });

      console.log(
        '필터링된 진단검사:',
        window.filteredTestApplications.length,
        '건'
      );

      // 컨설팅도 같은 방식으로 필터링
      window.filteredConsultingReservations = allConsultingReservations.filter(
        (c) => {
          // 1. reservation_id로 매칭
          if (c.reservation_id && reservationIds.includes(c.reservation_id)) {
            return true;
          }

          // 2. 전화번호로 매칭
          if (c.parent_phone) {
            const cleanPhone = c.parent_phone.replace(/-/g, '');
            if (phoneNumbers.includes(cleanPhone)) {
              return true;
            }
          }

          // 3. 학생 이름으로 매칭
          if (c.student_name && studentNames.includes(c.student_name)) {
            return true;
          }

          return false;
        }
      );

      console.log(
        '필터링된 컨설팅:',
        window.filteredConsultingReservations.length,
        '건'
      );

      // 컨설팅 슬롯은 전체 표시 (일정 관리용)
      window.filteredConsultingSlots = [...allConsultingSlots];
    }

    // 선택된 설명회 정보 저장
    if (seminarId && seminarId !== 'all') {
      globalState.seminarInfo = allSeminars.find(
        (s) => String(s.id) === String(seminarId)
      );
      console.log('선택된 설명회 정보:', globalState.seminarInfo);
    } else {
      globalState.seminarInfo = null;
    }

    // UI 업데이트
    this.updateSelectedBadge();
    this.updateAllModules();
  },

  updateSelectedBadge() {
    const badge = document.getElementById('selectedBadge');
    if (!badge) return;

    if (!globalState.selectedSeminar || globalState.selectedSeminar === 'all') {
      badge.textContent = '전체';
      badge.className = 'selected-badge';
    } else if (globalState.seminarInfo) {
      // 제목에서 위치 추출 - "아이스터디 VIP 학부모 설명회 - 대치" 형식
      let location = '기타';

      if (globalState.seminarInfo.title) {
        const parts = globalState.seminarInfo.title.split('-');
        if (parts.length > 1) {
          location = parts[parts.length - 1].trim();
        } else {
          // 하이픈이 없으면 제목 전체를 짧게 표시
          location = globalState.seminarInfo.title
            .replace('VIP 학부모 설명회', '')
            .trim();
        }
      }

      badge.textContent = location;
      badge.className = 'selected-badge active';
    }
  },

  updateAllModules() {
    console.log('모든 모듈 업데이트 시작 - 현재 탭:', globalState.currentTab);

    // 각 모듈이 정의되어 있는지 확인
    if (!window.DashboardModule) {
      console.error('DashboardModule이 정의되지 않음');
      return;
    }

    // 현재 탭에 따라 업데이트
    switch (globalState.currentTab) {
      case 'dashboard':
        if (DashboardModule && DashboardModule.update) {
          DashboardModule.update();
        } else {
          console.error('DashboardModule.update 함수 없음');
        }
        break;
      case 'seminar':
        if (SeminarModule && SeminarModule.update) {
          SeminarModule.update();
        } else {
          console.error('SeminarModule.update 함수 없음');
        }
        break;
      case 'checkin':
        if (CheckinModule && CheckinModule.update) {
          CheckinModule.update();
        } else {
          console.error('CheckinModule.update 함수 없음');
        }
        break;
      case 'test':
        if (TestModule && TestModule.update) {
          TestModule.update();
        } else {
          console.error('TestModule.update 함수 없음');
        }
        break;
      case 'consulting':
        if (ConsultingModule && ConsultingModule.update) {
          ConsultingModule.update();
        } else {
          console.error('ConsultingModule.update 함수 없음');
        }
        break;
      default:
        console.error('알 수 없는 탭:', globalState.currentTab);
    }

    // 연결 상태 업데이트
    this.updateConnectionStatus('connected');
  },

  switchTab(tabName) {
    globalState.currentTab = tabName;

    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // 탭 컨텐츠 표시
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    const targetContent = document.getElementById(`${tabName}-tab`);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // 해당 모듈 업데이트
    this.updateAllModules();
  },

  initializeUI() {
    // 설명회 선택기 이벤트
    const seminarSelector = document.getElementById('globalSeminarFilter');
    if (seminarSelector) {
      seminarSelector.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        console.log('설명회 선택 변경:', selectedValue);

        globalState.selectedSeminar =
          selectedValue === 'all' ? null : selectedValue;
        this.applyGlobalFilter();
      });
    }

    // 탭 초기 설정
    this.switchTab('dashboard');
  },

  setupEventListeners() {
    // 탭 클릭 이벤트는 HTML onclick으로 처리됨

    // 키보드 단축키 (선택사항)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            this.switchTab('dashboard');
            break;
          case '2':
            this.switchTab('seminar');
            break;
          case '3':
            this.switchTab('checkin');
            break;
          case '4':
            this.switchTab('test');
            break;
          case '5':
            this.switchTab('consulting');
            break;
          case 'r':
            this.refreshData();
            break;
        }
      }
    });
  },

  setupRealtimeSubscriptions() {
    // 예약 테이블 구독
    const reservationSub = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => this.handleRealtimeUpdate('reservations', payload)
      )
      .subscribe();

    // 진단검사 테이블 구독
    const testSub = supabase
      .channel('test-applications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'test_applications' },
        (payload) => this.handleRealtimeUpdate('test_applications', payload)
      )
      .subscribe();

    // 컨설팅 예약 구독
    const consultingSub = supabase
      .channel('consulting-reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consulting_reservations' },
        (payload) =>
          this.handleRealtimeUpdate('consulting_reservations', payload)
      )
      .subscribe();

    // 구독 저장
    globalState.realtimeSubscriptions = [
      reservationSub,
      testSub,
      consultingSub,
    ];
  },

  async handleRealtimeUpdate(table, payload) {
    console.log('실시간 업데이트:', table, payload.eventType);

    // 데이터 재로드
    await this.loadAllData();

    // 알림 표시
    const messages = {
      INSERT: '새로운 데이터가 추가되었습니다',
      UPDATE: '데이터가 업데이트되었습니다',
      DELETE: '데이터가 삭제되었습니다',
    };

    const message =
      messages[payload.eventType] || '데이터가 업데이트되었습니다';
    showToast(message, 'info');
  },

  async refreshData() {
    console.log('데이터 새로고침');
    showToast('데이터를 새로고침합니다...', 'info');

    await this.loadAllData();

    showToast('새로고침 완료', 'success');
  },

  async exportData() {
    try {
      showToast('엑셀 파일 생성 중...', 'info');

      // CSV 생성 (간단한 예시)
      let csv = '설명회,학생명,학교,학년,연락처,상태,체크인,진단검사,컨설팅\n';

      window.filteredReservations.forEach((r) => {
        const testApp = window.filteredTestApplications.find(
          (t) => t.reservation_id === r.id
        );
        const consultingApp = window.filteredConsultingReservations.find(
          (c) => c.reservation_id === r.id
        );

        csv += `"${r.seminar_name || ''}","${r.student_name}","${r.school}","${
          r.grade
        }",`;
        csv += `"${r.parent_phone}","${r.status}","${
          r.attendance_checked_at ? '완료' : '-'
        }",`;
        csv += `"${testApp ? testApp.test_type : '-'}","${
          consultingApp ? '예약' : '-'
        }"\n`;
      });

      // 다운로드
      const now = new Date();
      const filename = `monitoring_${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;

      downloadCSV(csv, filename);

      showToast('다운로드 완료', 'success');
    } catch (error) {
      console.error('Export 실패:', error);
      showToast('다운로드 실패', 'error');
    }
  },

  updateConnectionStatus(status) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (!statusDot || !statusText) return;

    statusDot.className = 'status-dot';

    switch (status) {
      case 'connected':
        statusDot.classList.add('connected');
        statusText.textContent = '실시간';
        break;
      case 'connecting':
        statusDot.classList.add('connecting');
        statusText.textContent = '연결중';
        break;
      case 'error':
        statusDot.classList.add('error');
        statusText.textContent = '오류';
        break;
    }
  },

  cleanupSubscriptions() {
    globalState.realtimeSubscriptions.forEach((sub) => {
      if (sub) sub.unsubscribe();
    });
    globalState.realtimeSubscriptions = [];
  },
};

// ===== 유틸리티 함수 =====
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

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatDateTime(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);

  return kstDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function downloadCSV(csv, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function closeModal() {
  const modal = document.getElementById('modalOverlay');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 전역 노출
window.MonitoringCore = MonitoringCore;
window.showToast = showToast;
window.formatDateTime = formatDateTime;
window.formatDateShort = formatDateShort;
window.formatPhoneNumber = formatPhoneNumber;
window.closeModal = closeModal;

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  MonitoringCore.cleanupSubscriptions();
});
