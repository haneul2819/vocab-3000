// 복습 알림 — 기기 안에서만 도는 로컬 알림 (서버 불필요)
// 간격 반복으로 복습일을 잡아 두고 알려주지 않으면 사용자가 돌아올 계기가 없다.
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { getDueStates } from './db'

/** 매일 같은 시각에 뜨는 알림 하나만 쓴다 */
const NOTIFICATION_ID = 1

export function reminderSupported(): boolean {
  return Capacitor.isNativePlatform()
}

/** 알림 권한을 요청한다. 허용되면 true */
export async function requestReminderPermission(): Promise<boolean> {
  if (!reminderSupported()) return false
  try {
    const res = await LocalNotifications.requestPermissions()
    return res.display === 'granted'
  } catch {
    return false
  }
}

export async function reminderPermissionGranted(): Promise<boolean> {
  if (!reminderSupported()) return false
  try {
    const res = await LocalNotifications.checkPermissions()
    return res.display === 'granted'
  } catch {
    return false
  }
}

/** 예약된 알림을 모두 지운다 */
export async function cancelReminder(): Promise<void> {
  if (!reminderSupported()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
  } catch { /* 예약된 것이 없으면 무시 */ }
}

/**
 * 매일 지정한 시각에 뜨는 복습 알림을 건다.
 * 알림 문구는 예약 시점의 복습 대기 수를 반영하므로,
 * 앱을 열 때마다 다시 걸어 주면 숫자가 최신으로 유지된다.
 * @param hhmm 'HH:MM' 24시간 형식
 */
export async function scheduleReminder(hhmm: string): Promise<boolean> {
  if (!reminderSupported()) return false
  if (!(await reminderPermissionGranted())) return false

  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return false

  const due = await getDueStates()
  const body = due.length > 0
    ? `복습할 단어가 ${due.length}개 기다리고 있어요.`
    : '오늘의 단어를 익혀 볼까요?'

  await cancelReminder()
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIFICATION_ID,
        title: '보카3000',
        body,
        schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
      }],
    })
    return true
  } catch {
    return false
  }
}
