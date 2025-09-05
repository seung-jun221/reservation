// monitoring-modules.js - 각 탭별 모듈 기능

// ===== 대시보드 모듈 =====
const DashboardModule = {
  chart: null,

  init() {
    this.updateStats();
    this.initChart();
    this.updateRecentActivity();
  },

  updateStats() {
    const stats = {
      totalReservations: GlobalState.filteredReservations.length,
      totalCheckins: GlobalState.filteredReservations.filter(
        (r) => r.attendance_checked_at
      ).length,
      totalTests: GlobalState.filteredTestApplications.length,
      totalConsulting: GlobalState.filteredConsultingReservations.length,
    };

    // UI 업데이트
    Object.keys(stats).forEach((key) => {
      const el = document.getElementById(key);
      if (el) el.textContent = stats[key];
    });
  },

  initChart() {
    const ctx = document.getElementById('funnelChart');
    if (!ctx) return;

    // 기존 차트 제거
    if (this.chart) {
      this.chart.destroy();
    }

    const reservations = GlobalState.filteredReservations.length;
    const checkins = GlobalState.filteredReservations.filter(
      (r) => r.attendance_checked_at
    ).length;
    const tests = GlobalState.filteredTestApplications.length;
    const consulting = GlobalState.filteredConsultingReservations.length;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['예약', '체크인', '진단검사', '컨설팅'],
        datasets: [
          {
            label: '전환 퍼널',
            data: [reservations, checkins, tests, consulting],
            backgroundColor: [
              'rgba(52, 152, 219, 0.8)',
              'rgba(46, 204, 113, 0.8)',
              'rgba(155, 89, 182, 0.8)',
              'rgba(241, 196, 15, 0.8)',
            ],
            borderColor: [
              'rgb(52, 152, 219)',
              'rgb(46, 204, 113)',
              'rgb(155, 89, 182)',
              'rgb(241, 196, 15)',
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
            display: false,
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                if (context.dataIndex > 0) {
                  const prev = context.dataset.data[context.dataIndex - 1];
                  const curr = context.parsed.y;
                  const rate = prev > 0 ? ((curr / prev) * 100).toFixed(1) : 0;
                  return `전환율: ${rate}%`;
                }
              },
            },
          },
        },
      },
    });
  },

  updateRecentActivity() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    const activities = [];

    // 최근 예약
    GlobalState.filteredReservations.slice(0, 5).forEach((r) => {
      activities.push({
        time: r.registered_at,
        type: '예약',
        content: `${r.student_name}님 예약`,
      });
    });

    // 최근 체크인
    GlobalState.filteredReservations
      .filter((r) => r.attendance_checked_at)
      .slice(0, 5)
      .forEach((r) => {
        activities.push({
          time: r.attendance_checked_at,
          type: '체크인',
          content: `${r.student_name}님 체크인`,
        });
      });

    // 시간순 정렬
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // HTML 생성
    container.innerHTML = activities
      .slice(0, 10)
      .map(
        (a) => `
            <div class="activity-item">
                <span class="activity-time">${Utils.formatDate(a.time)}</span>
                <span class="activity-type">${a.type}</span>
                <span class="activity-content">${a.content}</span>
            </div>
        `
      )
      .join('');
  },
};

