import { Loading } from '@/shared/components/ui/Loading'

/** Full-screen auth bootstrap / redirect wait — spinner only. */
export function AuthStatusFallback() {
  return <Loading fullscreen />
}
