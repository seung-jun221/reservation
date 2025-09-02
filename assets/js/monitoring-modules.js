// monitoring-modules.js - 개선된 각 탭별 모듈 기능

// ===== 대시보드 모듈 =====
const DashboardModule = {
  chart: null,

  initialize() {
    this.initializeChart();
    this.update();
  },

  update() {
    this.updateStats();
    this.updateChart();
    this.updateRecentActivities();
    this.updateSeminarAnalysis();
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
            borderColor: [
              'rgba(26, 115, 232, 1)',
              'rgba(52, 168, 83, 1)',
              'rgba(251, 188, 4, 1)',
              'rgba(234, 67, 53, 1)',
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
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
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 10,
            },
          },
        },
      },
    });
  },

  updateStats() {
    const reservations = window.filteredReservations || [];
    const testApps = window.filteredTestApplications || [];
    const consultingApps = window.filteredConsultingReservations || [];

    // 통계 계산
    const stats = {
      totalReservations: reservations.length,
      checkedIn: reservations.filter((r) => r.attendance_checked_at).length,
      testApplications: testApps.length,
      consultingReservations: consultingApps.length,
      todayReservations: reservations.filter((r) => {
        const today = new Date().toDateString();
        return new Date(r.registered_at).toDateString() === today;
      }).length,
    };

    // 전환율 계산
    stats.checkinRate =
      stats.totalReservations > 0
        ? ((stats.checkedIn / stats.totalReservations) * 100).toFixed(1)
        : 0;
    stats.testRate =
      stats.checkedIn > 0
        ? ((stats.testApplications / stats.checkedIn) * 100).toFixed(1)
        : 0;
    stats.consultingRate =
      stats.checkedIn > 0
        ? ((stats.consultingReservations / stats.checkedIn) * 100).toFixed(1)
        : 0;

    // UI 업데이트
    const elements = {
      'total-reservations': stats.totalReservations,
      'total-checkins': stats.checkedIn,
      'total-tests': stats.testApplications,
      'total-consultings': stats.consultingReservations,
      'checkin-rate': `${stats.checkinRate}%`,
      'test-rate': `${stats.testRate}%`,
      'consulting-rate': `${stats.consultingRate}%`,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  },

  updateChart() {
    if (!this.chart) return;

    const reservations = window.filteredReservations || [];
    const checkedIn = reservations.filter((r) => r.attendance_checked_at);
    const testApps = window.filteredTestApplications || [];
    const consultingApps = window.filteredConsultingReservations || [];

    this.chart.data.datasets[0].data = [
      reservations.length,
      checkedIn.length,
      testApps.length,
      consultingApps.length,
    ];

    this.chart.update();
  },

  updateRecentActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const activities = [];

    // 예약 활동
    (window.filteredReservations || []).slice(0, 5).forEach((r) => {
      activities.push({
        time: r.registered_at,
        type: '예약',
        message: `${r.student_name}님이 예약했습니다`,
        icon: '📋',
      });
    });

    // 체크인 활동
    (window.filteredReservations || [])
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
    (window.filteredTestApplications || []).slice(0, 5).forEach((t) => {
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

    if (recentActivities.length === 0) {
      activityList.innerHTML =
        '<div class="empty-state">최근 활동이 없습니다</div>';
    }
  },

  updateSeminarAnalysis() {
    const analysisContainer = document.getElementById('seminar-analysis');
    if (!analysisContainer) return;

    const seminarInfo = globalState.seminarInfo;

    if (!seminarInfo) {
      analysisContainer.innerHTML =
        '<div class="analysis-placeholder">설명회를 선택하면 상세 분석이 표시됩니다</div>';
      return;
    }

    const location = seminarInfo.title.split('-').pop()?.trim() || '기타';
    const date = new Date(seminarInfo.date);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    const reservations = window.filteredReservations || [];
    const checkedIn = reservations.filter((r) => r.attendance_checked_at);
    const testApps = window.filteredTestApplications || [];
    const consultingApps = window.filteredConsultingReservations || [];

    analysisContainer.innerHTML = `
      <div class="seminar-analysis-card">
        <h4>📍 ${dateStr} ${location} 설명회 분석</h4>
        <div class="analysis-content">
          <div class="analysis-stat">
            <span class="label">예약/참석</span>
            <span class="value">${reservations.length}명 / ${
      checkedIn.length
    }명</span>
          </div>
          <div class="analysis-stat">
            <span class="label">진단검사 신청</span>
            <span class="value">${testApps.length}명</span>
          </div>
          <div class="analysis-stat">
            <span class="label">컨설팅 예약</span>
            <span class="value">${consultingApps.length}명</span>
          </div>
          <div class="conversion-rate">
            전환율: ${
              checkedIn.length > 0
                ? (
                    ((testApps.length + consultingApps.length) /
                      checkedIn.length) *
                    100
                  ).toFixed(1)
                : 0
            }%
          </div>
        </div>
      </div>
    `;
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
    const data = window.filteredReservations || [];

    // 설명회별 통계 계산
    data.forEach((r) => {
      const key = r.seminar_id || 'unknown';
      if (!seminarStats[key]) {
        seminarStats[key] = {
          id: r.seminar_id,
          name: r.seminar_name || '미지정',
          date: r.seminar_date,
          total: 0,
          attended: 0,
          cancelled: 0,
          pending: 0,
          checkedIn: 0,
        };
      }

      seminarStats[key].total++;
      if (r.status === '참석') seminarStats[key].attended++;
      if (r.status === '취소') seminarStats[key].cancelled++;
      if (r.status === '예약') seminarStats[key].pending++;
      if (r.attendance_checked_at) seminarStats[key].checkedIn++;
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
          const checkinRate =
            stat.attended > 0
              ? ((stat.checkedIn / stat.attended) * 100).toFixed(1)
              : 0;

          return `
          <div class="seminar-stat-card">
            <div class="seminar-stat-header">
              <h4>${stat.name}</h4>
              ${stat.date ? `<small>${formatDateShort(stat.date)}</small>` : ''}
            </div>
            <div class="seminar-stat-body">
              <div class="stat-row">
                <span>총 예약: ${stat.total}명</span>
                <span>참석률: ${attendRate}%</span>
              </div>
              <div class="stat-row">
                <span>체크인: ${stat.checkedIn}명</span>
                <span>체크인률: ${checkinRate}%</span>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      if (Object.keys(seminarStats).length === 0) {
        statsContainer.innerHTML =
          '<div class="empty-state">설명회 데이터가 없습니다</div>';
      }
    }
  },

  renderTable() {
    const tbody = document.getElementById('seminarTableBody');
    if (!tbody) return;

    // 필터링
    let data = [...(window.filteredReservations || [])];

    const statusFilter = document.getElementById('seminarStatusFilter')?.value;
    if (statusFilter) {
      data = data.filter((item) => item.status === statusFilter);
    }

    const searchInput = document
      .getElementById('seminarSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      data = data.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(searchInput) ||
          item.school?.toLowerCase().includes(searchInput) ||
          item.parent_phone?.includes(searchInput)
      );
    }

    // 테이블 렌더링
    tbody.innerHTML = data
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.seminar_name || '-'}</td>
        <td>
          <strong>${item.student_name}</strong>
          <br><small>${formatPhoneNumber(item.parent_phone)}</small>
        </td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${this.getStatusBadge(item.status)}</td>
        <td>${
          item.attendance_checked_at
            ? `✅ ${formatDateTime(item.attendance_checked_at)}`
            : '-'
        }</td>
        <td>${formatDateTime(item.registered_at)}</td>
        <td>
          <div class="action-buttons">
            ${
              !item.attendance_checked_at && item.status === '예약'
                ? `<button class="btn btn-sm btn-success" onclick="checkInReservation(${item.id})">체크인</button>`
                : ''
            }
            <button class="btn btn-sm btn-primary" onclick="editReservation(${
              item.id
            })">수정</button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center empty-state">
            ${
              searchInput || statusFilter
                ? '검색 결과가 없습니다.'
                : '예약 데이터가 없습니다.'
            }
          </td>
        </tr>
      `;
    }
  },

  getStatusBadge(status) {
    const badges = {
      예약: '<span class="badge badge-primary">예약</span>',
      참석: '<span class="badge badge-success">참석</span>',
      취소: '<span class="badge badge-danger">취소</span>',
      노쇼: '<span class="badge badge-warning">노쇼</span>',
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
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.renderTable(), 300);
      });
      searchInput.hasListener = true;
    }
  },
};

