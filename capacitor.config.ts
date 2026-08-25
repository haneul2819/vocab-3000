// Capacitor 설정 — 웹 빌드(dist/)를 통째로 앱에 내장 (서버·인터넷 불필요)
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.haneul2819.voca3000',
  appName: '보카3000',
  webDir: 'dist',
}

export default config
