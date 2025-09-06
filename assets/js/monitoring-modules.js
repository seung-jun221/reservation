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
// ===== 체크인 분석 모듈 =====
// ===== 체크인 분석 모듈 =====
const CheckinModule = {
  sortOrder: { column: 'time', direction: 'desc' },
  currentFilter: 'all',
  contactedList: new Set(), // 연락 완료 목록

  init() {
    this.updateStats();
    this.renderTable();
    this.setupControls();
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
    const totalEl = document.getElementById('checkinTotal');
    const testEl = document.getElementById('checkinTest');
    const testPercentEl = document.getElementById('checkinTestPercent');
    const consultEl = document.getElementById('checkinConsult');
    const consultPercentEl = document.getElementById('checkinConsultPercent');

    if (totalEl) totalEl.textContent = total;
    if (testEl) testEl.textContent = testCount;
    if (testPercentEl) {
      testPercentEl.textContent =
        total > 0 ? `${((testCount / total) * 100).toFixed(1)}%` : '0%';
    }
    if (consultEl) consultEl.textContent = consultCount;
    if (consultPercentEl) {
      consultPercentEl.textContent =
        total > 0 ? `${((consultCount / total) * 100).toFixed(1)}%` : '0%';
    }
  },

  setupControls() {
    // 기존 필터가 있으면 제거
    const existingFilters = document.querySelector('.checkin-filters');
    if (existingFilters) {
      existingFilters.remove();
    }

    // 필터 버튼 HTML 추가
    const filterHTML = `
      <div class="checkin-filters" style="margin-bottom: 20px;">
        <button onclick="CheckinModule.filterBy('all')" class="filter-btn active">전체</button>
        <button onclick="CheckinModule.filterBy('test')" class="filter-btn">진단검사</button>
        <button onclick="CheckinModule.filterBy('consult')" class="filter-btn">상담희망</button>
        <button onclick="CheckinModule.filterBy('none')" class="filter-btn">미선택</button>
      </div>
    `;

    const tableContainer = document.querySelector(
      '#checkin-tab .table-container'
    );
    if (tableContainer) {
      tableContainer.insertAdjacentHTML('beforebegin', filterHTML);
    }
  },

  filterBy(type) {
    this.currentFilter = type;

    // 버튼 활성화 상태 변경
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');

    this.renderTable();
  },

  renderTable() {
    const tbody = document.getElementById('checkinTableBody');
    if (!tbody) return;

    // 테이블 헤더 업데이트
    const table = tbody.closest('table');
    if (table) {
      let thead = table.querySelector('thead');
      if (!thead) {
        thead = document.createElement('thead');
        table.insertBefore(thead, tbody);
      }

      // 헤더 내용을 매번 새로 설정
      thead.innerHTML = `
        <tr>
          <th onclick="CheckinModule.sortBy('time')" style="cursor: pointer;">
            체크인 시간 ${
              this.sortOrder.column === 'time'
                ? this.sortOrder.direction === 'asc'
                  ? '▲'
                  : '▼'
                : ''
            }
          </th>
          <th onclick="CheckinModule.sortBy('name')" style="cursor: pointer;">
            학생명 ${
              this.sortOrder.column === 'name'
                ? this.sortOrder.direction === 'asc'
                  ? '▲'
                  : '▼'
                : ''
            }
          </th>
          <th>설명회</th>
          <th>체크인 유형</th>
          <th onclick="CheckinModule.sortBy('choice')" style="cursor: pointer;">
            선택 항목 ${
              this.sortOrder.column === 'choice'
                ? this.sortOrder.direction === 'asc'
                  ? '▲'
                  : '▼'
                : ''
            }
          </th>
          <th>연락처</th>
          <th>상태</th>
        </tr>
      `;
    }

    let checkedIn = GlobalState.filteredReservations.filter(
      (r) => r.attendance_checked_at
    );

    // 필터 적용
    if (this.currentFilter !== 'all') {
      checkedIn = checkedIn.filter((r) => {
        if (this.currentFilter === 'none') {
          return !r.post_checkin_choice;
        }
        return r.post_checkin_choice === this.currentFilter;
      });
    }

    // 정렬 적용 - 기본값을 최신순으로
    checkedIn.sort((a, b) => {
      let compareValue = 0;

      switch (this.sortOrder.column) {
        case 'time':
          compareValue =
            new Date(b.attendance_checked_at) -
            new Date(a.attendance_checked_at);
          break;
        case 'name':
          compareValue = a.student_name.localeCompare(b.student_name);
          break;
        case 'choice':
          compareValue = (a.post_checkin_choice || 'z').localeCompare(
            b.post_checkin_choice || 'z'
          );
          break;
      }

      return this.sortOrder.direction === 'asc' ? -compareValue : compareValue;
    });

    // 테이블 바디 렌더링
    tbody.innerHTML = checkedIn
      .map((r) => {
        // 진단검사 신청 여부 확인
        const hasTest = GlobalState.filteredTestApplications.some(
          (t) => t.parent_phone === r.parent_phone
        );

        // 컨설팅 예약 여부 확인
        const hasConsulting = GlobalState.filteredConsultingReservations.some(
          (c) => c.parent_phone === r.parent_phone
        );

        // 연락 완료 여부
        const isContacted =
          r.contact_status === 'contacted' || this.contactedList.has(r.id);

        // 상태 결정
        let statusHTML = '-';

        // 1. 상담희망(컨설팅) 선택자
        if (r.post_checkin_choice === 'consult') {
          if (isContacted) {
            statusHTML = '<span style="color: green;">✓ 연락완료</span>';
          } else {
            statusHTML = `<button onclick="CheckinModule.markContacted('${r.id}')" style="background: #1a73e8; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">연락하기</button>`;
          }
        }
        // 2. 진단검사 선택자의 컨설팅 예약 상태
        else if (r.post_checkin_choice === 'test' || hasTest) {
          if (hasConsulting) {
            statusHTML = '<span style="color: #34a853;">✓ 예약완료</span>';
          } else {
            statusHTML =
              '<span style="color: #ff6b00; font-weight: 600; background: #fff3e0; padding: 2px 8px; border-radius: 4px;">예약필요</span>';
          }
        }

        return `
          <tr>
            <td>${Utils.formatDate(r.attendance_checked_at)}</td>
            <td>${r.student_name}</td>
            <td>${r.seminar_name}</td>
            <td>${r.checkin_type || 'offline'}</td>
            <td>${this.formatChoice(r.post_checkin_choice)}</td>
            <td>${Utils.formatPhone(r.parent_phone)}</td>
            <td>${statusHTML}</td>
          </tr>
        `;
      })
      .join('');
  },

  sortBy(column) {
    if (this.sortOrder.column === column) {
      this.sortOrder.direction =
        this.sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOrder.column = column;
      this.sortOrder.direction = 'asc';
    }
    this.renderTable();
  },

  formatChoice(choice) {
    const choices = {
      test: '진단검사',
      consult: '상담희망', // 용어 변경
      both: '진단검사+상담',
    };
    return choices[choice] || '미선택';
  },

  async markContacted(id) {
    // Supabase에 연락 완료 상태 저장
    const { error } = await supabase
      .from('reservations')
      .update({
        contact_status: 'contacted',
        contacted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('연락 상태 저장 실패:', error);
      Utils.showToast('연락 상태 저장 실패', 'error');
      return;
    }

    // 메모리에도 추가 (즉시 UI 업데이트용)
    this.contactedList.add(id);

    // 테이블 다시 렌더링
    this.renderTable();

    // 성공 메시지
    Utils.showToast('연락 완료 처리됨', 'success');
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
    // 중복 제거를 위해 전화번호 기준으로 유니크 카운트
    const uniqueApplicants = new Set(
      GlobalState.filteredTestApplications.map((t) => t.parent_phone)
    );
    const total = uniqueApplicants.size;

    // 다운로드 완료한 유니크 사용자
    const downloadedUsers = new Set(
      GlobalState.filteredTestApplications
        .filter((t) => t.downloaded_at)
        .map((t) => t.parent_phone)
    );
    const downloaded = downloadedUsers.size;

    // 컨설팅 전환한 유니크 사용자
    const converted = GlobalState.filteredTestApplications.filter((t) => {
      return GlobalState.filteredConsultingReservations.some(
        (c) => c.parent_phone === t.parent_phone
      );
    });
    const uniqueConverted = new Set(converted.map((t) => t.parent_phone)).size;

    document.getElementById('testTotal').textContent = total;
    document.getElementById('testDownloaded').textContent = downloaded;
    document.getElementById('testDownloadPercent').textContent =
      total > 0 ? `${((downloaded / total) * 100).toFixed(1)}%` : '0%';
    document.getElementById('testConverted').textContent = uniqueConverted;
    document.getElementById('testConvertPercent').textContent =
      total > 0 ? `${((uniqueConverted / total) * 100).toFixed(1)}%` : '0%';
  },

  renderTable() {
    const tbody = document.getElementById('testTableBody');
    if (!tbody) return;

    // 학생별로 그룹화
    const groupedData = {};

    GlobalState.filteredTestApplications.forEach((t) => {
      const key = t.parent_phone;

      if (!groupedData[key]) {
        groupedData[key] = {
          student_name: t.student_name,
          parent_phone: t.parent_phone,
          school: t.school,
          grade: t.grade,
          seminar_id: t.seminar_id,
          test_types: [],
          download_count: 0,
          last_downloaded: null,
        };
      }

      // 시험 타입 추가 (중복 제거)
      if (t.test_type && !groupedData[key].test_types.includes(t.test_type)) {
        groupedData[key].test_types.push(t.test_type);
      }

      // 다운로드 정보 업데이트
      if (t.downloaded_at) {
        groupedData[key].download_count++;
        if (
          !groupedData[key].last_downloaded ||
          new Date(t.downloaded_at) > new Date(groupedData[key].last_downloaded)
        ) {
          groupedData[key].last_downloaded = t.downloaded_at;
        }
      }
    });

    // 테이블 렌더링
    tbody.innerHTML = Object.values(groupedData)
      .map((t, i) => {
        // 설명회 정보 찾기
        const seminarInfo = GlobalState.allSeminars.find(
          (s) => s.id === t.seminar_id
        );
        const seminarName = seminarInfo ? seminarInfo.title : '-';

        // 컨설팅 예약 확인
        const hasConsulting = GlobalState.filteredConsultingReservations.some(
          (c) => c.parent_phone === t.parent_phone
        );

        return `
          <tr>
            <td>${i + 1}</td>
            <td>${seminarName}</td>
            <td>${t.student_name}</td>
            <td>${t.school}</td>
            <td>${t.grade}</td>
            <td>${t.test_types.join(', ') || '-'}</td>
            <td>${
              t.download_count > 0 ? `✅ (${t.download_count}개)` : '❌'
            }</td>
            <td>${hasConsulting ? '✅' : '-'}</td>
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
// monitoring-modules.js의 ConsultingModule 수정

// monitoring-modules.js의 ConsultingModule 전체 코드

// monitoring-modules.js의 ConsultingModule - 동적 날짜 로드 버전

// monitoring-modules.js의 ConsultingModule - 완성 버전

const ConsultingModule = {
  currentDate: new Date(),
  currentReservationId: null,
  consultingDates: [], // 동적으로 로드
  timeSlots: [
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
  ],

  // 날짜를 로컬 타임존으로 처리하는 헬퍼 함수
  getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 초기화
  async init() {
    await this.loadAvailableDates(); // 먼저 가능한 날짜들 로드
    this.setupQuickDateSelector();
    this.selectNearestFutureDate();
    this.loadDaySchedule();
    this.updateStats();
    this.setupKeyboardShortcuts();
  },

  // consulting_slots에서 유니크한 날짜들 가져오기
  async loadAvailableDates() {
    try {
      const today = this.getLocalDateString(new Date());

      const { data: slots, error } = await supabase
        .from('consulting_slots')
        .select('date, day_of_week')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;

      // 유니크한 날짜만 추출
      const uniqueDates = {};
      slots.forEach((slot) => {
        if (!uniqueDates[slot.date]) {
          uniqueDates[slot.date] = slot;
        }
      });

      // consultingDates 배열 생성 - 타임존 이슈 해결
      this.consultingDates = Object.values(uniqueDates)
        .map((slot) => {
          // 날짜 문자열을 직접 파싱
          const [year, month, day] = slot.date.split('-');
          const date = new Date(year, month - 1, day); // month는 0부터 시작

          const dayName = this.getDayName(slot.day_of_week);

          return {
            date: slot.date,
            day: slot.day_of_week,
            label: `${parseInt(month)}/${parseInt(day)}(${dayName})`,
          };
        })
        .slice(0, 10);

      console.log('동적 로드된 컨설팅 날짜:', this.consultingDates);

      if (this.consultingDates.length === 0) {
        this.setDefaultDates();
      }
    } catch (error) {
      console.error('컨설팅 날짜 로드 실패:', error);
      this.setDefaultDates();
    }
  },

  // 요일 한글 변환
  getDayName(dayOfWeek) {
    const days = {
      MON: '월',
      TUE: '화',
      WED: '수',
      THU: '목',
      FRI: '금',
      SAT: '토',
      SUN: '일',
      Monday: '월',
      Tuesday: '화',
      Wednesday: '수',
      Thursday: '목',
      Friday: '금',
      Saturday: '토',
      Sunday: '일',
    };
    return days[dayOfWeek] || dayOfWeek.substring(0, 1);
  },

  // 폴백용 기본 날짜 (화/목 기준)
  setDefaultDates() {
    const today = new Date();
    this.consultingDates = [];

    // 앞으로 2주간 화/목만 생성
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();

      // 화요일(2) 또는 목요일(4)
      if (dayOfWeek === 2 || dayOfWeek === 4) {
        const dateStr = this.getLocalDateString(date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayName = dayOfWeek === 2 ? '화' : '목';

        this.consultingDates.push({
          date: dateStr,
          day: dayName,
          label: `${month}/${day}(${dayName})`,
        });
      }
    }

    this.consultingDates = this.consultingDates.slice(0, 6);
  },

  // 퀵 날짜 선택기 설정
  setupQuickDateSelector() {
    const container = document.getElementById('quickDateSelector');
    if (!container) return;

    let html = '';
    const today = this.getLocalDateString(new Date());
    const currentDateStr = this.getLocalDateString(this.currentDate);

    this.consultingDates.forEach((dateInfo) => {
      const isPast = dateInfo.date < today;
      const isSelected = dateInfo.date === currentDateStr;

      html += `
        <button 
          class="quick-date-btn ${isSelected ? 'active' : ''} ${
        isPast ? 'past' : ''
      }"
          onclick="ConsultingModule.goToDate('${dateInfo.date}')"
          ${isPast ? 'disabled' : ''}
        >
          ${dateInfo.label}
        </button>
      `;
    });

    if (this.consultingDates.length === 0) {
      html =
        '<div class="no-dates-message">예정된 컨설팅 날짜가 없습니다.</div>';
    }

    container.innerHTML = html;
  },

  // 가장 가까운 미래 날짜 선택
  selectNearestFutureDate() {
    const today = this.getLocalDateString(new Date());
    const futureDate = this.consultingDates.find((d) => d.date >= today);

    if (futureDate) {
      const [year, month, day] = futureDate.date.split('-');
      this.currentDate = new Date(year, month - 1, day);
    } else if (this.consultingDates.length > 0) {
      const [year, month, day] = this.consultingDates[0].date.split('-');
      this.currentDate = new Date(year, month - 1, day);
    }
  },

  // 일별 스케줄 로드 (JOIN 사용)
  // 일별 스케줄 로드 (JOIN 개선)
  // loadDaySchedule 메서드 수정 - JOIN 제거, 단순 쿼리로 변경

  async loadDaySchedule() {
    const dateStr = this.getLocalDateString(this.currentDate);
    this.updateDateHeader();

    console.log('Loading schedule for:', dateStr);

    try {
      // 1. 해당 날짜의 슬롯 조회
      const { data: slots, error: slotsError } = await supabase
        .from('consulting_slots')
        .select('*')
        .eq('date', dateStr)
        .order('time');

      if (slotsError) throw slotsError;

      // 2. 예약 정보 조회
      let consultingData = [];
      if (slots && slots.length > 0) {
        const slotIds = slots.map((s) => s.id);

        const { data: reservations, error: resError } = await supabase
          .from('consulting_reservations')
          .select('*')
          .in('slot_id', slotIds);

        if (resError) throw resError;

        // 3. 각 예약에 대해 math_level 정보를 두 테이블에서 조회
        for (let reservation of reservations || []) {
          let mathLevel = null;

          // 방법 1: reservations 테이블에서 조회 (QR 체크인)
          const { data: reservationInfo } = await supabase
            .from('reservations')
            .select('math_level')
            .eq('parent_phone', reservation.parent_phone)
            .order('registered_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (reservationInfo && reservationInfo.math_level) {
            mathLevel = reservationInfo.math_level;
            console.log(
              `Found math_level in reservations for ${reservation.student_name}: ${mathLevel}`
            );
          }

          // 방법 2: test_applications 테이블에서 조회 (URL 직접 접속)
          if (!mathLevel) {
            const { data: testAppInfo } = await supabase
              .from('test_applications')
              .select('math_level')
              .eq('parent_phone', reservation.parent_phone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (testAppInfo && testAppInfo.math_level) {
              mathLevel = testAppInfo.math_level;
              console.log(
                `Found math_level in test_applications for ${reservation.student_name}: ${mathLevel}`
              );
            }
          }

          // 방법 3: 전화번호 정규화해서 다시 시도
          if (!mathLevel) {
            const normalizedPhone = reservation.parent_phone.replace(
              /[^0-9]/g,
              ''
            );

            // reservations 테이블 재시도
            const { data: retryReservation } = await supabase
              .from('reservations')
              .select('math_level')
              .or(
                `parent_phone.eq.${normalizedPhone},parent_phone.eq.010-${normalizedPhone.slice(
                  3,
                  7
                )}-${normalizedPhone.slice(7)}`
              )
              .order('registered_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (retryReservation && retryReservation.math_level) {
              mathLevel = retryReservation.math_level;
              console.log(
                `Found math_level on retry (reservations) for ${reservation.student_name}: ${mathLevel}`
              );
            }

            // test_applications 테이블 재시도
            if (!mathLevel) {
              const { data: retryTestApp } = await supabase
                .from('test_applications')
                .select('math_level')
                .or(
                  `parent_phone.eq.${normalizedPhone},parent_phone.eq.010-${normalizedPhone.slice(
                    3,
                    7
                  )}-${normalizedPhone.slice(7)}`
                )
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (retryTestApp && retryTestApp.math_level) {
                mathLevel = retryTestApp.math_level;
                console.log(
                  `Found math_level on retry (test_applications) for ${reservation.student_name}: ${mathLevel}`
                );
              }
            }
          }

          // 최종 결과 설정
          reservation.math_level = mathLevel || '확인필요';

          if (!mathLevel) {
            console.log(
              `❌ No math_level found anywhere for ${reservation.student_name}`
            );
          }

          consultingData.push(reservation);
        }
      }

      // 4. 렌더링
      this.renderTimeSlots(slots || [], consultingData);
    } catch (error) {
      console.error('일정 로드 실패:', error);
      Utils.showToast('일정 로드 실패', 'error');
    }
  },

  // 날짜 헤더 업데이트
  updateDateHeader() {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const scheduleDate = document.getElementById('scheduleDate');

    if (scheduleDate) {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const date = this.currentDate.getDate();
      const dayName = days[this.currentDate.getDay()];
      scheduleDate.textContent = `${year}년 ${month}월 ${date}일 ${dayName}요일`;
    }
  },

  // 시간대별 슬롯 렌더링
  renderTimeSlots(slots, reservations) {
    const container = document.getElementById('timeScheduleContainer');
    if (!container) return;

    let html = '';

    this.timeSlots.forEach((time) => {
      const slot = slots.find((s) => s.time && s.time.startsWith(time));
      const reservation = slot
        ? reservations.find(
            (r) => r.slot_id === slot.id && r.status !== 'cancelled'
          )
        : null;

      const slotClass = reservation ? 'reserved' : 'empty';

      html += `
        <div class="time-slot ${slotClass}" data-time="${time}">
          <div class="time-label">${time}</div>
          <div class="slot-content">
            ${
              reservation
                ? this.renderReservation(reservation)
                : this.renderEmptySlot(time)
            }
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.attachEventListeners();
  },

  // 예약 정보 렌더링 (개선된 버전)
  renderReservation(reservation) {
    const mathLevel = reservation.math_level || '확인필요';
    const statusClass = `status-${reservation.enrollment_status || 'pending'}`;

    return `
    <div class="reservation-card" data-id="${reservation.id}">
      <div class="info-section">
        <span class="student-name">${reservation.student_name}</span>
        <span class="divider">·</span>
        <span class="grade">${reservation.grade}</span>
        <span class="divider">·</span>
        <span class="school">${reservation.school}</span>
        <span class="divider">·</span>
        <span class="math-level">${mathLevel}</span>
        <span class="divider">·</span>
        <span class="phone">${this.formatPhone(reservation.parent_phone)}</span>
      </div>
      <div class="action-section">
        <span class="test-badge">${reservation.test_type || 'UNKNOWN'}</span>
        <select class="status-select ${statusClass}" data-id="${
      reservation.id
    }">
          <option value="pending" ${
            reservation.enrollment_status === 'pending' ? 'selected' : ''
          }>대기</option>
          <option value="confirmed" ${
            reservation.enrollment_status === 'confirmed' ? 'selected' : ''
          }>등록확정</option>
          <option value="impossible" ${
            reservation.enrollment_status === 'impossible' ? 'selected' : ''
          }>등록불가</option>
          <option value="reconsult" ${
            reservation.enrollment_status === 'reconsult' ? 'selected' : ''
          }>재상담</option>
          <option value="hold" ${
            reservation.enrollment_status === 'hold' ? 'selected' : ''
          }>보류</option>
          <option value="noshow" ${
            reservation.enrollment_status === 'noshow' ? 'selected' : ''
          }>노쇼</option>
        </select>
        <button class="memo-btn" onclick="ConsultingModule.openMemo('${
          reservation.id
        }')">
          ${reservation.consultation_memo ? '📝' : '📄'}
        </button>
      </div>
    </div>
  `;
  },

  // 빈 슬롯 렌더링
  renderEmptySlot(time) {
    return `<div class="empty-slot">예약 가능</div>`;
  },

  // 전화번호 포맷
  formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.substr(0, 3)}-${cleaned.substr(3, 4)}-${cleaned.substr(
        7,
        4
      )}`;
    }
    return phone;
  },

  // 등록 상태 업데이트
  async updateEnrollmentStatus(reservationId, newStatus) {
    try {
      const { error } = await supabase
        .from('consulting_reservations')
        .update({
          enrollment_status: newStatus,
          consulted_at: new Date().toISOString(),
          consulted_by: '관리자',
        })
        .eq('id', reservationId);

      if (error) throw error;

      Utils.showToast('상태가 업데이트되었습니다', 'success');
      this.loadDaySchedule();
      this.updateStats();
    } catch (error) {
      console.error('상태 업데이트 실패:', error);
      Utils.showToast('상태 업데이트 실패', 'error');
    }
  },

  // 메모 패널 열기
  async openMemo(reservationId) {
    this.currentReservationId = reservationId;

    try {
      const { data: reservation, error } = await supabase
        .from('consulting_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error) throw error;

      document.getElementById('memoStudentName').textContent =
        reservation.student_name;
      document.getElementById(
        'memoStudentGrade'
      ).textContent = `${reservation.grade} / ${reservation.school}`;

      document.getElementById('studentType').value =
        reservation.student_type || '';
      document.getElementById('memoEnrollmentStatus').value =
        reservation.enrollment_status || 'pending';
      document.getElementById('consultationMemo').value =
        reservation.consultation_memo || '';
      document.getElementById('consultedBy').value =
        reservation.consulted_by || '';

      const panel = document.getElementById('memoPanel');
      panel.classList.remove('hidden');
      panel.classList.add('active');

      setTimeout(() => {
        document.getElementById('consultationMemo').focus();
      }, 300);
    } catch (error) {
      console.error('메모 로드 실패:', error);
      Utils.showToast('메모 로드 실패', 'error');
    }
  },

  // 메모 패널 닫기
  closeMemo() {
    const panel = document.getElementById('memoPanel');
    panel.classList.remove('active');
    setTimeout(() => {
      panel.classList.add('hidden');
    }, 300);
    this.currentReservationId = null;
  },

  // 메모 저장
  async saveMemo() {
    if (!this.currentReservationId) return;

    const updateData = {
      student_type: document.getElementById('studentType').value,
      enrollment_status: document.getElementById('memoEnrollmentStatus').value,
      consultation_memo: document.getElementById('consultationMemo').value,
      consulted_by: document.getElementById('consultedBy').value,
      consulted_at: new Date().toISOString(),
    };

    Utils.showLoading(true);

    try {
      const { error } = await supabase
        .from('consulting_reservations')
        .update(updateData)
        .eq('id', this.currentReservationId);

      if (error) throw error;

      Utils.showToast('메모가 저장되었습니다', 'success');
      this.closeMemo();
      this.loadDaySchedule();
      this.updateStats();
    } catch (error) {
      console.error('메모 저장 실패:', error);
      Utils.showToast('메모 저장 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  // 통계 업데이트
  async updateStats() {
    const today = this.getLocalDateString(new Date());

    try {
      const { data: todaySlots } = await supabase
        .from('consulting_slots')
        .select('id')
        .eq('date', today);

      if (todaySlots && todaySlots.length > 0) {
        const slotIds = todaySlots.map((s) => s.id);

        const { data: todayReservations } = await supabase
          .from('consulting_reservations')
          .select('*')
          .in('slot_id', slotIds)
          .neq('status', 'cancelled');

        if (todayReservations) {
          const stats = {
            today: todayReservations.length,
            confirmed: todayReservations.filter(
              (r) => r.enrollment_status === 'confirmed'
            ).length,
            reconsult: todayReservations.filter(
              (r) => r.enrollment_status === 'reconsult'
            ).length,
            noshow: todayReservations.filter(
              (r) => r.enrollment_status === 'noshow'
            ).length,
          };

          document.getElementById('consultingToday').textContent = stats.today;
          document.getElementById('consultingConfirmed').textContent =
            stats.confirmed;
          document.getElementById('consultingReconsult').textContent =
            stats.reconsult;
          document.getElementById('consultingNoshow').textContent =
            stats.noshow;
        }
      }
    } catch (error) {
      console.error('통계 업데이트 실패:', error);
    }
  },

  // 엑셀 다운로드
  async exportToExcel() {
    const dateStr = this.getLocalDateString(this.currentDate);

    try {
      const { data: slots } = await supabase
        .from('consulting_slots')
        .select('*')
        .eq('date', dateStr)
        .order('time');

      const slotIds = slots.map((s) => s.id);
      const { data: reservations } = await supabase
        .from('consulting_reservations')
        .select('*')
        .in('slot_id', slotIds);

      let csv = '\uFEFF';
      csv +=
        '시간,학생명,학교,학년,연락처,수학진도,진단검사,등록상태,학생유형,상담메모,상담자\n';

      for (let reservation of reservations || []) {
        const { data: studentInfo } = await supabase
          .from('reservations')
          .select('math_level')
          .eq('parent_phone', reservation.parent_phone)
          .limit(1)
          .single();

        const slot = slots.find((s) => s.id === reservation.slot_id);
        const time = slot ? slot.time.substr(0, 5) : '-';

        csv += `"${time}",`;
        csv += `"${reservation.student_name}",`;
        csv += `"${reservation.school}",`;
        csv += `"${reservation.grade}",`;
        csv += `"${reservation.parent_phone}",`;
        csv += `"${studentInfo?.math_level || '-'}",`;
        csv += `"${reservation.test_type || '-'}",`;
        csv += `"${this.getStatusText(reservation.enrollment_status)}",`;
        csv += `"${this.getStudentTypeText(reservation.student_type)}",`;
        csv += `"${(reservation.consultation_memo || '').replace(
          /"/g,
          '""'
        )}",`;
        csv += `"${reservation.consulted_by || '-'}"\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `컨설팅_${dateStr}.csv`;
      link.click();

      Utils.showToast('엑셀 다운로드 완료', 'success');
    } catch (error) {
      console.error('엑셀 다운로드 실패:', error);
      Utils.showToast('엑셀 다운로드 실패', 'error');
    }
  },

  // 헬퍼 메서드들
  getStatusText(status) {
    const texts = {
      pending: '대기',
      confirmed: '등록확정',
      impossible: '등록불가',
      reconsult: '재상담',
      hold: '보류',
      noshow: '노쇼',
    };
    return texts[status] || '대기';
  },

  getStudentTypeText(type) {
    const types = {
      new: '신규',
      existing: '재원',
      returning: '복귀',
    };
    return types[type] || '-';
  },

  // 이벤트 리스너 연결
  attachEventListeners() {
    document.querySelectorAll('.status-select').forEach((select) => {
      select.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const status = e.target.value;
        this.updateEnrollmentStatus(id, status);
      });
    });
  },

  // 키보드 단축키 설정
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'Escape' &&
        !document.getElementById('memoPanel').classList.contains('hidden')
      ) {
        this.closeMemo();
      }

      if (e.ctrlKey && e.key === 's' && this.currentReservationId) {
        e.preventDefault();
        this.saveMemo();
      }
    });
  },

  // 날짜 이동
  goToDate(dateStr) {
    console.log('Going to date:', dateStr); // 디버깅용

    const [year, month, day] = dateStr.split('-');
    this.currentDate = new Date(year, month - 1, day);

    console.log('Current date set to:', this.currentDate); // 디버깅용

    this.setupQuickDateSelector();
    this.loadDaySchedule();
  },
};

// 전역 노출
window.DashboardModule = DashboardModule;
window.ReservationsModule = ReservationsModule;
window.CheckinModule = CheckinModule;
window.TestModule = TestModule;
window.ConsultingModule = ConsultingModule;
