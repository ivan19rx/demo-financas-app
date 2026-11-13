import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authStore } from '../auth/store'
import { useAuth } from '../auth/useAuth'
import { restaurarDemo } from './acoes'

// Selo flutuante exibido dentro do app: lembra que é uma demonstração e
// permite trocar de perfil (empresa ↔ admin) ou restaurar os dados.
export function DemoBadge() {
  const { token, role } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)

  if (!token || pathname === '/login') return null

  function trocarPerfil() {
    authStore.logout()
    navigate('/login', { replace: true })
  }

  const botao: React.CSSProperties = {
    width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none',
    background: 'transparent', color: '#E4EEE9', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {aberto && (
        <div style={{
          width: 230, background: '#121D1A', border: '1px solid #24352F', borderRadius: 12, padding: 6,
          boxShadow: '0 12px 32px rgba(0,40,35,0.18)',
        }}>
          <p style={{ margin: '6px 10px 8px', fontSize: 12, color: '#93AEA2', lineHeight: 1.45 }}>
            Você está na versão de demonstração{role === 'ADMIN' ? ' como administrador' : ' como empresa'}.
            Os dados são fictícios e ficam só neste navegador.
          </p>
          <button style={botao} onClick={trocarPerfil}
            onMouseEnter={e => (e.currentTarget.style.background = '#17241F')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            ⇄ Trocar perfil
          </button>
          <button style={{ ...botao, color: '#F87171' }} onClick={restaurarDemo}
            onMouseEnter={e => (e.currentTarget.style.background = '#2A1414')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            ↺ Restaurar dados de exemplo
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        title="Opções da demonstração"
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999,
          border: '1px solid #C9B06A88', background: '#0F1F1B', color: '#EDE8D8',
          fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,40,35,0.25)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9B06A' }} />
        DEMO
      </button>
    </div>
  )
}
