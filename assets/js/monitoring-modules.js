// monitoring-modules.js - 각 탭별 모듈 기능

// ===== 대시보드 모듈 =====
const DashboardModule = {
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
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  },

  update() {
    // 통계 계산
    const stats = this.calculateStats();

    // 카드 업데이트
    document.getElementById('stat-total-reservations').textContent =
      stats.totalReservations;
    document.getElementById('stat-total-checkins').textContent =
      stats.totalCheckins;
    document.getElementById('stat-total-tests').textContent = stats.totalTests;
    document.getElementById('stat-total-consultings').textContent =
      stats.totalConsultings;

    // 차트 업데이트
    if (this.chart) {
      this.chart.data.datasets[0].data = [
        stats.totalReservations,
        stats.totalCheckins,
        stats.totalTests,
        stats.totalConsultings,
      ];
      this.chart.update();
    }

    // 최근 활동 업데이트
    this.updateRecentActivities();
  },

  calculateStats() {
    const totalReservations = allReservations.length;
    const totalCheckins = allReservations.filter(
      (r) => r.status === '참석'
    ).length;
    const totalTests = allTestApplications.length;
    const totalConsultings = allReservations.filter(
      (r) => r.post_checkin_choice === 'consult'
    ).length;

    return {
      totalReservations,
      totalCheckins,
      totalTests,
      totalConsultings,
    };
  },

  updateRecentActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    // 최근 활동 10개 표시
    const recentActivities = [
      ...allReservations.slice(0, 5).map((r) => ({
        time: r.registered_at,
        type: '예약',
        message: `${r.student_name}님이 예약했습니다`,
      })),
      ...allTestApplications.slice(0, 5).map((t) => ({
        time: t.created_at,
        type: '진단검사',
        message: `${t.student_name}님이 진단검사를 신청했습니다`,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10);

    activityList.innerHTML = recentActivities
      .map(
        (activity) => `
            <div class="activity-item">
                <span class="activity-time">${formatDateTime(
                  activity.time
                )}</span>
                <span class="activity-type badge">${activity.type}</span>
                <span class="activity-message">${activity.message}</span>
            </div>
        `
      )
      .join('');
  },
};

// ===== 진단검사 모듈 =====
const TestModule = {
  async update() {
    this.renderTable();
    this.updateStats();
    this.setupFilters();
  },

  renderTable() {
    const tbody = document.getElementById('testTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 필터링된 데이터
    let filteredData = [...allTestApplications];

    // 필터 적용
    const typeFilter = document.getElementById('testTypeFilter')?.value;
    if (typeFilter) {
      filteredData = filteredData.filter(
        (item) => item.test_type === typeFilter
      );
    }

    const searchInput = document
      .getElementById('testSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      filteredData = filteredData.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(searchInput) ||
          item.school?.toLowerCase().includes(searchInput)
      );
    }

    // 테이블 렌더링
    filteredData.forEach((item, index) => {
      const row = document.createElement('tr');

      // 다운로드 완료 여부
      const isDownloaded = item.downloaded_at && item.test_type;

      // 신청 시간과 다운로드 시간 구분
      const applicationTime = formatDateTime(item.created_at);
      const downloadTime = item.downloaded_at
        ? formatDateTime(item.downloaded_at)
        : '-';

      row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.seminar_name || '-'}</td>
                <td>${item.student_name}</td>
                <td>${item.school}</td>
                <td>${item.grade}</td>
                <td>${item.math_level || '-'}</td>
                <td>
                    ${
                      item.test_type
                        ? `<span class="badge badge-primary">${item.test_type}</span>`
                        : '<span class="badge badge-warning">미선택</span>'
                    }
                    ${item.hme_grade ? ` (${item.hme_grade})` : ''}
                </td>
                <td>
                    ${
                      isDownloaded
                        ? `<span class="badge badge-success">✓ ${downloadTime}</span>`
                        : '<span class="badge badge-secondary">미완료</span>'
                    }
                </td>
                <td>${applicationTime}</td>
            `;

      tbody.appendChild(row);
    });
  },

  updateStats() {
    // 통계 업데이트
    const total = allTestApplications.length;
    const hmeCount = allTestApplications.filter(
      (d) => d.test_type === 'HME'
    ).length;
    const monoTriCount = allTestApplications.filter(
      (d) => d.test_type === 'MONO' || d.test_type === 'TRI'
    ).length;
    const mockCount = allTestApplications.filter(
      (d) => d.test_type === 'MOCK'
    ).length;

    document.getElementById('test-total').textContent = total;
    document.getElementById('test-hme').textContent = hmeCount;
    document.getElementById('test-mono-tri').textContent = monoTriCount;
    document.getElementById('test-mock').textContent = mockCount;
  },

  setupFilters() {
    // 필터 이벤트 리스너
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

// ===== 체크인 모듈 =====
const CheckinModule = {
  update() {
    this.calculateStats();
    this.renderTable();
  },

  calculateStats() {
    const checkedIn = allReservations.filter(
      (r) => r.status === '참석' && r.attendance_checked_at
    );

    const stats = {
      total: checkedIn.length,
      test: checkedIn.filter((r) => r.post_checkin_choice === 'test').length,
      consult: checkedIn.filter((r) => r.post_checkin_choice === 'consult')
        .length,
      pending: checkedIn.filter((r) => !r.post_checkin_choice).length,
    };

    // UI 업데이트
    document.getElementById('checkin-total').textContent = stats.total;
    document.getElementById('checkin-test').textContent = stats.test;
    document.getElementById('checkin-consult').textContent = stats.consult;
    document.getElementById('checkin-pending').textContent = stats.pending;
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const checkedIn = allReservations
      .filter((r) => r.status === '참석' && r.attendance_checked_at)
      .sort(
        (a, b) =>
          new Date(b.attendance_checked_at) - new Date(a.attendance_checked_at)
      );

    checkedIn.forEach((item) => {
      const row = document.createElement('tr');

      let choiceBadge = '<span class="badge badge-secondary">미선택</span>';
      if (item.post_checkin_choice === 'test') {
        choiceBadge = '<span class="badge badge-info">진단검사</span>';
      } else if (item.post_checkin_choice === 'consult') {
        choiceBadge = '<span class="badge badge-success">컨설팅</span>';
      }

      row.innerHTML = `
                <td>${formatDateTime(item.attendance_checked_at)}</td>
                <td>${item.student_name}</td>
                <td>${item.seminar_name || '-'}</td>
                <td>${item.checkin_type === 'offline' ? '현장' : '온라인'}</td>
                <td>${choiceBadge}</td>
                <td>${
                  item.post_checkin_at
                    ? formatDateTime(item.post_checkin_at)
                    : '-'
                }</td>
            `;

      tbody.appendChild(row);
    });
  },
};

// ===== 설명회 예약 모듈 =====
const SeminarModule = {
  update() {
    this.renderStats();
    this.renderTable();
  },

  renderStats() {
    // 설명회별 통계 계산
    const seminarStats = {};

    allReservations.forEach((r) => {
      const key = r.seminar_id || 'unknown';
      if (!seminarStats[key]) {
        seminarStats[key] = {
          name: r.seminar_name || '미지정',
          total: 0,
          attended: 0,
          cancelled: 0,
        };
      }

      seminarStats[key].total++;
      if (r.status === '참석') seminarStats[key].attended++;
      if (r.status === '취소') seminarStats[key].cancelled++;
    });

    // 통계 표시
    const statsContainer = document.getElementById('seminarStats');
    if (statsContainer) {
      statsContainer.innerHTML = Object.values(seminarStats)
        .map(
          (stat) => `
                <div class="seminar-stat-card">
                    <h4>${stat.name}</h4>
                    <div class="stat-row">
                        <span>전체: ${stat.total}</span>
                        <span>참석: ${stat.attended}</span>
                        <span>취소: ${stat.cancelled}</span>
                    </div>
                </div>
            `
        )
        .join('');
    }
  },

  renderTable() {
    const tbody = document.getElementById('seminarTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 필터링
    let filteredData = [...allReservations];

    const statusFilter = document.getElementById('seminarStatusFilter')?.value;
    if (statusFilter) {
      filteredData = filteredData.filter((r) => r.status === statusFilter);
    }

    const searchInput = document
      .getElementById('seminarSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      filteredData = filteredData.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(searchInput) ||
          r.parent_phone?.includes(searchInput)
      );
    }

    // 렌더링
    filteredData.forEach((item) => {
      const row = document.createElement('tr');

      let statusBadge = '';
      switch (item.status) {
        case '예약':
          statusBadge = '<span class="badge badge-primary">예약</span>';
          break;
        case '참석':
          statusBadge = '<span class="badge badge-success">참석</span>';
          break;
        case '취소':
          statusBadge = '<span class="badge badge-danger">취소</span>';
          break;
        default:
          statusBadge = '<span class="badge badge-secondary">-</span>';
      }

      row.innerHTML = `
                <td>${item.reservation_id || '-'}</td>
                <td>${item.seminar_name || '-'}</td>
                <td>${item.student_name}</td>
                <td>${formatPhoneNumber(item.parent_phone)}</td>
                <td>${item.school}</td>
                <td>${item.grade}</td>
                <td>${statusBadge}</td>
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
    event.target.classList.add('active');

    // 뷰 전환
    if (view === 'calendar') {
      document.getElementById('consultingCalendar').style.display = 'block';
      document.getElementById('consultingList').style.display = 'none';
      this.renderCalendar();
    } else {
      document.getElementById('consultingCalendar').style.display = 'none';
      document.getElementById('consultingList').style.display = 'block';
      this.renderList();
    }
  },

  renderCalendar() {
    // 캘린더 뷰 구현
    const calendar = document.getElementById('consultingCalendar');
    if (!calendar) return;

    // 간단한 캘린더 구현 (실제로는 더 복잡한 캘린더 라이브러리 사용 권장)
    calendar.innerHTML =
      '<div class="calendar-placeholder">캘린더 뷰 구현 예정</div>';
  },

  renderList() {
    const tbody = document.getElementById('consultingTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const consultings = allReservations
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
                <td><span class="badge badge-warning">대기</span></td>
                <td>
                    <button class="btn btn-sm btn-primary">일정변경</button>
                </td>
            `;

      tbody.appendChild(row);
    });
  },

  updateStats() {
    // 통계 업데이트
    const today = new Date().toDateString();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const consultings = allReservations.filter(
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

// 전역 노출
window.DashboardModule = DashboardModule;
window.TestModule = TestModule;
window.CheckinModule = CheckinModule;
window.SeminarModule = SeminarModule;
window.ConsultingModule = ConsultingModule;
