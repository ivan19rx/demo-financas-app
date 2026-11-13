import { authStore } from '../auth/store'
import { resetarDB } from './db'

// Apaga tudo o que foi alterado na demonstração e volta aos dados de exemplo.
export function restaurarDemo() {
  if (!window.confirm('Restaurar os dados de exemplo? Tudo o que você criou ou alterou na demonstração será descartado.')) return
  resetarDB()
  authStore.logout()
  window.location.assign('/login')
}
