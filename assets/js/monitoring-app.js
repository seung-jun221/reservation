// monitoring-app.js - 메인 애플리케이션 컨트롤러

const MonitoringApp = {
  // 초기화
  async init() {
    console.log('🚀 모니터링 앱 시작...');

    try {
      // 로딩 표시
      Utils.showLoading(true);

      // 데이터 로드
      const success = await DataLoader.loadAllData();
      if (!success) {
        throw new Error('데이터 로드 실패');
      }

      // UI 초기화
      this.initializeUI();

      // 설명회 선택기 초기화
      this.initializeSeminarSelector();

      // 실시간 구독 설정
      RealtimeManager.setupSubscriptions();

      // 첫 번째 탭 렌더링
      this.switchTab('dashboard');

      console.log('✅ 모니터링 앱 초기화 완료');
      Utils.showToast('시스템 준비 완료', 'success');
    } catch (error) {
      console.error('❌ 초기화 실패:', error);
      Utils.showToast('시스템 초기화 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  // UI 초기화
  initializeUI() {
    // Chart.js 확인
    if (typeof Chart === 'undefined') {
      console.warn('⚠️ Chart.js가 로드되지 않음. 차트 기능 비활성화');
      // Chart.js 동적 로드 시도
      this.loadChartJS();
    }

    // 이벤트 리스너 설정
    this.setupEventListeners();
  },

  // Chart.js 동적 로드
  loadChartJS() {
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => {
      console.log('✅ Chart.js 동적 로드 성공');
      // 대시보드가 현재 탭이면 차트 초기화
      if (GlobalState.currentTab === 'dashboard') {
        DashboardModule.initChart();
      }
    };
    script.onerror = () => {
      console.error('❌ Chart.js 로드 실패');
    };
    document.head.appendChild(script);
  },

  // 설명회 선택기 초기화
  initializeSeminarSelector() {
    const selector = document.getElementById('globalSeminarFilter');
    if (!selector) return;

    // 옵션 추가
    GlobalState.allSeminars.forEach((seminar) => {
      const option = document.createElement('option');
      option.value = seminar.id;

      // 날짜와 제목 포맷
      const date = new Date(seminar.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const title = seminar.title.replace('VIP 학부모 설명회', '').trim();

      option.textContent = `${dateStr} ${title}`;
      selector.appendChild(option);
    });

    // 선택 변경 이벤트
    selector.addEventListener('change', (e) => {
      this.onSeminarChange(e.target.value);
    });
  },

  // 설명회 선택 변경
  onSeminarChange(seminarId) {
    console.log('📌 설명회 선택 변경:', seminarId);

    GlobalState.selectedSeminar = seminarId;

    // 데이터 필터링
    DataLoader.filterData();

    // 현재 탭 업데이트
    this.updateCurrentTab();

    Utils.showToast('필터 적용됨', 'info');
  },

  // 이벤트 리스너 설정
  setupEventListeners() {
    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + R: 새로고침
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.refreshData();
      }

      // Ctrl/Cmd + 1~5: 탭 전환
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            this.switchTab('dashboard');
            break;
          case '2':
            this.switchTab('reservations');
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
        }
      }
    });

    // 창 크기 변경시 차트 리사이즈
    window.addEventListener('resize', () => {
      if (GlobalState.currentTab === 'dashboard' && DashboardModule.chart) {
        DashboardModule.chart.resize();
      }
    });
  },

  // 탭 전환
  switchTab(tabName) {
    console.log('📂 탭 전환:', tabName);

    // 현재 탭 저장
    GlobalState.currentTab = tabName;

    // 모든 탭 숨기기
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });

    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
    });

    // 선택된 탭 표시
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      tabContent.classList.add('active');
    }

    // 선택된 탭 버튼 활성화
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) {
      tabBtn.classList.add('active');
    }

    // 탭별 초기화
    this.initializeTab(tabName);
  },

  // 탭 초기화
  initializeTab(tabName) {
    switch (tabName) {
      case 'dashboard':
        DashboardModule.init();
        break;
      case 'reservations':
        ReservationsModule.init();
        break;
      case 'checkin':
        CheckinModule.init();
        break;
      case 'test':
        TestModule.init();
        break;
      case 'consulting':
        ConsultingModule.init();
        break;
    }
  },

  // 현재 탭 업데이트
  updateCurrentTab() {
    this.initializeTab(GlobalState.currentTab);
  },

  // 데이터 새로고침
  async refreshData() {
    console.log('🔄 데이터 새로고침...');
    Utils.showToast('새로고침 중...', 'info');

    const success = await DataLoader.loadAllData();

    if (success) {
      this.updateCurrentTab();
      Utils.showToast('새로고침 완료', 'success');
    } else {
      Utils.showToast('새로고침 실패', 'error');
    }
  },

  // 컨설팅 뷰 전환
  switchConsultingView(view) {
    ConsultingModule.switchView(view);
  },

  // 엑셀 내보내기 (추가 기능)
  exportToExcel() {
    console.log('📊 엑셀 내보내기...');

    // CSV 생성
    let csv = '설명회,학생명,연락처,학교,학년,상태,체크인,진단검사,컨설팅\n';

    GlobalState.filteredReservations.forEach((r) => {
      const hasTest = GlobalState.filteredTestApplications.some(
        (t) => t.parent_phone === r.parent_phone
      );
      const hasConsulting = GlobalState.filteredConsultingReservations.some(
        (c) => c.parent_phone === r.parent_phone
      );

      csv += `"${r.seminar_name}","${r.student_name}","${r.parent_phone}","${
        r.school
      }","${r.grade}","${r.status}","${r.attendance_checked_at ? 'O' : 'X'}","${
        hasTest ? 'O' : 'X'
      }","${hasConsulting ? 'O' : 'X'}"\n`;
    });

    // 다운로드
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `monitoring_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Utils.showToast('엑셀 다운로드 완료', 'success');
  },
};

// 페이지 로드시 초기화
document.addEventListener('DOMContentLoaded', () => {
  MonitoringApp.init();
});

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
  RealtimeManager.cleanupSubscriptions();
});

// 전역 노출
window.MonitoringApp = MonitoringApp;
