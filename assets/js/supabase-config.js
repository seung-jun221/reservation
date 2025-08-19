// supabase-config.js
// Supabase 공통 설정 파일 - 모든 페이지에서 공유

// ⭐ Supabase 프로젝트 설정
const SUPABASE_CONFIG = {
  url: 'https://xooglumwuzctbcjtcvnd.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2dsdW13dXpjdGJjanRjdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTk5OTgsImV4cCI6MjA3MTE3NTk5OH0.Uza-Z3CzwQgkYKJmKdwTNCAYgaxeKFs__2udUSAGpJg',
};

// Supabase 클라이언트 초기화
let supabaseClient = null;

// Supabase 클라이언트 가져오기
function getSupabaseClient() {
  if (!supabaseClient) {
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    supabaseClient = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );
  }
  return supabaseClient;
}

// ===== 공통 데이터베이스 함수들 =====

// 설명회 목록 가져오기
async function getSeminars() {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    const { data, error } = await supabase
      .from('seminars')
      .select('*')
      .order('date', { ascending: true });

    return { data, error };
  } catch (error) {
    console.error('Error fetching seminars:', error);
    return { data: null, error };
  }
}

// 예약 목록 가져오기
async function getReservations(filters = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    let query = supabase.from('reservations').select('*');

    // 필터 적용
    if (filters.seminar_id) {
      query = query.eq('seminar_id', filters.seminar_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.phone) {
      query = query.eq('parent_phone', filters.phone);
    }

    // 정렬
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data, error };
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return { data: null, error };
  }
}

// 예약 생성
async function createReservation(reservationData) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error creating reservation:', error);
    return { data: null, error };
  }
}

// 예약 업데이트
async function updateReservation(id, updates) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating reservation:', error);
    return { data: null, error };
  }
}

// 예약 삭제
async function deleteReservation(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    const { error } = await supabase.from('reservations').delete().eq('id', id);

    return { error };
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return { error };
  }
}

// 참석 상태 업데이트
async function updateAttendance(
  reservationId,
  attendance,
  updatedBy = '관리자'
) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    const updates = {
      attendance: attendance,
      status: attendance, // 상태도 같이 업데이트
      attendance_checked_at: new Date().toISOString(),
      attendance_checked_by: updatedBy,
    };

    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', reservationId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating attendance:', error);
    return { data: null, error };
  }
}

// 통계 데이터 가져오기
async function getStatistics(seminarId = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase not initialized' };

  try {
    let query = supabase.from('reservations').select('status, attendance');

    if (seminarId) {
      query = query.eq('seminar_id', seminarId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 통계 계산
    const stats = {
      total: 0,
      reserved: 0,
      attended: 0,
      absent: 0,
      cancelled: 0,
      waitlist: 0,
    };

    data.forEach((reservation) => {
      stats.total++;

      switch (reservation.status) {
        case '예약':
          stats.reserved++;
          break;
        case '참석':
          stats.attended++;
          break;
        case '불참':
          stats.absent++;
          break;
        case '취소':
          stats.cancelled++;
          break;
        case '대기':
          stats.waitlist++;
          break;
      }
    });

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return { data: null, error };
  }
}

// 실시간 구독 설정
function subscribeToReservations(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const subscription = supabase
    .channel('reservations-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
      },
      (payload) => {
        console.log('Change received!', payload);
        callback(payload);
      }
    )
    .subscribe();

  return subscription;
}

// 구독 해제
function unsubscribeFromReservations(subscription) {
  if (subscription) {
    subscription.unsubscribe();
  }
}

// ===== 유틸리티 함수들 =====

// 전화번호 포맷팅
function formatPhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(
      3,
      7
    )}-${cleaned.substring(7, 11)}`;
  }
  return phone;
}

// 날짜 포맷팅
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 시간 포맷팅
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}시${minutes !== '00' ? ` ${minutes}분` : ''}`;
}

// 날짜/시간 포맷팅
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return `${formatDate(dateTimeStr)} ${date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

// 비밀번호 해싱
function hashPassword(password) {
  const SECURITY_SALT = 'math-morning-2025-secret';
  const str = password + SECURITY_SALT;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// CSV 내보내기
function exportToCSV(data, filename = 'export.csv') {
  // BOM 추가 (한글 깨짐 방지)
  let csv = '\uFEFF';

  // 헤더 추가
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    csv += headers.join(',') + '\n';

    // 데이터 추가
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        // 쉼표나 줄바꿈이 있는 경우 따옴표로 감싸기
        if (
          value &&
          (value.toString().includes(',') || value.toString().includes('\n'))
        ) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      csv += values.join(',') + '\n';
    });
  }

  // 다운로드
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// 전역으로 노출 (다른 스크립트에서 사용 가능)
window.SupabaseAPI = {
  getClient: getSupabaseClient,
  getSeminars,
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  updateAttendance,
  getStatistics,
  subscribeToReservations,
  unsubscribeFromReservations,
  utils: {
    formatPhoneNumber,
    formatDate,
    formatTime,
    formatDateTime,
    hashPassword,
    exportToCSV,
  },
};
