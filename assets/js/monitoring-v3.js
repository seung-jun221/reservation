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
let allSeminars = [];

// ===== 필터링된 데이터 =====
let filteredReservations = [];
let filteredTestApplications = [];
let filteredConsultingSlots = [];

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
    const { data, error } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    allSeminars = data || [];
    globalState.seminars = allSeminars;

    // 설명회 선택기 업데이트
    this.updateSeminarSelector();
  },

  updateSeminarSelector() {
    const selector = document.getElementById('globalSeminarFilter');
    if (!selector) return;

    // 기존 옵션 유지하고 동적 옵션만 추가
    const existingValue = selector.value;

    // 전체 옵션과 구분선 이후 모든 옵션 제거
    while (selector.options.length > 2) {
      selector.remove(2);
    }

    // 설명회 옵션 추가
    allSeminars.forEach((seminar) => {
      const option = document.createElement('option');
      option.value = seminar.id;

      const date = new Date(seminar.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const location = seminar.title.split('-').pop()?.trim() || '기타';

      option.textContent = `📍 ${dateStr} ${location} (${seminar.title})`;
      selector.appendChild(option);
    });

    // 이전 선택값 복원
    if (existingValue) {
      selector.value = existingValue;
    }
  },

  async loadAllData() {
    try {
      // 병렬로 데이터 로드
      const [reservations, testApps, consultings] = await Promise.all([
        this.loadReservations(),
        this.loadTestApplications(),
        this.loadConsultingSlots(),
      ]);

      allReservations = reservations || [];
      allTestApplications = testApps || [];
      allConsultingSlots = consultings || [];

      // 캐시 업데이트
      globalState.cache.reservations = allReservations;
      globalState.cache.testApplications = allTestApplications;
      globalState.cache.consultingSlots = allConsultingSlots;

      // 필터링 적용
      this.applyGlobalFilter();

      // 각 모듈 업데이트
      this.updateAllModules();
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      showToast('데이터를 불러올 수 없습니다', 'error');
    }
  },

  async loadReservations() {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('registered_at', { ascending: false });

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

  applyGlobalFilter() {
    const selectedSeminar = globalState.selectedSeminar;

    if (!selectedSeminar || selectedSeminar === 'all') {
      // 전체 데이터 사용
      filteredReservations = [...allReservations];
      filteredTestApplications = [...allTestApplications];
      filteredConsultingSlots = [...allConsultingSlots];
    } else {
      // 설명회별 필터링
      filteredReservations = allReservations.filter(
        (r) => r.seminar_id === parseInt(selectedSeminar)
      );

      // 진단검사는 예약 ID로 매칭
      const reservationIds = filteredReservations.map((r) => r.id);
      filteredTestApplications = allTestApplications.filter((t) =>
        reservationIds.includes(t.reservation_id)
      );

      // 컨설팅도 예약 기반 필터링
      filteredConsultingSlots = allConsultingSlots.filter((slot) => {
        if (
          slot.consulting_reservations &&
          slot.consulting_reservations.length > 0
        ) {
          return slot.consulting_reservations.some((cr) =>
            reservationIds.includes(cr.reservation_id)
          );
        }
        return false;
      });

      // 선택된 설명회 정보 저장
      globalState.seminarInfo = allSeminars.find(
        (s) => s.id === parseInt(selectedSeminar)
      );
    }

    // 선택 배지 업데이트
    this.updateSelectedBadge();
  },

  updateSelectedBadge() {
    const badge = document.getElementById('selectedBadge');
    if (!badge) return;

    if (!globalState.selectedSeminar || globalState.selectedSeminar === 'all') {
      badge.textContent = '전체';
      badge.className = 'selected-badge';
    } else if (globalState.seminarInfo) {
      const location =
        globalState.seminarInfo.title.split('-').pop()?.trim() || '기타';
      badge.textContent = location;
      badge.className = 'selected-badge active';
    }
  },

  updateAllModules() {
    // 현재 탭에 따라 업데이트
    switch (globalState.currentTab) {
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
        globalState.selectedSeminar =
          e.target.value === 'all' ? null : e.target.value;
        this.applyGlobalFilter();
        this.updateAllModules();
        showToast('필터 적용됨', 'info');
      });
    }
  },

  setupEventListeners() {
    // 새로고침 버튼
    const refreshBtn = document.querySelector('.refresh-icon');
    if (refreshBtn) {
      refreshBtn.parentElement.addEventListener('click', () =>
        this.refreshData()
      );
    }

    // 엑셀 다운로드 버튼
    const exportBtn = document.querySelector('[onclick*="exportData"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }
  },

  async refreshData() {
    showToast('데이터 새로고침 중...', 'info');
    await this.loadAllData();
    showToast('새로고침 완료', 'success');
  },

  exportData() {
    // 현재 필터링된 데이터를 CSV로 내보내기
    const data = this.prepareExportData();
    if (data.length === 0) {
      showToast('내보낼 데이터가 없습니다', 'warning');
      return;
    }

    const csv = this.convertToCSV(data);
    const filename = `monitoring_${globalState.selectedSeminar || 'all'}_${
      new Date().toISOString().split('T')[0]
    }.csv`;
    downloadCSV(csv, filename);
    showToast('데이터 내보내기 완료', 'success');
  },

  prepareExportData() {
    // 현재 탭에 따라 다른 데이터 준비
    switch (globalState.currentTab) {
      case 'seminar':
        return filteredReservations.map((r) => ({
          예약번호: r.reservation_id,
          설명회: r.seminar_name,
          학생명: r.student_name,
          연락처: r.parent_phone,
          학교: r.school,
          학년: r.grade,
          상태: r.status,
          예약일시: r.registered_at,
        }));
      case 'test':
        return filteredTestApplications.map((t) => ({
          번호: t.id,
          학생명: t.student_name,
          학교: t.school,
          학년: t.grade,
          검사유형: t.test_type,
          신청일시: t.created_at,
        }));
      default:
        return filteredReservations;
    }
  },

  convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return '\uFEFF' + csvHeaders + '\n' + csvRows.join('\n');
  },

  setupRealtimeSubscriptions() {
    // 기존 구독 정리
    this.cleanupSubscriptions();

    // 예약 테이블 구독
    const reservationSub = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          console.log('예약 변경:', payload);
          this.handleRealtimeUpdate('reservations', payload);
        }
      )
      .subscribe();

    // 진단검사 테이블 구독
    const testSub = supabase
      .channel('test-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'test_applications' },
        (payload) => {
          console.log('진단검사 변경:', payload);
          this.handleRealtimeUpdate('test_applications', payload);
        }
      )
      .subscribe();

    // 컨설팅 테이블 구독
    const consultingSub = supabase
      .channel('consulting-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consulting_slots' },
        (payload) => {
          console.log('컨설팅 변경:', payload);
          this.handleRealtimeUpdate('consulting_slots', payload);
        }
      )
      .subscribe();

    globalState.realtimeSubscriptions = [
      reservationSub,
      testSub,
      consultingSub,
    ];
  },

  handleRealtimeUpdate(table, payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (table) {
      case 'reservations':
        this.updateReservations(eventType, newRecord, oldRecord);
        break;
      case 'test_applications':
        this.updateTestApplications(eventType, newRecord, oldRecord);
        break;
      case 'consulting_slots':
        this.updateConsultingSlots(eventType, newRecord, oldRecord);
        break;
    }

    // 필터 재적용 및 UI 업데이트
    this.applyGlobalFilter();
    this.updateAllModules();

    // 알림 표시
    this.showRealtimeNotification(table, eventType);
  },

  updateReservations(eventType, newRecord, oldRecord) {
    switch (eventType) {
      case 'INSERT':
        allReservations.unshift(newRecord);
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
  },

  updateTestApplications(eventType, newRecord, oldRecord) {
    switch (eventType) {
      case 'INSERT':
        allTestApplications.unshift(newRecord);
        break;
      case 'UPDATE':
        const index = allTestApplications.findIndex(
          (t) => t.id === newRecord.id
        );
        if (index !== -1) {
          allTestApplications[index] = newRecord;
        }
        break;
      case 'DELETE':
        allTestApplications = allTestApplications.filter(
          (t) => t.id !== oldRecord.id
        );
        break;
    }
  },

  updateConsultingSlots(eventType, newRecord, oldRecord) {
    switch (eventType) {
      case 'INSERT':
        allConsultingSlots.push(newRecord);
        break;
      case 'UPDATE':
        const index = allConsultingSlots.findIndex(
          (c) => c.id === newRecord.id
        );
        if (index !== -1) {
          allConsultingSlots[index] = newRecord;
        }
        break;
      case 'DELETE':
        allConsultingSlots = allConsultingSlots.filter(
          (c) => c.id !== oldRecord.id
        );
        break;
    }
  },

  showRealtimeNotification(table, eventType) {
    const messages = {
      reservations: {
        INSERT: '새 예약이 등록되었습니다',
        UPDATE: '예약 정보가 업데이트되었습니다',
        DELETE: '예약이 취소되었습니다',
      },
      test_applications: {
        INSERT: '새 진단검사 신청이 있습니다',
        UPDATE: '진단검사 정보가 업데이트되었습니다',
        DELETE: '진단검사 신청이 취소되었습니다',
      },
      consulting_slots: {
        INSERT: '새 컨설팅 슬롯이 추가되었습니다',
        UPDATE: '컨설팅 정보가 업데이트되었습니다',
        DELETE: '컨설팅 슬롯이 삭제되었습니다',
      },
    };

    const message =
      messages[table]?.[eventType] || '데이터가 업데이트되었습니다';
    showToast(message, 'info');
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

// ===== 대시보드 모듈 =====
const DashboardModule = {
  chart: null,

  initialize() {
    this.initializeChart();
    this.update();
  },

  initializeChart() {
    const ctx = document.getElementById('funnelChart')?.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['예약', '체크인', '진단검사', '컨설팅'],
        datasets: [
          {
            label: '전환 퍼널',
            data: [0, 0, 0, 0],
            backgroundColor: [
              'rgba(26, 115, 232, 0.8)',
              'rgba(52, 168, 83, 0.8)',
              'rgba(251, 188, 4, 0.8)',
              'rgba(234, 67, 53, 0.8)',
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                if (context.dataIndex > 0) {
                  const previousValue =
                    context.dataset.data[context.dataIndex - 1];
                  const currentValue = context.parsed.y;
                  const rate =
                    previousValue > 0
                      ? ((currentValue / previousValue) * 100).toFixed(1)
                      : 0;
                  return `전환율: ${rate}%`;
                }
                return '';
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  },

  update() {
    const stats = this.calculateStats();
    const conversionRates = this.calculateConversionRates(stats);

    // 통계 카드 업데이트
    this.updateStatCards(stats, conversionRates);

    // 차트 업데이트
    this.updateChart(stats);

    // 최근 활동 업데이트
    this.updateRecentActivities();
  },

  calculateStats() {
    const totalReservations = filteredReservations.length;
    const totalCheckins = filteredReservations.filter(
      (r) => r.status === '참석' && r.attendance_checked_at
    ).length;
    const totalTests = filteredTestApplications.length;
    const totalConsultings = filteredReservations.filter(
      (r) => r.post_checkin_choice === 'consult'
    ).length;

    return {
      totalReservations,
      totalCheckins,
      totalTests,
      totalConsultings,
    };
  },

  calculateConversionRates(stats) {
    return {
      reservationToCheckin:
        stats.totalReservations > 0
          ? ((stats.totalCheckins / stats.totalReservations) * 100).toFixed(1)
          : 0,
      checkinToTest:
        stats.totalCheckins > 0
          ? ((stats.totalTests / stats.totalCheckins) * 100).toFixed(1)
          : 0,
      checkinToConsulting:
        stats.totalCheckins > 0
          ? ((stats.totalConsultings / stats.totalCheckins) * 100).toFixed(1)
          : 0,
    };
  },

  updateStatCards(stats, rates) {
    // 기본 통계
    document.getElementById('stat-total-reservations').textContent =
      stats.totalReservations;
    document.getElementById('stat-total-checkins').textContent =
      stats.totalCheckins;
    document.getElementById('stat-total-tests').textContent = stats.totalTests;
    document.getElementById('stat-total-consultings').textContent =
      stats.totalConsultings;

    // 전환율 표시 추가 (HTML에 요소가 있다면)
    const checkinRate = document.getElementById('checkin-conversion-rate');
    if (checkinRate) {
      checkinRate.textContent = `${rates.reservationToCheckin}%`;
    }
  },

  updateChart(stats) {
    if (!this.chart) return;

    this.chart.data.datasets[0].data = [
      stats.totalReservations,
      stats.totalCheckins,
      stats.totalTests,
      stats.totalConsultings,
    ];
    this.chart.update();
  },

  updateRecentActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    // 최근 활동 수집
    const activities = [];

    // 예약 활동
    filteredReservations.slice(0, 5).forEach((r) => {
      activities.push({
        time: r.registered_at,
        type: '예약',
        message: `${r.student_name}님이 예약했습니다`,
        icon: '📋',
      });
    });

    // 체크인 활동
    filteredReservations
      .filter((r) => r.attendance_checked_at)
      .slice(0, 5)
      .forEach((r) => {
        activities.push({
          time: r.attendance_checked_at,
          type: '체크인',
          message: `${r.student_name}님이 체크인했습니다`,
          icon: '✅',
        });
      });

    // 진단검사 활동
    filteredTestApplications.slice(0, 5).forEach((t) => {
      activities.push({
        time: t.created_at,
        type: '진단검사',
        message: `${t.student_name}님이 진단검사를 신청했습니다`,
        icon: '📝',
      });
    });

    // 시간순 정렬 및 최근 10개만
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recentActivities = activities.slice(0, 10);

    // HTML 렌더링
    activityList.innerHTML = recentActivities
      .map(
        (activity) => `
        <div class="activity-item">
          <span class="activity-icon">${activity.icon}</span>
          <span class="activity-time">${formatDateTime(activity.time)}</span>
          <span class="activity-type badge badge-${this.getActivityBadgeType(
            activity.type
          )}">${activity.type}</span>
          <span class="activity-message">${activity.message}</span>
        </div>
      `
      )
      .join('');
  },

  getActivityBadgeType(type) {
    const types = {
      예약: 'primary',
      체크인: 'success',
      진단검사: 'info',
      컨설팅: 'warning',
    };
    return types[type] || 'secondary';
  },
};

// ===== 설명회 예약 모듈 =====
const SeminarModule = {
  update() {
    this.renderStats();
    this.renderTable();
    this.setupFilters();
  },

  renderStats() {
    const seminarStats = {};

    // 설명회별 통계 계산
    filteredReservations.forEach((r) => {
      const key = r.seminar_id || 'unknown';
      if (!seminarStats[key]) {
        seminarStats[key] = {
          id: r.seminar_id,
          name: r.seminar_name || '미지정',
          total: 0,
          attended: 0,
          cancelled: 0,
          pending: 0,
        };
      }

      seminarStats[key].total++;
      if (r.status === '참석') seminarStats[key].attended++;
      if (r.status === '취소') seminarStats[key].cancelled++;
      if (r.status === '예약') seminarStats[key].pending++;
    });

    // 통계 표시
    const statsContainer = document.getElementById('seminarStats');
    if (statsContainer) {
      statsContainer.innerHTML = Object.values(seminarStats)
        .map((stat) => {
          const attendRate =
            stat.total > 0
              ? ((stat.attended / stat.total) * 100).toFixed(1)
              : 0;

          return `
            <div class="seminar-stat-card">
              <h4>${stat.name}</h4>
              <div class="stat-row">
                <span class="stat-item">
                  <strong>전체:</strong> ${stat.total}
                </span>
                <span class="stat-item success">
                  <strong>참석:</strong> ${stat.attended}
                </span>
                <span class="stat-item warning">
                  <strong>대기:</strong> ${stat.pending}
                </span>
                <span class="stat-item danger">
                  <strong>취소:</strong> ${stat.cancelled}
                </span>
              </div>
              <div class="conversion-rate">
                참석률: <strong>${attendRate}%</strong>
              </div>
            </div>
          `;
        })
        .join('');
    }
  },

  renderTable() {
    const tbody = document.getElementById('seminarTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 필터링
    let data = [...filteredReservations];

    const statusFilter = document.getElementById('seminarStatusFilter')?.value;
    if (statusFilter) {
      data = data.filter((r) => r.status === statusFilter);
    }

    const searchInput = document
      .getElementById('seminarSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      data = data.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(searchInput) ||
          r.parent_phone?.includes(searchInput) ||
          r.school?.toLowerCase().includes(searchInput)
      );
    }

    // 테이블 렌더링
    data.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.reservation_id || '-'}</td>
        <td>${item.seminar_name || '-'}</td>
        <td>${item.student_name}</td>
        <td>${formatPhoneNumber(item.parent_phone)}</td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${this.getStatusBadge(item.status)}</td>
        <td>${formatDateTime(item.registered_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editReservation(${
            item.id
          })">
            수정
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // 빈 상태 처리
    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center">예약 데이터가 없습니다</td>
        </tr>
      `;
    }
  },

  getStatusBadge(status) {
    const badges = {
      예약: '<span class="badge badge-primary">예약</span>',
      참석: '<span class="badge badge-success">참석</span>',
      취소: '<span class="badge badge-danger">취소</span>',
    };
    return badges[status] || '<span class="badge badge-secondary">-</span>';
  },

  setupFilters() {
    const statusFilter = document.getElementById('seminarStatusFilter');
    const searchInput = document.getElementById('seminarSearchInput');

    if (statusFilter && !statusFilter.hasListener) {
      statusFilter.addEventListener('change', () => this.renderTable());
      statusFilter.hasListener = true;
    }

    if (searchInput && !searchInput.hasListener) {
      searchInput.addEventListener('input', () => this.renderTable());
      searchInput.hasListener = true;
    }
  },
};

// ===== 체크인 분석 모듈 =====
const CheckinModule = {
  update() {
    this.calculateStats();
    this.renderTable();
  },

  calculateStats() {
    const checkedIn = filteredReservations.filter(
      (r) => r.status === '참석' && r.attendance_checked_at
    );

    const stats = {
      total: checkedIn.length,
      test: checkedIn.filter((r) => r.post_checkin_choice === 'test').length,
      consult: checkedIn.filter((r) => r.post_checkin_choice === 'consult')
        .length,
      pending: checkedIn.filter((r) => !r.post_checkin_choice).length,
      online: checkedIn.filter((r) => r.checkin_type === 'online').length,
      offline: checkedIn.filter((r) => r.checkin_type === 'offline').length,
    };

    // 전환율 계산
    const testRate =
      stats.total > 0 ? ((stats.test / stats.total) * 100).toFixed(1) : 0;
    const consultRate =
      stats.total > 0 ? ((stats.consult / stats.total) * 100).toFixed(1) : 0;

    // UI 업데이트
    document.getElementById('checkin-total').textContent = stats.total;
    document.getElementById('checkin-test').textContent = stats.test;
    document.getElementById('checkin-consult').textContent = stats.consult;
    document.getElementById('checkin-pending').textContent = stats.pending;

    // 전환율 표시
    const testRateEl = document.getElementById('checkin-test-rate');
    const consultRateEl = document.getElementById('checkin-consult-rate');

    if (testRateEl) testRateEl.textContent = `${testRate}%`;
    if (consultRateEl) consultRateEl.textContent = `${consultRate}%`;

    return stats;
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const checkedIn = filteredReservations
      .filter((r) => r.status === '참석' && r.attendance_checked_at)
      .sort(
        (a, b) =>
          new Date(b.attendance_checked_at) - new Date(a.attendance_checked_at)
      );

    checkedIn.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDateTime(item.attendance_checked_at)}</td>
        <td>${item.student_name}</td>
        <td>${item.seminar_name || '-'}</td>
        <td>${item.checkin_type === 'offline' ? '현장' : '온라인'}</td>
        <td>${this.getChoiceBadge(item.post_checkin_choice)}</td>
        <td>${
          item.post_checkin_at ? formatDateTime(item.post_checkin_at) : '-'
        }</td>
      `;
      tbody.appendChild(row);
    });

    if (checkedIn.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">체크인 데이터가 없습니다</td>
        </tr>
      `;
    }
  },

  getChoiceBadge(choice) {
    const badges = {
      test: '<span class="badge badge-info">진단검사</span>',
      consult: '<span class="badge badge-success">컨설팅</span>',
    };
    return (
      badges[choice] || '<span class="badge badge-secondary">미선택</span>'
    );
  },
};

// ===== 진단검사 모듈 =====
const TestModule = {
  update() {
    this.renderTable();
    this.updateStats();
    this.setupFilters();
  },

  renderTable() {
    const tbody = document.getElementById('testTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 필터링
    let data = [...filteredTestApplications];

    const typeFilter = document.getElementById('testTypeFilter')?.value;
    if (typeFilter) {
      data = data.filter((item) => item.test_type === typeFilter);
    }

    const searchInput = document
      .getElementById('testSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      data = data.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(searchInput) ||
          item.school?.toLowerCase().includes(searchInput)
      );
    }

    // 테이블 렌더링
    data.forEach((item, index) => {
      const row = document.createElement('tr');
      const isDownloaded = item.downloaded_at && item.test_type;

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.seminar_name || '-'}</td>
        <td>${item.student_name}</td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.math_level || '-'}</td>
        <td>${this.getTestTypeBadge(item.test_type, item.hme_grade)}</td>
        <td>${this.getDownloadStatus(item.downloaded_at)}</td>
        <td>${formatDateTime(item.created_at)}</td>
      `;
      tbody.appendChild(row);
    });

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center">진단검사 신청 데이터가 없습니다</td>
        </tr>
      `;
    }
  },

  getTestTypeBadge(type, hmeGrade) {
    if (!type) {
      return '<span class="badge badge-warning">미선택</span>';
    }

    let badge = `<span class="badge badge-primary">${type}</span>`;
    if (hmeGrade) {
      badge += ` <span class="badge badge-secondary">${hmeGrade}</span>`;
    }
    return badge;
  },

  getDownloadStatus(downloadedAt) {
    if (downloadedAt) {
      return `<span class="badge badge-success">✓ ${formatDateTime(
        downloadedAt
      )}</span>`;
    }
    return '<span class="badge badge-secondary">미완료</span>';
  },

  updateStats() {
    const total = filteredTestApplications.length;
    const hmeCount = filteredTestApplications.filter(
      (d) => d.test_type === 'HME'
    ).length;
    const monoTriCount = filteredTestApplications.filter(
      (d) => d.test_type === 'MONO' || d.test_type === 'TRI'
    ).length;
    const mockCount = filteredTestApplications.filter(
      (d) => d.test_type === 'MOCK'
    ).length;

    document.getElementById('test-total').textContent = total;
    document.getElementById('test-hme').textContent = hmeCount;
    document.getElementById('test-mono-tri').textContent = monoTriCount;
    document.getElementById('test-mock').textContent = mockCount;
  },

  setupFilters() {
    const typeFilter = document.getElementById('testTypeFilter');
    const searchInput = document.getElementById('testSearchInput');

    if (typeFilter && !typeFilter.hasListener) {
      typeFilter.addEventListener('change', () => this.renderTable());
      typeFilter.hasListener = true;
    }

    if (searchInput && !searchInput.hasListener) {
      searchInput.addEventListener('input', () => this.renderTable());
      searchInput.hasListener = true;
    }
  },
};

// ===== 컨설팅 모듈 =====
const ConsultingModule = {
  currentView: 'calendar',

  update() {
    if (this.currentView === 'calendar') {
      this.renderCalendar();
    } else {
      this.renderList();
    }
    this.updateStats();
  },

  switchView(view) {
    this.currentView = view;

    // 버튼 활성화 상태 변경
    document.querySelectorAll('.view-btn').forEach((btn) => {
      btn.classList.remove('active');
    });

    if (event && event.target) {
      event.target.classList.add('active');
    }

    // 뷰 전환
    const calendarView = document.getElementById('consultingCalendar');
    const listView = document.getElementById('consultingList');

    if (view === 'calendar') {
      if (calendarView) calendarView.style.display = 'block';
      if (listView) listView.style.display = 'none';
      this.renderCalendar();
    } else {
      if (calendarView) calendarView.style.display = 'none';
      if (listView) listView.style.display = 'block';
      this.renderList();
    }
  },

  renderCalendar() {
    const calendar = document.getElementById('consultingCalendar');
    if (!calendar) return;

    // 간단한 캘린더 구현
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    calendar.innerHTML = `
      <div class="calendar-header">
        <h3>${currentYear}년 ${currentMonth + 1}월</h3>
      </div>
      <div class="calendar-grid">
        ${this.generateCalendarDays(currentYear, currentMonth)}
      </div>
    `;
  },

  generateCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    let dayCount = 1;

    // 주 헤더
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach((day) => {
      html += `<div class="calendar-weekday">${day}</div>`;
    });

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    // 날짜
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      const consultings = this.getConsultingsForDate(dateStr);

      html += `
        <div class="calendar-day ${consultings.length > 0 ? 'has-events' : ''}">
          <div class="day-number">${day}</div>
          ${
            consultings.length > 0
              ? `<div class="event-count">${consultings.length}건</div>`
              : ''
          }
        </div>
      `;
    }

    return html;
  },

  getConsultingsForDate(dateStr) {
    return filteredConsultingSlots.filter((slot) => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      return slotDate === dateStr;
    });
  },

  renderList() {
    const tbody = document.getElementById('consultingTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const consultings = filteredReservations
      .filter((r) => r.post_checkin_choice === 'consult')
      .sort(
        (a, b) => new Date(b.post_checkin_at) - new Date(a.post_checkin_at)
      );

    consultings.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.consulting_date || '-'}</td>
        <td>${item.consulting_time || '-'}</td>
        <td>${item.student_name}</td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.test_type || '-'}</td>
        <td>${this.getConsultingStatus(item)}</td>
        <td>
          <button class="btn btn-sm btn-primary">일정변경</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    if (consultings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">컨설팅 예약 데이터가 없습니다</td>
        </tr>
      `;
    }
  },

  getConsultingStatus(item) {
    if (item.consulting_completed) {
      return '<span class="badge badge-success">완료</span>';
    }
    return '<span class="badge badge-warning">대기</span>';
  },

  updateStats() {
    const today = new Date().toDateString();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const consultings = filteredReservations.filter(
      (r) => r.post_checkin_choice === 'consult'
    );

    const todayCount = consultings.filter((c) => {
      const date = new Date(c.post_checkin_at);
      return date.toDateString() === today;
    }).length;

    const weekCount = consultings.filter((c) => {
      const date = new Date(c.post_checkin_at);
      return date >= thisWeek;
    }).length;

    const pendingCount = consultings.filter(
      (c) => !c.consulting_completed
    ).length;

    document.getElementById('consulting-today').textContent = todayCount;
    document.getElementById('consulting-week').textContent = weekCount;
    document.getElementById('consulting-pending').textContent = pendingCount;
  },
};

// ===== 유틸리티 함수 =====
function formatDateTime(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  // KST 변환
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

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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

function editReservation(id) {
  // 예약 수정 모달 열기
  showToast(`예약 ID ${id} 수정 기능 구현 예정`, 'info');
}

// 전역 노출
window.MonitoringCore = MonitoringCore;
window.DashboardModule = DashboardModule;
window.SeminarModule = SeminarModule;
window.CheckinModule = CheckinModule;
window.TestModule = TestModule;
window.ConsultingModule = ConsultingModule;
window.closeModal = closeModal;
window.editReservation = editReservation;

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  MonitoringCore.cleanupSubscriptions();
});