// ===== 설명회 예약 모듈 =====
const ReservationsModule = {
  init() {
    this.renderTable();
    this.setupFilters();
  },

  renderTable() {
    const tbody = document.getElementById('reservationsTableBody');
    if (!tbody) return;

    const data = GlobalState.filteredReservations;

    tbody.innerHTML = data
      .map(
        (r, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${r.seminar_name}</td>
                <td>${r.student_name}</td>
                <td>${Utils.formatPhone(r.parent_phone)}</td>
                <td>${r.school}</td>
                <td>${r.grade}</td>
                <td><span class="status-${r.status}">${r.status}</span></td>
                <td>${r.attendance_checked_at ? '✅' : '-'}</td>
                <td>${Utils.formatDate(r.registered_at)}</td>
                <td>
                    <button onclick="ReservationsModule.checkIn('${
                      r.id
                    }')">체크인</button>
                </td>
            </tr>
        `
      )
      .join('');
  },

  setupFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.applyFilters());
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyFilters());
    }
  },

  applyFilters() {
    const status = document.getElementById('statusFilter')?.value;
    const search = document.getElementById('searchInput')?.value.toLowerCase();

    let filtered = [...GlobalState.allReservations];

    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(search) ||
          r.parent_phone?.includes(search) ||
          r.school?.toLowerCase().includes(search)
      );
    }

    GlobalState.filteredReservations = filtered;
    this.renderTable();
  },

  async checkIn(id) {
    const { error } = await supabase
      .from('reservations')
      .update({
        attendance_checked_at: new Date().toISOString(),
        status: '참석',
      })
      .eq('id', id);

    if (error) {
      Utils.showToast('체크인 실패', 'error');
    } else {
      Utils.showToast('체크인 완료', 'success');
      await DataLoader.loadAllData();
      this.renderTable();
    }
  },
};

// ===== 체크인 분석 모듈 =====
const CheckinModule = {
  init() {
    this.updateStats();
    this.renderTable();
  },

  updateStats() {
    const checkedIn = GlobalState.filteredReservations.filter(
      (r) => r.attendance_checked_at
    );
    const testSelected = checkedIn.filter(
      (r) => r.post_checkin_choice === 'test'
    );
    const consultSelected = checkedIn.filter(
      (r) => r.post_checkin_choice === 'consult'
    );

    const total = checkedIn.length;
    const testCount = testSelected.length;
    const consultCount = consultSelected.length;

    // UI 업데이트
    document.getElementById('checkinTotal').textContent = total;
    document.getElementById('checkinTest').textContent = testCount;
    document.getElementById('checkinTestPercent').textContent =
      total > 0 ? `${((testCount / total) * 100).toFixed(1)}%` : '0%';
    document.getElementById('checkinConsult').textContent = consultCount;
    document.getElementById('checkinConsultPercent').textContent =
      total > 0 ? `${((consultCount / total) * 100).toFixed(1)}%` : '0%';
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    const checkedIn = GlobalState.filteredReservations
      .filter((r) => r.attendance_checked_at)
      .sort(
        (a, b) =>
          new Date(b.attendance_checked_at) - new Date(a.attendance_checked_at)
      );

    tbody.innerHTML = checkedIn
      .map(
        (r) => `
            <tr>
                <td>${Utils.formatDate(r.attendance_checked_at)}</td>
                <td>${r.student_name}</td>
                <td>${r.seminar_name}</td>
                <td>${r.checkin_type || '오프라인'}</td>
                <td>${this.formatChoice(r.post_checkin_choice)}</td>
            </tr>
        `
      )
      .join('');
  },

  formatChoice(choice) {
    const choices = {
      test: '📝 진단검사',
      consult: '💼 컨설팅',
      both: '📝 진단검사 + 💼 컨설팅',
    };
    return choices[choice] || '-';
  },
};

// ===== 진단검사 모듈 =====
const TestModule = {
  init() {
    this.updateStats();
    this.renderTable();
    this.setupFilters();
  },

  updateStats() {
    const total = GlobalState.filteredTestApplications.length;
    const downloaded = GlobalState.filteredTestApplications.filter(
      (t) => t.downloaded_at
    ).length;
    const converted = GlobalState.filteredTestApplications.filter((t) => {
      return GlobalState.filteredConsultingReservations.some(
        (c) => c.parent_phone === t.parent_phone
      );
    }).length;

    document.getElementById('testTotal').textContent = total;
    document.getElementById('testDownloaded').textContent = downloaded;
    document.getElementById('testDownloadPercent').textContent =
      total > 0 ? `${((downloaded / total) * 100).toFixed(1)}%` : '0%';
    document.getElementById('testConverted').textContent = converted;
    document.getElementById('testConvertPercent').textContent =
      total > 0 ? `${((converted / total) * 100).toFixed(1)}%` : '0%';
  },

  renderTable() {
    const tbody = document.getElementById('testTableBody');
    if (!tbody) return;

    const data = GlobalState.filteredTestApplications;

    tbody.innerHTML = data
      .map((t, i) => {
        // 설명회 정보 찾기
        const reservation = GlobalState.filteredReservations.find(
          (r) => r.parent_phone === t.parent_phone
        );
        const hasConsulting = GlobalState.filteredConsultingReservations.some(
          (c) => c.parent_phone === t.parent_phone
        );

        return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${reservation?.seminar_name || '-'}</td>
                    <td>${t.student_name}</td>
                    <td>${t.school}</td>
                    <td>${t.grade}</td>
                    <td>${t.test_type}</td>
                    <td>${t.downloaded_at ? '✅' : '❌'}</td>
                    <td>${hasConsulting ? '✅' : '-'}</td>
                    <td>${Utils.formatDate(t.created_at)}</td>
                </tr>
            `;
      })
      .join('');
  },

  setupFilters() {
    const typeFilter = document.getElementById('testTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => this.applyFilters());
    }
  },

  applyFilters() {
    const type = document.getElementById('testTypeFilter')?.value;

    let filtered = [...GlobalState.allTestApplications];

    if (type) {
      filtered = filtered.filter((t) => t.test_type === type);
    }

    GlobalState.filteredTestApplications = filtered;
    this.renderTable();
  },
};