// ===== 체크인 분석 모듈 =====
const CheckinModule = {
  update() {
    const stats = this.calculateStats();
    this.renderStats(stats);
    this.renderTable();
    this.renderConversionChart(stats);
  },

  calculateStats() {
    const data = window.filteredReservations || [];
    const checkedIn = data.filter(
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
    stats.testRate =
      stats.total > 0 ? ((stats.test / stats.total) * 100).toFixed(1) : 0;
    stats.consultRate =
      stats.total > 0 ? ((stats.consult / stats.total) * 100).toFixed(1) : 0;
    stats.pendingRate =
      stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0;

    return stats;
  },

  renderStats(stats) {
    // 체크인 통계 카드 업데이트
    document.querySelectorAll('[id^="checkin-"]').forEach((element) => {
      const key = element.id.replace('checkin-', '');
      if (stats[key] !== undefined) {
        element.textContent = stats[key];
      }
    });

    // 전환율 표시
    const rateElements = {
      'checkin-test-rate': `${stats.testRate}%`,
      'checkin-consult-rate': `${stats.consultRate}%`,
      'checkin-pending-rate': `${stats.pendingRate}%`,
    };

    Object.entries(rateElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    const checkedInData = (window.filteredReservations || [])
      .filter((r) => r.attendance_checked_at)
      .sort(
        (a, b) =>
          new Date(b.attendance_checked_at) - new Date(a.attendance_checked_at)
      );

    tbody.innerHTML = checkedInData
      .map(
        (item) => `
      <tr>
        <td>${formatDateTime(item.attendance_checked_at)}</td>
        <td><strong>${item.student_name}</strong></td>
        <td>${item.seminar_name || '-'}</td>
        <td>${item.checkin_type === 'online' ? '🌐 온라인' : '📍 오프라인'}</td>
        <td>${this.getChoiceBadge(item.post_checkin_choice)}</td>
        <td>${
          item.post_checkin_time ? formatDateTime(item.post_checkin_time) : '-'
        }</td>
      </tr>
    `
      )
      .join('');

    if (checkedInData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center empty-state">체크인 데이터가 없습니다.</td>
        </tr>
      `;
    }
  },

  getChoiceBadge(choice) {
    const badges = {
      test: '<span class="badge badge-info">📝 진단검사</span>',
      consult: '<span class="badge badge-success">💼 컨설팅</span>',
    };
    return badges[choice] || '<span class="badge badge-warning">미선택</span>';
  },

  renderConversionChart(stats) {
    const chartContainer = document.getElementById('checkin-conversion-chart');
    if (!chartContainer) return;

    chartContainer.innerHTML = `
      <div class="conversion-bars">
        <h4>체크인 후 전환율</h4>
        <div class="bar-chart">
          <div class="bar-item">
            <div class="bar-label">진단검사</div>
            <div class="bar-container">
              <div class="bar-fill test" style="width: ${stats.testRate}%"></div>
              <span class="bar-value">${stats.testRate}%</span>
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-label">컨설팅</div>
            <div class="bar-container">
              <div class="bar-fill consult" style="width: ${stats.consultRate}%"></div>
              <span class="bar-value">${stats.consultRate}%</span>
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-label">미선택</div>
            <div class="bar-container">
              <div class="bar-fill pending" style="width: ${stats.pendingRate}%"></div>
              <span class="bar-value">${stats.pendingRate}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
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

    // 필터링
    let data = [...(window.filteredTestApplications || [])];

    // 유형 필터
    const typeFilter = document.getElementById('testTypeFilter')?.value;
    if (typeFilter) {
      data = data.filter((item) => item.test_type === typeFilter);
    }

    // 검색 필터
    const searchInput = document
      .getElementById('testSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      data = data.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(searchInput) ||
          item.school?.toLowerCase().includes(searchInput) ||
          item.parent_phone?.includes(searchInput)
      );
    }

    // 설명회 정보 매칭 - reservation_id가 없으면 phone으로 매칭 시도
    data = data.map((item) => {
      let reservation = null;

      // 먼저 reservation_id로 매칭 시도
      if (item.reservation_id) {
        reservation = (window.filteredReservations || []).find(
          (r) => r.id === item.reservation_id
        );
      }

      // reservation_id로 못 찾으면 phone 번호로 매칭 시도
      if (!reservation && item.parent_phone) {
        reservation = (window.filteredReservations || []).find(
          (r) =>
            r.parent_phone === item.parent_phone ||
            r.parent_phone?.replace(/-/g, '') ===
              item.parent_phone?.replace(/-/g, '')
        );
      }

      // 그래도 못 찾으면 학생 이름으로 매칭 시도
      if (!reservation && item.student_name) {
        reservation = (window.filteredReservations || []).find(
          (r) => r.student_name === item.student_name
        );
      }

      return { ...item, reservation };
    });

    // 설명회별 정렬
    data.sort((a, b) => {
      if (a.reservation?.seminar_id !== b.reservation?.seminar_id) {
        return (
          (b.reservation?.seminar_id || 0) - (a.reservation?.seminar_id || 0)
        );
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // 테이블 렌더링
    tbody.innerHTML = data
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="seminar-info">
            <span>${item.reservation?.seminar_name || '-'}</span>
            ${
              item.reservation?.seminar_date
                ? `<small>${formatDateShort(
                    item.reservation.seminar_date
                  )}</small>`
                : ''
            }
          </div>
        </td>
        <td>
          <strong>${item.student_name}</strong>
          ${
            item.parent_phone
              ? `<br><small>${formatPhoneNumber(item.parent_phone)}</small>`
              : ''
          }
        </td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.math_level || '-'}</td>
        <td>${this.getTestTypeBadge(item.test_type, item.hme_grade)}</td>
        <td>${this.getDownloadStatus(item.downloaded_at, item.test_type)}</td>
        <td><small>${formatDateTime(item.created_at)}</small></td>
      </tr>
    `
      )
      .join('');

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center empty-state">
            ${
              searchInput || typeFilter
                ? '검색 결과가 없습니다.'
                : '진단검사 신청 데이터가 없습니다.'
            }
          </td>
        </tr>
      `;
    }

    console.log('진단검사 테이블 렌더링:', data.length, '건');
  },

  getTestTypeBadge(type, hmeGrade) {
    const badges = {
      HME: `<span class="test-type-badge hme">HME${
        hmeGrade ? ` ${hmeGrade}` : ''
      }</span>`,
      MONO: '<span class="test-type-badge mono">MONO</span>',
      TRI: '<span class="test-type-badge tri">TRI</span>',
      MOCK: '<span class="test-type-badge mock">모의고사</span>',
    };
    return badges[type] || '<span class="badge badge-secondary">미선택</span>';
  },

  getDownloadStatus(downloadedAt, testType) {
    if (!testType) {
      return '<span class="download-status pending">⚠️ 미선택</span>';
    }
    if (downloadedAt) {
      return `<span class="download-status completed">✅ ${formatDateTime(
        downloadedAt
      )}</span>`;
    }
    return '<span class="download-status pending">❌ 미다운로드</span>';
  },

  updateStats() {
    const data = window.filteredTestApplications || [];

    const total = data.length;
    const hmeCount = data.filter((d) => d.test_type === 'HME').length;
    const monoTriCount = data.filter(
      (d) => d.test_type === 'MONO' || d.test_type === 'TRI'
    ).length;
    const mockCount = data.filter((d) => d.test_type === 'MOCK').length;
    const downloadedCount = data.filter((d) => d.downloaded_at).length;

    document.getElementById('test-total').textContent = total;
    document.getElementById('test-hme').textContent = hmeCount;
    document.getElementById('test-mono-tri').textContent = monoTriCount;
    document.getElementById('test-mock').textContent = mockCount;

    // 다운로드 완료율 표시
    const downloadRate =
      total > 0 ? ((downloadedCount / total) * 100).toFixed(1) : 0;
    const rateElement = document.getElementById('test-download-rate');
    if (rateElement) {
      rateElement.textContent = `다운로드 완료: ${downloadedCount}명 (${downloadRate}%)`;
    }
  },

  setupFilters() {
    const typeFilter = document.getElementById('testTypeFilter');
    const searchInput = document.getElementById('testSearchInput');

    if (typeFilter && !typeFilter.hasListener) {
      typeFilter.addEventListener('change', () => this.renderTable());
      typeFilter.hasListener = true;
    }

    if (searchInput && !searchInput.hasListener) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.renderTable(), 300);
      });
      searchInput.hasListener = true;
    }
  },
};

