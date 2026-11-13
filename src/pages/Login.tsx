import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { C } from '../theme'
import { authStore } from '../auth/store'
import { getDB } from '../demo/db'
import { registrarLoginDemo } from '../demo/server'
import { restaurarDemo } from '../demo/acoes'

// Tela de entrada da DEMONSTRAÇÃO: sem usuário e senha. A pessoa escolhe se
// quer ver o sistema como uma empresa (cliente) ou como o administrador.

interface OpcaoProps {
  titulo: string
  descricao: string
  itens: string[]
  icone: React.ReactNode
  acao: string
  onClick: () => void
  children?: React.ReactNode
}

function Opcao({ titulo, descricao, itens, icone, acao, onClick, children }: OpcaoProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      style={{
        flex: '1 1 300px',
        display: 'flex',
        flexDirection: 'column',
        background: '#0F2D25',
        border: `1.5px solid ${hover ? C.activeIcon : '#1E4538'}`,
        borderRadius: 16,
        padding: 24,
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: C.activeItem, color: C.activeIcon,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>{icone}</svg>
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#EDE8D8' }}>{titulo}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: C.mutedText, lineHeight: 1.5 }}>{descricao}</p>
      <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {itens.map(i => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: C.navText, lineHeight: 1.4 }}>
            <span style={{ color: C.activeIcon, fontWeight: 700 }}>✓</span>{i}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
        <button
          type="button"
          onClick={onClick}
          style={{
            padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: hover ? C.activeIcon : C.activeItem,
            color: hover ? '#0B2620' : C.navText,
            fontSize: 15, fontWeight: 700, letterSpacing: '0.02em', transition: 'background 0.15s, color 0.15s',
          }}
        >
          {acao} →
        </button>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const db = getDB()
  const empresasAtivas = db.empresas.filter(e => e.ativo)
  const [empresaId, setEmpresaId] = useState(empresasAtivas[0]?.id ?? 0)

  function entrarComoEmpresa() {
    const e = db.empresas.find(x => x.id === empresaId) ?? empresasAtivas[0]
    if (!e) return
    registrarLoginDemo('EMPRESA', e)
    authStore.loginEmpresa('demo-token-empresa', {
      id: e.id, cnpj: e.cnpj, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, email: e.email,
    })
    navigate('/', { replace: true })
  }

  function entrarComoAdmin() {
    const a = db.admins[0]
    registrarLoginDemo('ADMIN')
    authStore.loginAdmin('demo-token-admin', { id: a.id, email: a.email, cnpj: a.cnpj })
    navigate('/admin', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(1200px 600px at 50% -10%, #17352D 0%, #0F1F1B 45%, #0B1412 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 820 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo size={52} />
          </div>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
            color: C.gold, border: `1px solid ${C.gold}66`, background: '#C9B06A14',
            padding: '4px 10px', borderRadius: 999, marginBottom: 12,
          }}>
            DEMONSTRAÇÃO
          </span>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 700, color: '#EDE8D8' }}>
            Conheça o sistema de gestão
          </h1>
          <p style={{ margin: '0 auto', maxWidth: 520, fontSize: 14.5, color: C.mutedText, lineHeight: 1.55 }}>
            Controle financeiro, estoque, clientes e relatórios em um só lugar.
            Escolha um perfil para explorar. Não precisa de login.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Opcao
            titulo="Entrar como Empresa"
            descricao="Veja o dia a dia de uma empresa usando o sistema."
            itens={[
              'Dashboard com gráficos de entradas, saídas e saldos',
              'Lançamentos financeiros e movimentações de produtos',
              'Clientes/fornecedores com saldo a pagar e a receber',
              'Extrato filtrado e relatórios em PDF',
            ]}
            icone={<path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01" />}
            acao="Entrar como Empresa"
            onClick={entrarComoEmpresa}
          >
            {empresasAtivas.length > 1 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.mutedText }}>
                Empresa
                <select
                  value={empresaId}
                  onChange={e => setEmpresaId(Number(e.target.value))}
                  style={{
                    padding: '9px 10px', borderRadius: 8, border: '1px solid #1E4538', background: '#0A231D',
                    color: '#EDE8D8', fontSize: 13.5, outline: 'none',
                  }}
                >
                  {empresasAtivas.map(e => (
                    <option key={e.id} value={e.id}>{e.nomeFantasia ?? e.razaoSocial}</option>
                  ))}
                </select>
              </label>
            )}
          </Opcao>

          <Opcao
            titulo="Entrar como Administrador"
            descricao="Gerencie todas as empresas que usam o sistema."
            itens={[
              'Cadastro, edição e desativação de empresas',
              'Acessar os dados de qualquer empresa',
              'Histórico de logins por dispositivo',
              'Registro de todas as requisições da API',
            ]}
            icone={<path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />}
            acao="Entrar como Admin"
            onClick={entrarComoAdmin}
          />
        </div>

        <p style={{ textAlign: 'center', margin: '22px 0 0', fontSize: 12.5, color: C.mutedText, lineHeight: 1.6 }}>
          Todos os dados são fictícios e ficam salvos apenas neste navegador.{' '}
          <button
            type="button"
            onClick={restaurarDemo}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: C.activeIcon, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline',
            }}
          >
            Restaurar dados de exemplo
          </button>
        </p>
      </div>
    </div>
  )
}