// ===== 컨설팅 모듈 =====
const ConsultingModule = {
  currentView: 'calendar',

  init() {
    this.updateStats();
    this.render();
  },

  updateStats() {
    const today = new Date();
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() + 7);

    const consultings = GlobalState.filteredConsultingReservations;

    const weekCount = consultings.filter((c) => {
      const date = new Date(c.consulting_slots?.date);
      return date >= today && date <= thisWeek;
    }).length;

    const todayCount = consultings.filter((c) => {
      const date = new Date(c.consulting_slots?.date);
      return date.toDateString() === today.toDateString();
    }).length;

    const completedCount = consultings.filter(
      (c) => c.status === 'completed'
    ).length;

    document.getElementById('consultingWeek').textContent = weekCount;
    document.getElementById('consultingToday').textContent = todayCount;
    document.getElementById('consultingCompleted').textContent = completedCount;
  },

  render() {
    if (this.currentView === 'calendar') {
      this.renderCalendar();
    } else {
      this.renderList();
    }
  },

  switchView(view) {
    this.currentView = view;

    // 버튼 상태 변경
    document.querySelectorAll('.view-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // 뷰 전환
    document.getElementById('consultingCalendar').style.display =
      view === 'calendar' ? 'block' : 'none';
    document.getElementById('consultingList').style.display =
      view === 'list' ? 'block' : 'none';

    this.render();
  },

  renderCalendar() {
    const container = document.getElementById('consultingCalendar');
    if (!container) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // 간단한 캘린더 생성
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    let html = '<div class="calendar-grid">';

    // 요일 헤더
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach((day) => {
      html += `<div class="calendar-header">${day}</div>`;
    });

    // 빈 날짜
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    // 날짜
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;

      const consultings = GlobalState.filteredConsultingReservations.filter(
        (c) => {
          const cDate = c.consulting_slots?.date;
          return cDate && cDate.startsWith(dateStr);
        }
      );

      const isToday = date.toDateString() === today.toDateString();

      html += `
                <div class="calendar-day ${isToday ? 'today' : ''}">
                    <div class="day-number">${day}</div>
                    ${
                      consultings.length > 0
                        ? `
                        <div class="day-consultings">${consultings.length}건</div>
                    `
                        : ''
                    }
                </div>
            `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  renderList() {
    const tbody = document.getElementById('consultingTableBody');
    if (!tbody) return;

    const data = GlobalState.filteredConsultingReservations;

    tbody.innerHTML = data
      .map((c) => {
        const slot = c.consulting_slots;
        return `
                <tr>
                    <td>${slot?.date || '-'}</td>
                    <td>${slot?.time || '-'}</td>
                    <td>${c.student_name}</td>
                    <td>${c.school}</td>
                    <td>${c.grade}</td>
                    <td>${c.test_type || '-'}</td>
                    <td><span class="status-${c.status}">${c.status}</span></td>
                    <td>
                        <button onclick="ConsultingModule.complete('${
                          c.id
                        }')">완료</button>
                    </td>
                </tr>
            `;
      })
      .join('');
  },

  async complete(id) {
    const { error } = await supabase
      .from('consulting_reservations')
      .update({ status: 'completed' })
      .eq('id', id);

    if (error) {
      Utils.showToast('상태 변경 실패', 'error');
    } else {
      Utils.showToast('컨설팅 완료 처리', 'success');
      await DataLoader.loadAllData();
      this.render();
    }
  },
};

// 전역 노출
window.DashboardModule = DashboardModule;
window.ReservationsModule = ReservationsModule;
window.CheckinModule = CheckinModule;
window.TestModule = TestModule;
window.ConsultingModule = ConsultingModule;
