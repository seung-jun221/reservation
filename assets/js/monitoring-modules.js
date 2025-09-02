// monitoring-modules.js - 개선된 각 탭별 모듈 기능

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

    // 설명회별 분석 (선택된 경우)
    if (globalState?.selectedSeminar && globalState.selectedSeminar !== 'all') {
      this.showSeminarSpecificAnalysis();
    }
  },

  calculateStats() {
    // 필터링된 데이터 사용
    const data = {
      reservations: window.filteredReservations || [],
      testApplications: window.filteredTestApplications || [],
      consultingSlots: window.filteredConsultingSlots || [],
    };

    const totalReservations = data.reservations.length;
    const totalCheckins = data.reservations.filter(
      (r) => r.status === '참석' && r.attendance_checked_at
    ).length;
    const totalTests = data.testApplications.length;
    const totalConsultings = data.reservations.filter(
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
      overallConversion:
        stats.totalReservations > 0
          ? (
              ((stats.totalTests + stats.totalConsultings) /
                stats.totalReservations) *
              100
            ).toFixed(1)
          : 0,
    };
  },

  updateStatCards(stats, rates) {
    // 기본 통계
    const elements = {
      reservations: document.getElementById('stat-total-reservations'),
      checkins: document.getElementById('stat-total-checkins'),
      tests: document.getElementById('stat-total-tests'),
      consultings: document.getElementById('stat-total-consultings'),
    };

    if (elements.reservations)
      elements.reservations.textContent = stats.totalReservations;
    if (elements.checkins) elements.checkins.textContent = stats.totalCheckins;
    if (elements.tests) elements.tests.textContent = stats.totalTests;
    if (elements.consultings)
      elements.consultings.textContent = stats.totalConsultings;

    // 전환율 표시 (요소가 있는 경우)
    const rateElements = {
      checkinRate: document.getElementById('checkin-conversion-rate'),
      testRate: document.getElementById('test-conversion-rate'),
      consultingRate: document.getElementById('consulting-conversion-rate'),
      overallRate: document.getElementById('overall-conversion-rate'),
    };

    if (rateElements.checkinRate) {
      rateElements.checkinRate.textContent = `${rates.reservationToCheckin}%`;
    }
    if (rateElements.testRate) {
      rateElements.testRate.textContent = `${rates.checkinToTest}%`;
    }
    if (rateElements.consultingRate) {
      rateElements.consultingRate.textContent = `${rates.checkinToConsulting}%`;
    }
    if (rateElements.overallRate) {
      rateElements.overallRate.textContent = `${rates.overallConversion}%`;
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

    // 애니메이션과 함께 업데이트
    this.chart.update('active');
  },

  updateRecentActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const activities = [];
    const data = {
      reservations: window.filteredReservations || [],
      testApplications: window.filteredTestApplications || [],
    };

    // 예약 활동
    data.reservations.slice(0, 5).forEach((r) => {
      activities.push({
        time: r.registered_at,
        type: '예약',
        message: `${r.student_name}님이 예약했습니다`,
        icon: '📋',
        color: 'primary',
      });
    });

    // 체크인 활동
    data.reservations
      .filter((r) => r.attendance_checked_at)
      .slice(0, 5)
      .forEach((r) => {
        activities.push({
          time: r.attendance_checked_at,
          type: '체크인',
          message: `${r.student_name}님이 체크인했습니다`,
          icon: '✅',
          color: 'success',
        });
      });

    // 진단검사 활동
    data.testApplications.slice(0, 5).forEach((t) => {
      activities.push({
        time: t.created_at,
        type: '진단검사',
        message: `${t.student_name}님이 진단검사를 신청했습니다`,
        icon: '📝',
        color: 'info',
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
          <div class="activity-content">
            <span class="activity-time">${formatDateTime(activity.time)}</span>
            <span class="activity-type badge badge-${activity.color}">${
          activity.type
        }</span>
            <span class="activity-message">${activity.message}</span>
          </div>
        </div>
      `
      )
      .join('');
  },

  showSeminarSpecificAnalysis() {
    // 특정 설명회 선택 시 추가 분석 표시
    const seminarInfo = globalState?.seminarInfo;
    if (!seminarInfo) return;

    const analysisContainer = document.getElementById('seminar-analysis');
    if (!analysisContainer) return;

    const location = seminarInfo.title.split('-').pop()?.trim() || '기타';
    const date = new Date(seminarInfo.date);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    analysisContainer.innerHTML = `
      <div class="seminar-analysis-card">
        <h4>📍 ${dateStr} ${location} 설명회 분석</h4>
        <div class="analysis-content">
          <p>선택된 설명회의 상세 분석이 표시됩니다.</p>
        </div>
      </div>
    `;
  },
};

// ===== 설명회 예약 모듈 =====
const SeminarModule = {
  currentFilter: {
    status: '',
    searchText: '',
  },

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
          testApplied: 0,
          consultingApplied: 0,
        };
      }

      seminarStats[key].total++;
      if (r.status === '참석') seminarStats[key].attended++;
      if (r.status === '취소') seminarStats[key].cancelled++;
      if (r.status === '예약') seminarStats[key].pending++;
      if (r.attendance_checked_at) seminarStats[key].checkedIn++;
      if (r.post_checkin_choice === 'test') seminarStats[key].testApplied++;
      if (r.post_checkin_choice === 'consult')
        seminarStats[key].consultingApplied++;
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
          const conversionRate =
            stat.checkedIn > 0
              ? (
                  ((stat.testApplied + stat.consultingApplied) /
                    stat.checkedIn) *
                  100
                ).toFixed(1)
              : 0;

          return `
            <div class="seminar-stat-card">
              <div class="seminar-stat-header">
                <h4>${stat.name}</h4>
                ${
                  stat.date
                    ? `<span class="seminar-date">${formatDateShort(
                        stat.date
                      )}</span>`
                    : ''
                }
              </div>
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
              <div class="conversion-rates">
                <div class="rate-item">
                  <span class="rate-label">참석률:</span>
                  <span class="rate-value">${attendRate}%</span>
                </div>
                <div class="rate-item">
                  <span class="rate-label">체크인율:</span>
                  <span class="rate-value">${checkinRate}%</span>
                </div>
                <div class="rate-item">
                  <span class="rate-label">전환율:</span>
                  <span class="rate-value">${conversionRate}%</span>
                </div>
              </div>
              <div class="action-stats">
                <span class="action-item">
                  📝 진단검사: ${stat.testApplied}
                </span>
                <span class="action-item">
                  💼 컨설팅: ${stat.consultingApplied}
                </span>
              </div>
            </div>
          `;
        })
        .join('');

      // 통계가 없을 때
      if (Object.keys(seminarStats).length === 0) {
        statsContainer.innerHTML = `
          <div class="empty-state">
            <p>선택된 설명회의 예약 데이터가 없습니다.</p>
          </div>
        `;
      }
    }
  },

  renderTable() {
    const tbody = document.getElementById('seminarTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 필터링
    let data = [...(window.filteredReservations || [])];

    // 상태 필터
    const statusFilter = document.getElementById('seminarStatusFilter')?.value;
    if (statusFilter) {
      data = data.filter((r) => r.status === statusFilter);
      this.currentFilter.status = statusFilter;
    }

    // 검색 필터
    const searchInput = document
      .getElementById('seminarSearchInput')
      ?.value?.toLowerCase();
    if (searchInput) {
      data = data.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(searchInput) ||
          r.parent_phone?.includes(searchInput) ||
          r.school?.toLowerCase().includes(searchInput) ||
          r.reservation_id?.toLowerCase().includes(searchInput)
      );
      this.currentFilter.searchText = searchInput;
    }

    // 테이블 렌더링
    data.forEach((item, index) => {
      const row = document.createElement('tr');

      // 체크인 여부 확인
      const hasCheckedIn = item.attendance_checked_at ? true : false;
      const rowClass = hasCheckedIn ? 'has-checkin' : '';

      row.className = rowClass;
      row.innerHTML = `
        <td>${item.reservation_id || '-'}</td>
        <td>
          <div class="seminar-info">
            <span>${item.seminar_name || '-'}</span>
            ${
              item.seminar_date
                ? `<small>${formatDateShort(item.seminar_date)}</small>`
                : ''
            }
          </div>
        </td>
        <td>
          <strong>${item.student_name}</strong>
          ${
            hasCheckedIn
              ? '<span class="badge badge-sm badge-success">✓</span>'
              : ''
          }
        </td>
        <td>${formatPhoneNumber(item.parent_phone)}</td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${this.getStatusBadge(item.status)}</td>
        <td>
          <small>${formatDateTime(item.registered_at)}</small>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary" onclick="editReservation(${
              item.id
            })">
              수정
            </button>
            ${
              item.status === '예약'
                ? `
              <button class="btn btn-sm btn-success" onclick="checkInReservation(${item.id})">
                체크인
              </button>
            `
                : ''
            }
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    // 빈 상태 처리
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

    // 결과 수 표시
    this.updateResultCount(data.length);
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
      // 실시간 검색 with debounce
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.renderTable();
        }, 300);
      });
      searchInput.hasListener = true;
    }
  },

  updateResultCount(count) {
    const countElement = document.getElementById('seminar-result-count');
    if (countElement) {
      countElement.textContent = `검색 결과: ${count}건`;
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
    stats.conversionRate =
      stats.total > 0
        ? (((stats.test + stats.consult) / stats.total) * 100).toFixed(1)
        : 0;

    return stats;
  },

  renderStats(stats) {
    // 기본 통계
    const elements = {
      total: document.getElementById('checkin-total'),
      test: document.getElementById('checkin-test'),
      consult: document.getElementById('checkin-consult'),
      pending: document.getElementById('checkin-pending'),
    };

    if (elements.total) elements.total.textContent = stats.total;
    if (elements.test) elements.test.textContent = stats.test;
    if (elements.consult) elements.consult.textContent = stats.consult;
    if (elements.pending) elements.pending.textContent = stats.pending;

    // 전환율 표시
    const rateElements = {
      testRate: document.getElementById('checkin-test-rate'),
      consultRate: document.getElementById('checkin-consult-rate'),
      pendingRate: document.getElementById('checkin-pending-rate'),
      conversionRate: document.getElementById('checkin-conversion-rate'),
    };

    if (rateElements.testRate) {
      rateElements.testRate.textContent = `${stats.testRate}%`;
      rateElements.testRate.className = this.getRateClass(stats.testRate);
    }
    if (rateElements.consultRate) {
      rateElements.consultRate.textContent = `${stats.consultRate}%`;
      rateElements.consultRate.className = this.getRateClass(stats.consultRate);
    }
    if (rateElements.pendingRate) {
      rateElements.pendingRate.textContent = `${stats.pendingRate}%`;
    }
    if (rateElements.conversionRate) {
      rateElements.conversionRate.textContent = `전체 전환율: ${stats.conversionRate}%`;
    }

    // 온/오프라인 통계
    const typeElements = {
      online: document.getElementById('checkin-online'),
      offline: document.getElementById('checkin-offline'),
    };

    if (typeElements.online) typeElements.online.textContent = stats.online;
    if (typeElements.offline) typeElements.offline.textContent = stats.offline;
  },

  getRateClass(rate) {
    const numRate = parseFloat(rate);
    if (numRate >= 70) return 'rate-excellent';
    if (numRate >= 50) return 'rate-good';
    if (numRate >= 30) return 'rate-normal';
    return 'rate-low';
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const data = window.filteredReservations || [];
    const checkedIn = data
      .filter((r) => r.status === '참석' && r.attendance_checked_at)
      .sort(
        (a, b) =>
          new Date(b.attendance_checked_at) - new Date(a.attendance_checked_at)
      );

    checkedIn.forEach((item, index) => {
      const row = document.createElement('tr');

      // 선택 후 경과 시간 계산
      let elapsedTime = '-';
      if (item.post_checkin_at) {
        const checkinTime = new Date(item.attendance_checked_at);
        const choiceTime = new Date(item.post_checkin_at);
        const diffMinutes = Math.floor((choiceTime - checkinTime) / 1000 / 60);
        elapsedTime = `${diffMinutes}분`;
      }

      row.innerHTML = `
        <td>
          <div class="time-info">
            <strong>${formatDateTime(item.attendance_checked_at)}</strong>
            <small>${this.getRelativeTime(item.attendance_checked_at)}</small>
          </div>
        </td>
        <td>
          <strong>${item.student_name}</strong>
          ${item.school ? `<small>(${item.school})</small>` : ''}
        </td>
        <td>${item.seminar_name || '-'}</td>
        <td>
          ${
            item.checkin_type === 'offline'
              ? '<span class="badge badge-primary">현장</span>'
              : '<span class="badge badge-info">온라인</span>'
          }
        </td>
        <td>${this.getChoiceBadge(item.post_checkin_choice)}</td>
        <td>
          ${
            item.post_checkin_at
              ? `<div class="time-info">
              <strong>${formatDateTime(item.post_checkin_at)}</strong>
              <small>소요시간: ${elapsedTime}</small>
            </div>`
              : '<span class="text-muted">대기중</span>'
          }
        </td>
      `;
      tbody.appendChild(row);
    });

    if (checkedIn.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center empty-state">
            체크인 데이터가 없습니다.
          </td>
        </tr>
      `;
    }
  },

  getChoiceBadge(choice) {
    const badges = {
      test: '<span class="badge badge-info">📝 진단검사</span>',
      consult: '<span class="badge badge-success">💼 컨설팅</span>',
      both: '<span class="badge badge-primary">📝💼 둘다</span>',
    };
    return (
      badges[choice] || '<span class="badge badge-secondary">⏳ 미선택</span>'
    );
  },

  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60); // 분 단위

    if (diff < 1) return '방금 전';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  },

  renderConversionChart(stats) {
    const chartContainer = document.getElementById('checkin-conversion-chart');
    if (!chartContainer || !stats.total) return;

    // 간단한 도넛 차트 또는 프로그레스 바
    chartContainer.innerHTML = `
      <div class="conversion-chart">
        <div class="chart-title">체크인 후 선택 분포</div>
        <div class="chart-bars">
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
  currentFilter: {
    type: '',
    searchText: '',
    downloadStatus: '',
  },

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
    let data = [...(window.filteredTestApplications || [])];

    // 유형 필터
    const typeFilter = document.getElementById('testTypeFilter')?.value;
    if (typeFilter) {
      data = data.filter((item) => item.test_type === typeFilter);
      this.currentFilter.type = typeFilter;
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
      this.currentFilter.searchText = searchInput;
    }

    // 다운로드 상태 필터
    const downloadFilter = document.getElementById('testDownloadFilter')?.value;
    if (downloadFilter) {
      if (downloadFilter === 'completed') {
        data = data.filter((item) => item.downloaded_at);
      } else if (downloadFilter === 'pending') {
        data = data.filter((item) => !item.downloaded_at);
      }
      this.currentFilter.downloadStatus = downloadFilter;
    }

    // 테이블 렌더링
    data.forEach((item, index) => {
      const row = document.createElement('tr');
      const isDownloaded = item.downloaded_at && item.test_type;

      // 설명회 정보 가져오기
      const reservation = (window.filteredReservations || []).find(
        (r) => r.id === item.reservation_id
      );

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <div class="seminar-info">
            <span>${reservation?.seminar_name || '-'}</span>
            ${
              reservation?.seminar_date
                ? `<small>${formatDateShort(reservation.seminar_date)}</small>`
                : ''
            }
          </div>
        </td>
        <td>
          <strong>${item.student_name}</strong>
          ${
            item.parent_phone
              ? `<small>${formatPhoneNumber(item.parent_phone)}</small>`
              : ''
          }
        </td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.math_level || '-'}</td>
        <td>${this.getTestTypeBadge(item.test_type, item.hme_grade)}</td>
        <td>${this.getDownloadStatus(item.downloaded_at, item.test_type)}</td>
        <td>
          <small>${formatDateTime(item.created_at)}</small>
        </td>
      `;
      tbody.appendChild(row);
    });

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center empty-state">
            ${
              searchInput || typeFilter || downloadFilter
                ? '검색 결과가 없습니다.'
                : '진단검사 신청 데이터가 없습니다.'
            }
          </td>
        </tr>
      `;
    }

    // 결과 수 표시
    this.updateResultCount(data.length);
  },

  getTestTypeBadge(type, hmeGrade) {
    if (!type) {
      return '<span class="badge badge-warning">미선택</span>';
    }

    const badges = {
      HME: 'badge-hme',
      MONO: 'badge-mono',
      TRI: 'badge-tri',
      MOCK: 'badge-mock',
    };

    let badge = `<span class="badge ${
      badges[type] || 'badge-primary'
    }">${type}</span>`;
    if (type === 'HME' && hmeGrade) {
      badge += ` <span class="badge badge-secondary">${hmeGrade}</span>`;
    }
    return badge;
  },

  getDownloadStatus(downloadedAt, testType) {
    if (!testType) {
      return '<span class="badge badge-warning">검사 미선택</span>';
    }

    if (downloadedAt) {
      return `
        <div class="download-status completed">
          <span class="badge badge-success">✓ 완료</span>
          <small>${formatDateTime(downloadedAt)}</small>
        </div>
      `;
    }

    return `
      <div class="download-status pending">
        <span class="badge badge-danger">⏳ 대기</span>
        <button class="btn btn-xs btn-primary" onclick="markAsDownloaded(${item.id})">
          다운로드 완료
        </button>
      </div>
    `;
  },

  updateStats() {
    const data = window.filteredTestApplications || [];

    const stats = {
      total: data.length,
      hme: data.filter((d) => d.test_type === 'HME').length,
      mono: data.filter((d) => d.test_type === 'MONO').length,
      tri: data.filter((d) => d.test_type === 'TRI').length,
      mock: data.filter((d) => d.test_type === 'MOCK').length,
      unselected: data.filter((d) => !d.test_type).length,
      downloaded: data.filter((d) => d.downloaded_at).length,
      pending: data.filter((d) => d.test_type && !d.downloaded_at).length,
    };

    // 통계 업데이트
    const elements = {
      total: document.getElementById('test-total'),
      hme: document.getElementById('test-hme'),
      monoTri: document.getElementById('test-mono-tri'),
      mock: document.getElementById('test-mock'),
      downloaded: document.getElementById('test-downloaded'),
      pending: document.getElementById('test-pending'),
    };

    if (elements.total) elements.total.textContent = stats.total;
    if (elements.hme) elements.hme.textContent = stats.hme;
    if (elements.monoTri) elements.monoTri.textContent = stats.mono + stats.tri;
    if (elements.mock) elements.mock.textContent = stats.mock;
    if (elements.downloaded) elements.downloaded.textContent = stats.downloaded;
    if (elements.pending) elements.pending.textContent = stats.pending;

    // 완료율 표시
    const completionRate =
      stats.total > 0 ? ((stats.downloaded / stats.total) * 100).toFixed(1) : 0;

    const rateElement = document.getElementById('test-completion-rate');
    if (rateElement) {
      rateElement.textContent = `완료율: ${completionRate}%`;
    }
  },

  setupFilters() {
    const typeFilter = document.getElementById('testTypeFilter');
    const searchInput = document.getElementById('testSearchInput');
    const downloadFilter = document.getElementById('testDownloadFilter');

    if (typeFilter && !typeFilter.hasListener) {
      typeFilter.addEventListener('change', () => this.renderTable());
      typeFilter.hasListener = true;
    }

    if (searchInput && !searchInput.hasListener) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.renderTable();
        }, 300);
      });
      searchInput.hasListener = true;
    }

    if (downloadFilter && !downloadFilter.hasListener) {
      downloadFilter.addEventListener('change', () => this.renderTable());
      downloadFilter.hasListener = true;
    }
  },

  updateResultCount(count) {
    const countElement = document.getElementById('test-result-count');
    if (countElement) {
      countElement.textContent = `검색 결과: ${count}건`;
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
        ${this.generateCalendarDays(year, month)}
      </div>
    `;
  },

  generateCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let html = '';

    // 주 헤더
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach((day, index) => {
      const isWeekend = index === 0 || index === 6;
      html += `<div class="calendar-weekday ${
        isWeekend ? 'weekend' : ''
      }">${day}</div>`;
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
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;
      const dayOfWeek = new Date(year, month, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (isWeekend) dayClass += ' weekend';
      if (consultings.length > 0) dayClass += ' has-events';

      html += `
        <div class="${dayClass}" data-date="${dateStr}">
          <div class="day-number">${day}</div>
          ${
            consultings.length > 0
              ? `
            <div class="event-summary">
              <span class="event-count">${consultings.length}건</span>
              ${consultings
                .slice(0, 2)
                .map(
                  (c) => `
                <div class="event-item">
                  <small>${c.time} ${c.student_name}</small>
                </div>
              `
                )
                .join('')}
              ${
                consultings.length > 2
                  ? `<small>외 ${consultings.length - 2}건</small>`
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
    const data = window.filteredReservations || [];
    return data
      .filter((r) => {
        if (!r.consulting_date) return false;
        const consultingDate = new Date(r.consulting_date)
          .toISOString()
          .split('T')[0];
        return (
          consultingDate === dateStr && r.post_checkin_choice === 'consult'
        );
      })
      .map((r) => ({
        time: r.consulting_time || '미정',
        student_name: r.student_name,
      }));
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

    tbody.innerHTML = '';

    const data = window.filteredReservations || [];
    const consultings = data
      .filter((r) => r.post_checkin_choice === 'consult')
      .sort((a, b) => {
        // 날짜순 정렬 (미정은 뒤로)
        if (!a.consulting_date) return 1;
        if (!b.consulting_date) return -1;
        return new Date(a.consulting_date) - new Date(b.consulting_date);
      });

    consultings.forEach((item, index) => {
      const row = document.createElement('tr');
      const isCompleted = item.consulting_completed;
      const isPast =
        item.consulting_date && new Date(item.consulting_date) < new Date();

      row.className = isCompleted ? 'completed' : isPast ? 'past' : '';

      row.innerHTML = `
        <td>${
          item.consulting_date ? formatDateShort(item.consulting_date) : '미정'
        }</td>
        <td>${item.consulting_time || '미정'}</td>
        <td>
          <strong>${item.student_name}</strong>
          ${
            item.parent_phone
              ? `<small>${formatPhoneNumber(item.parent_phone)}</small>`
              : ''
          }
        </td>
        <td>${item.school}</td>
        <td>${item.grade}</td>
        <td>${item.test_type ? this.getTestTypeBadge(item.test_type) : '-'}</td>
        <td>${this.getConsultingStatus(item, isPast)}</td>
        <td>
          <div class="action-buttons">
            ${
              !isCompleted
                ? `
              <button class="btn btn-sm btn-primary" onclick="scheduleConsulting(${
                item.id
              })">
                일정변경
              </button>
              ${
                !isPast
                  ? `
                <button class="btn btn-sm btn-success" onclick="completeConsulting(${item.id})">
                  완료
                </button>
              `
                  : ''
              }
            `
                : ''
            }
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    if (consultings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center empty-state">
            컨설팅 예약 데이터가 없습니다.
          </td>
        </tr>
      `;
    }
  },

  getTestTypeBadge(type) {
    const badges = {
      HME: '<span class="badge badge-hme">HME</span>',
      MONO: '<span class="badge badge-mono">MONO</span>',
      TRI: '<span class="badge badge-tri">TRI</span>',
      MOCK: '<span class="badge badge-mock">모의고사</span>',
    };
    return badges[type] || '-';
  },

  getConsultingStatus(item, isPast) {
    if (item.consulting_completed) {
      return '<span class="badge badge-success">완료</span>';
    }
    if (isPast) {
      return '<span class="badge badge-danger">미진행</span>';
    }
    if (!item.consulting_date) {
      return '<span class="badge badge-warning">일정미정</span>';
    }
    return '<span class="badge badge-primary">예정</span>';
  },

  updateStats() {
    const data = window.filteredReservations || [];
    const today = new Date();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const consultings = data.filter((r) => r.post_checkin_choice === 'consult');

    const stats = {
      today: 0,
      week: 0,
      pending: 0,
      completed: 0,
      noSchedule: 0,
    };

    consultings.forEach((c) => {
      if (c.consulting_completed) {
        stats.completed++;
      } else if (!c.consulting_date) {
        stats.noSchedule++;
      } else {
        stats.pending++;

        const consultDate = new Date(c.consulting_date);
        if (consultDate.toDateString() === today.toDateString()) {
          stats.today++;
        }
        if (consultDate >= thisWeek) {
          stats.week++;
        }
      }
    });

    // UI 업데이트
    const elements = {
      today: document.getElementById('consulting-today'),
      week: document.getElementById('consulting-week'),
      pending: document.getElementById('consulting-pending'),
      completed: document.getElementById('consulting-completed'),
      noSchedule: document.getElementById('consulting-no-schedule'),
    };

    if (elements.today) elements.today.textContent = stats.today;
    if (elements.week) elements.week.textContent = stats.week;
    if (elements.pending) elements.pending.textContent = stats.pending;
    if (elements.completed) elements.completed.textContent = stats.completed;
    if (elements.noSchedule) elements.noSchedule.textContent = stats.noSchedule;

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

// ===== 액션 함수들 (예시) =====
function editReservation(id) {
  console.log('예약 수정:', id);
  showToast(`예약 ID ${id} 수정 기능 구현 예정`, 'info');
}

function checkInReservation(id) {
  console.log('체크인:', id);
  showToast(`예약 ID ${id} 체크인 처리`, 'success');
}

function markAsDownloaded(id) {
  console.log('다운로드 완료 처리:', id);
  showToast(`진단검사 ID ${id} 다운로드 완료`, 'success');
}

function scheduleConsulting(id) {
  console.log('컨설팅 일정 변경:', id);
  showToast(`컨설팅 ID ${id} 일정 변경`, 'info');
}

function completeConsulting(id) {
  console.log('컨설팅 완료:', id);
  showToast(`컨설팅 ID ${id} 완료 처리`, 'success');
}

function showToast(message, type = 'info') {
  // monitoring-v3.js의 showToast 함수 활용
  if (window.showToast) {
    window.showToast(message, type);
  }
}

// 전역 노출
window.DashboardModule = DashboardModule;
window.SeminarModule = SeminarModule;
window.CheckinModule = CheckinModule;
window.TestModule = TestModule;
window.ConsultingModule = ConsultingModule;
