// 학습 기록 백업 파일 저장 — 앱에서는 공유 시트로, 웹에서는 다운로드로.
// 폰을 바꾸거나 앱을 지우면 진도가 사라지므로, 밖으로 꺼내기 쉬워야 한다.
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { exportAll } from './db'

export function backupFileName(now = new Date()): string {
  return `vocab3000-backup-${now.toISOString().slice(0, 10)}.json`
}

/** 어디에 저장했는지 사용자에게 알려 줄 결과 */
export type BackupResult =
  | { kind: 'shared' }        // 공유 시트로 넘김 (드라이브·메신저 등)
  | { kind: 'downloaded' }    // 브라우저 다운로드
  | { kind: 'cancelled' }     // 사용자가 공유를 닫음

/** 백업 파일을 만들어 저장·공유한다 */
export async function saveBackup(): Promise<BackupResult> {
  const json = JSON.stringify(await exportAll(), null, 1)
  const name = backupFileName()

  if (Capacitor.isNativePlatform()) {
    // 앱 전용 폴더에 쓴 뒤 공유 시트로 넘긴다 (저장 위치는 사용자가 고른다)
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({
        title: '보카3000 학습 기록',
        text: '보카3000 학습 기록 백업 파일입니다.',
        url: uri,
        dialogTitle: '학습 기록 저장하기',
      })
      return { kind: 'shared' }
    } catch {
      // 사용자가 공유 시트를 닫은 경우
      return { kind: 'cancelled' }
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return { kind: 'downloaded' }
}
