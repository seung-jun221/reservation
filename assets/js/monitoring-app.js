// monitoring-app.js - 메인 애플리케이션 컨트롤러 (모바일 최적화 버전)

const MonitoringApp = {
  isMobile: window.innerWidth <= 768,

  // 초기화
  async init() {
    console.log('🚀 모니터링 앱 시작...');

    try {
      // 디바이스 체크
      this.checkDevice();
      window.addEventListener('resize', () => this.checkDevice());

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

  // 디바이스 체크
  checkDevice() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;

    if (wasMobile !== this.isMobile) {
      // 디바이스 변경 시 현재 탭 재렌더링
      console.log(
        '📱 디바이스 변경 감지:',
        this.isMobile ? '모바일' : '데스크톱'
      );
      this.updateCurrentTab();
    }

    // body에 클래스 추가/제거
    document.body.classList.toggle('mobile', this.isMobile);
    document.body.classList.toggle('desktop', !this.isMobile);

    // 모바일일 때 뷰포트 메타 태그 조정
    if (this.isMobile) {
      this.setMobileViewport();
    }
  },

  // 모바일 뷰포트 설정
  setMobileViewport() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  },

  // UI 초기화
  initializeUI() {
    // Chart.js 확인
    if (typeof Chart === 'undefined') {
      console.warn('⚠️ Chart.js가 로드되지 않음. 차트 기능 비활성화');
      this.loadChartJS();
    }

    // 이벤트 리스너 설정
    this.setupEventListeners();

    // 모바일 UI 초기화
    if (this.isMobile) {
      this.initializeMobileUI();
    }
  },

  // 모바일 UI 초기화
  initializeMobileUI() {
    // FAB 메뉴 생성
    this.createFABMenu();

    // 스와이프 제스처 설정
    this.setupSwipeGestures();

    // 모바일 최적화 클래스 추가
    document.querySelectorAll('.data-table').forEach((table) => {
      table.classList.add('mobile-optimized');
    });
  },

  // FAB 메뉴 생성
  createFABMenu() {
    // 기존 FAB 제거
    const existingFab = document.querySelector('.fab-container');
    if (existingFab) existingFab.remove();

    const fabHTML = `
      <div class="fab-container">
        <button class="fab-main" onclick="MonitoringApp.toggleFabMenu()">
          <span class="fab-icon">+</span>
        </button>
        <div class="fab-menu hidden" id="fabMenu">
          <button class="fab-item" onclick="MonitoringApp.exportToExcel()">
            <span>📊</span> 엑셀
          </button>
          <button class="fab-item" onclick="MonitoringApp.refreshData()">
            <span>🔄</span> 새로고침
          </button>
          <button class="fab-item" onclick="MonitoringApp.scrollToTop()">
            <span>⬆️</span> 맨 위로
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fabHTML);
  },

  // FAB 메뉴 토글
  toggleFabMenu() {
    const menu = document.getElementById('fabMenu');
    const icon = document.querySelector('.fab-icon');

    if (menu) {
      menu.classList.toggle('hidden');
      icon.textContent = menu.classList.contains('hidden') ? '+' : '×';
    }
  },

  // 스와이프 제스처 설정
  setupSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      false
    );

    document.addEventListener(
      'touchend',
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      },
      false
    );

    this.handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        const tabs = [
          'dashboard',
          'reservations',
          'checkin',
          'test',
          'consulting',
        ];
        const currentIndex = tabs.indexOf(GlobalState.currentTab);

        if (diff > 0 && currentIndex < tabs.length - 1) {
          // 왼쪽 스와이프 - 다음 탭
          this.switchTab(tabs[currentIndex + 1]);
        } else if (diff < 0 && currentIndex > 0) {
          // 오른쪽 스와이프 - 이전 탭
          this.switchTab(tabs[currentIndex - 1]);
        }
      }
    };
  },

  // Chart.js 동적 로드
  loadChartJS() {
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => {
      console.log('✅ Chart.js 동적 로드 성공');
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
    DataLoader.filterData();
    this.updateCurrentTab();

    Utils.showToast('필터 적용됨', 'info');
  },

  // 이벤트 리스너 설정
  setupEventListeners() {
    // 키보드 단축키 (데스크톱만)
    if (!this.isMobile) {
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
    }

    // 창 크기 변경시 처리
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // 디바이스 체크는 즉시
        this.checkDevice();

        // 차트 리사이즈
        if (GlobalState.currentTab === 'dashboard' && DashboardModule.chart) {
          DashboardModule.chart.resize();
        }
      }, 250);
    });

    // 모바일 뒤로가기 버튼 처리
    if (this.isMobile) {
      window.addEventListener('popstate', (e) => {
        if (e.state && e.state.tab) {
          this.switchTab(e.state.tab, false);
        }
      });
    }
  },

  // 탭 전환
  switchTab(tabName, pushState = true) {
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

      // 모바일에서 탭 버튼이 보이도록 스크롤
      if (this.isMobile) {
        tabBtn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
    }

    // 브라우저 히스토리 관리 (모바일)
    if (this.isMobile && pushState) {
      history.pushState({ tab: tabName }, '', `#${tabName}`);
    }

    // 탭별 초기화
    this.initializeTab(tabName);

    // FAB 메뉴 닫기
    if (this.isMobile) {
      const fabMenu = document.getElementById('fabMenu');
      if (fabMenu && !fabMenu.classList.contains('hidden')) {
        this.toggleFabMenu();
      }
    }
  },

  // 탭 초기화
  initializeTab(tabName) {
    // 모바일에서는 로딩 표시
    if (this.isMobile) {
      Utils.showLoading(true);
      setTimeout(() => Utils.showLoading(false), 300);
    }

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

  // 엑셀 내보내기
  exportToExcel() {
    console.log('📊 엑셀 내보내기...');

    // 현재 탭에 따라 다른 데이터 내보내기
    let csv = '';
    let filename = '';

    switch (GlobalState.currentTab) {
      case 'consulting':
        ConsultingModule.exportToExcel();
        return;
      case 'reservations':
        csv = this.exportReservationsCSV();
        filename = 'reservations';
        break;
      case 'checkin':
        csv = this.exportCheckinCSV();
        filename = 'checkin';
        break;
      default:
        csv = this.exportAllDataCSV();
        filename = 'monitoring';
    }

    // 다운로드
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Utils.showToast('엑셀 다운로드 완료', 'success');

    // 모바일에서 FAB 메뉴 닫기
    if (this.isMobile) {
      this.toggleFabMenu();
    }
  },

  // 전체 데이터 CSV
  exportAllDataCSV() {
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

    return csv;
  },

  // 예약 데이터 CSV
  exportReservationsCSV() {
    let csv = '설명회,학생명,학교,학년,연락처,예약일시,상태\n';

    GlobalState.filteredReservations.forEach((r) => {
      csv += `"${r.seminar_name}","${r.student_name}","${r.school}","${r.grade}","${r.parent_phone}","${r.registered_at}","${r.status}"\n`;
    });

    return csv;
  },

  // 체크인 데이터 CSV
  exportCheckinCSV() {
    let csv = '체크인시간,학생명,설명회,선택항목,연락처,상태\n';

    GlobalState.filteredReservations
      .filter((r) => r.attendance_checked_at)
      .forEach((r) => {
        const choice =
          r.post_checkin_choice === 'test'
            ? '진단검사'
            : r.post_checkin_choice === 'consult'
            ? '상담희망'
            : '미선택';
        csv += `"${r.attendance_checked_at}","${r.student_name}","${
          r.seminar_name
        }","${choice}","${r.parent_phone}","${r.status || '-'}"\n`;
      });

    return csv;
  },

  // 맨 위로 스크롤
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (this.isMobile) {
      this.toggleFabMenu();
    }
  },

  // 모바일 뷰포트 높이 조정 (iOS Safari 대응)
  setMobileViewportHeight() {
    if (this.isMobile) {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
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

// 모바일 뷰포트 높이 조정
window.addEventListener('resize', () => {
  MonitoringApp.setMobileViewportHeight();
});

// 전역 노출
window.MonitoringApp = MonitoringApp;
