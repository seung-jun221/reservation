// monitoring-core.js - 핵심 기능 및 데이터 관리

// ===== Supabase 설정 =====
const SUPABASE_URL = 'https://xooglumwuzctbcjtcvnd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 전역 상태 관리 =====
const GlobalState = {
  // 현재 상태
  currentTab: 'dashboard',
  selectedSeminar: 'all',
  isLoading: false,

  // 원본 데이터
  allSeminars: [],
  allReservations: [],
  allTestApplications: [],
  allConsultingSlots: [],
  allConsultingReservations: [],

  // 필터링된 데이터
  filteredReservations: [],
  filteredTestApplications: [],
  filteredConsultingReservations: [],

  // 실시간 구독
  subscriptions: [],
};

// ===== 데이터 로더 =====
const DataLoader = {
  // 모든 데이터 로드
  async loadAllData() {
    console.log('📥 데이터 로드 시작...');
    Utils.showLoading(true);

    try {
      // 1. 먼저 설명회 데이터를 로드하고 저장
      const seminars = await this.loadSeminars();
      GlobalState.allSeminars = seminars || [];

      // 2. 그 다음 나머지 데이터를 병렬로 로드
      const [reservations, tests, consultingSlots, consultingReservations] =
        await Promise.all([
          this.loadReservations(), // 이제 allSeminars를 사용할 수 있음
          this.loadTestApplications(),
          this.loadConsultingSlots(),
          this.loadConsultingReservations(),
        ]);

      // 전역 상태에 저장
      GlobalState.allReservations = reservations || [];
      GlobalState.allTestApplications = tests || [];
      GlobalState.allConsultingSlots = consultingSlots || [];
      GlobalState.allConsultingReservations = consultingReservations || [];

      console.log('✅ 데이터 로드 완료:', {
        seminars: GlobalState.allSeminars.length,
        reservations: GlobalState.allReservations.length,
        tests: GlobalState.allTestApplications.length,
        consultingSlots: GlobalState.allConsultingSlots.length,
        consultingReservations: GlobalState.allConsultingReservations.length,
      });

      // 데이터 필터링
      this.filterData();

      // UI 업데이트
      Utils.updateConnectionStatus('connected');
      Utils.updateLastUpdate();

      return true;
    } catch (error) {
      console.error('❌ 데이터 로드 실패:', error);
      Utils.showToast('데이터 로드 실패', 'error');
      Utils.updateConnectionStatus('error');
      return false;
    } finally {
      Utils.showLoading(false);
    }
  },

  // 설명회 정보 로드
  async loadSeminars() {
    const { data, error } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 예약 정보 로드
  async loadReservations() {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error) throw error;

    // 설명회 정보 매칭
    return data?.map((r) => {
      const seminar = GlobalState.allSeminars.find(
        (s) => s.id === r.seminar_id
      );
      return {
        ...r,
        seminar_name: seminar?.title || '미정',
        seminar_date: seminar?.date,
      };
    });
  },

  // 진단검사 신청 로드
  async loadTestApplications() {
    const { data, error } = await supabase
      .from('test_applications')
      .select('*') // 조인 제거
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 컨설팅 슬롯 로드
  async loadConsultingSlots() {
    const { data, error } = await supabase
      .from('consulting_slots')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    return data;
  },

  // 컨설팅 예약 로드
  async loadConsultingReservations() {
    const { data, error } = await supabase
      .from('consulting_reservations')
      .select('*, consulting_slots(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 데이터 필터링
  filterData() {
    const selectedSeminar = GlobalState.selectedSeminar;

    if (selectedSeminar === 'all') {
      // 전체 선택시 모든 데이터 표시
      GlobalState.filteredReservations = [...GlobalState.allReservations];
      GlobalState.filteredTestApplications = [
        ...GlobalState.allTestApplications,
      ];
      GlobalState.filteredConsultingReservations = [
        ...GlobalState.allConsultingReservations,
      ];
    } else {
      // 특정 설명회 선택시 필터링
      GlobalState.filteredReservations = GlobalState.allReservations.filter(
        (r) => r.seminar_id === selectedSeminar
      );

      // 해당 설명회 참가자들의 전화번호 추출
      const phoneNumbers = GlobalState.filteredReservations.map(
        (r) => r.parent_phone
      );

      // 전화번호로 진단검사와 컨설팅 필터링
      GlobalState.filteredTestApplications =
        GlobalState.allTestApplications.filter((t) =>
          phoneNumbers.includes(t.parent_phone)
        );

      GlobalState.filteredConsultingReservations =
        GlobalState.allConsultingReservations.filter((c) =>
          phoneNumbers.includes(c.parent_phone)
        );
    }

    console.log('📊 필터링 완료:', {
      seminar: selectedSeminar,
      reservations: GlobalState.filteredReservations.length,
      tests: GlobalState.filteredTestApplications.length,
      consulting: GlobalState.filteredConsultingReservations.length,
    });
  },
};

// ===== 실시간 업데이트 =====
const RealtimeManager = {
  // 실시간 구독 설정
  setupSubscriptions() {
    console.log('🔄 실시간 구독 설정...');

    // 기존 구독 정리
    this.cleanupSubscriptions();

    // 예약 테이블 구독
    const reservationsSub = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => this.handleChange('reservations', payload)
      )
      .subscribe();

    // 진단검사 테이블 구독
    const testSub = supabase
      .channel('test-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'test_applications' },
        (payload) => this.handleChange('test_applications', payload)
      )
      .subscribe();

    // 컨설팅 예약 구독
    const consultingSub = supabase
      .channel('consulting-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consulting_reservations' },
        (payload) => this.handleChange('consulting_reservations', payload)
      )
      .subscribe();

    GlobalState.subscriptions = [reservationsSub, testSub, consultingSub];
  },

  // 변경 사항 처리
  async handleChange(table, payload) {
    console.log(`📨 실시간 업데이트 - ${table}:`, payload.eventType);

    // 데이터 재로드
    await DataLoader.loadAllData();

    // 현재 탭 업데이트
    if (window.MonitoringApp) {
      window.MonitoringApp.updateCurrentTab();
    }

    // 토스트 메시지
    Utils.showToast(`${table} 업데이트됨`, 'info');
  },

  // 구독 정리
  cleanupSubscriptions() {
    GlobalState.subscriptions.forEach((sub) => {
      supabase.removeChannel(sub);
    });
    GlobalState.subscriptions = [];
  },
};

// ===== 유틸리티 함수 =====
const Utils = {
  // 로딩 표시
  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
  },

  // 토스트 메시지
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // 3초 후 제거
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // 연결 상태 업데이트
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');

    dot.className = 'status-dot';

    switch (status) {
      case 'connected':
        dot.classList.add('connected');
        text.textContent = '연결됨';
        break;
      case 'connecting':
        dot.classList.add('connecting');
        text.textContent = '연결중...';
        break;
      case 'error':
        dot.classList.add('error');
        text.textContent = '오류';
        break;
    }
  },

  // 마지막 업데이트 시간
  updateLastUpdate() {
    const el = document.getElementById('lastUpdate');
    if (el) {
      const now = new Date();
      el.textContent = `업데이트: ${now.getHours()}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
    }
  },

  // 날짜 포맷
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${
      date.getMonth() + 1
    }/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(
      2,
      '0'
    )}`;
  },

  // 전화번호 포맷
  formatPhone(phone) {
    if (!phone) return '-';
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  },
};

// 전역 노출
window.GlobalState = GlobalState;
window.DataLoader = DataLoader;
window.RealtimeManager = RealtimeManager;
window.Utils = Utils;
