// 단위 테스트 설정 — 순수 로직(간격 반복·출제·데이터)만 대상으로 한다.
// 앱 빌드 설정(vite.config.ts)과 분리해 서로 영향을 주지 않게 한다.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