// ===== 컨설팅 모듈 =====
const ConsultingModule = {
  currentView: 'calendar',
  currentMonth: new Date(),

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

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    calendar.innerHTML = `
      <div class="calendar-header">
        <button class="btn btn-sm" onclick="ConsultingModule.previousMonth()">◀</button>
        <h3>${year}년 ${month + 1}월</h3>
        <button class="btn btn-sm" onclick="ConsultingModule.nextMonth()">▶</button>
      </div>
      <div class="calendar-grid">
        ${this.generateCalendarGrid(year, month)}
      </div>
    `;
  },

  generateCalendarGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let html = '';

    // 요일 헤더
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach((day, index) => {
      const isWeekend = index === 0 || index === 6;
      html += `<div class="calendar-cell header ${
        isWeekend ? 'weekend' : ''
      }">${day}</div>`;
    });

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-cell empty"></div>';
    }

    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      const consultings = this.getConsultingsForDate(dateStr);
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;
      const dayOfWeek = new Date(year, month, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let cellClass = 'calendar-cell';
      if (isToday) cellClass += ' today';
      if (isWeekend) cellClass += ' weekend';
      if (consultings.length > 0) cellClass += ' has-events';

      html += `
        <div class="${cellClass}" data-date="${dateStr}">
          <div class="day-number">${day}</div>
          ${
            consultings.length > 0
              ? `
            <div class="day-consultings">
              <span class="consulting-count">${consultings.length}건</span>
              ${consultings
                .slice(0, 2)
                .map(
                  (c) =>
                    `<div class="consulting-item">${c.time} ${c.student_name}</div>`
                )
                .join('')}
              ${
                consultings.length > 2
                  ? `<div class="more-consultings">+${
                      consultings.length - 2
                    }건</div>`
                  : ''
              }
            </div>
          `
              : ''
          }
        </div>
      `;
    }

    return html;
  },

  getConsultingsForDate(dateStr) {
    const consultings = window.filteredConsultingReservations || [];

    return consultings
      .filter((c) => {
        if (!c.date) return false;
        const consultDate = new Date(c.date).toISOString().split('T')[0];
        return consultDate === dateStr;
      })
      .map((c) => {
        const reservation = (window.filteredReservations || []).find(
          (r) => r.id === c.reservation_id
        );
        return {
          ...c,
          student_name: reservation?.student_name || '미상',
          time: c.time || '시간미정',
        };
      });
  },

  previousMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.renderCalendar();
  },

  renderList() {
    const tbody = document.getElementById('consultingTableBody');
    if (!tbody) return;

    let consultings = window.filteredConsultingReservations || [];

    // 예약 정보와 매칭
    consultings = consultings.map((c) => {
      const reservation = (window.filteredReservations || []).find(
        (r) => r.id === c.reservation_id
      );
      const testApp = (window.filteredTestApplications || []).find(
        (t) => t.reservation_id === c.reservation_id
      );
      return {
        ...c,
        student_name: reservation?.student_name || '미상',
        school: reservation?.school || '-',
        grade: reservation?.grade || '-',
        test_type: testApp?.test_type || '-',
      };
    });

    // 날짜순 정렬
    consultings.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    tbody.innerHTML = consultings
      .map(
        (item) => `
      <tr>
        <td>${item.date ? formatDateShort(item.date) : '미정'}</td>
        <td>${item.time || '시간미정'}</td>
        <td><strong>${item.student_name}</strong></td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.test_type}</td>
        <td>${this.getConsultingStatus(item)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary" onclick="scheduleConsulting(${
              item.id
            })">일정변경</button>
            ${
              item.status === 'scheduled'
                ? `<button class="btn btn-sm btn-success" onclick="completeConsulting(${item.id})">완료</button>`
                : ''
            }
          </div>
        </td>
      </tr>
    `
      )
      .join('');

    if (consultings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center empty-state">컨설팅 예약 데이터가 없습니다.</td>
        </tr>
      `;
    }
  },

  getConsultingStatus(item) {
    const statuses = {
      completed: '<span class="badge badge-success">완료</span>',
      scheduled: '<span class="badge badge-primary">예정</span>',
      cancelled: '<span class="badge badge-danger">취소</span>',
      noshow: '<span class="badge badge-warning">노쇼</span>',
    };
    return (
      statuses[item.status] || '<span class="badge badge-secondary">미정</span>'
    );
  },

  updateStats() {
    const consultings = window.filteredConsultingReservations || [];
    const today = new Date();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() + 7);

    const stats = {
      week: 0,
      today: 0,
      pending: 0,
      completed: 0,
    };

    consultings.forEach((c) => {
      if (c.status === 'completed') {
        stats.completed++;
      } else if (c.status === 'scheduled') {
        stats.pending++;

        if (c.date) {
          const consultDate = new Date(c.date);
          if (consultDate.toDateString() === today.toDateString()) {
            stats.today++;
          }
          if (consultDate <= thisWeek) {
            stats.week++;
          }
        }
      }
    });

    // UI 업데이트
    if (document.getElementById('consulting-week')) {
      document.getElementById('consulting-week').textContent = stats.week;
    }
    if (document.getElementById('consulting-today')) {
      document.getElementById('consulting-today').textContent = stats.today;
    }
    if (document.getElementById('consulting-pending')) {
      document.getElementById('consulting-pending').textContent = stats.pending;
    }

    // 완료율 계산
    const total = consultings.length;
    const completionRate =
      total > 0 ? ((stats.completed / total) * 100).toFixed(1) : 0;

    const rateElement = document.getElementById('consulting-completion-rate');
    if (rateElement) {
      rateElement.textContent = `완료율: ${completionRate}%`;
    }
  },
};

// ===== 액션 함수들 =====
function checkInReservation(id) {
  console.log('체크인:', id);
  showToast(`예약 ID ${id} 체크인 처리`, 'success');
  // TODO: 실제 체크인 처리 구현
}

function editReservation(id) {
  console.log('예약 수정:', id);
  showToast(`예약 ID ${id} 수정 기능 구현 예정`, 'info');
  // TODO: 수정 모달 열기
}

function scheduleConsulting(id) {
  console.log('컨설팅 일정 변경:', id);
  showToast(`컨설팅 ID ${id} 일정 변경`, 'info');
  // TODO: 일정 변경 모달 열기
}

function completeConsulting(id) {
  console.log('컨설팅 완료:', id);
  showToast(`컨설팅 ID ${id} 완료 처리`, 'success');
  // TODO: 완료 처리 구현
}

// 전역 노출
window.DashboardModule = DashboardModule;
window.SeminarModule = SeminarModule;
window.CheckinModule = CheckinModule;
window.TestModule = TestModule;
window.ConsultingModule = ConsultingModule;
window.checkInReservation = checkInReservation;
window.editReservation = editReservation;
window.scheduleConsulting = scheduleConsulting;
window.completeConsulting = completeConsulting;
