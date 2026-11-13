interface LogoProps {
  size?: number
}

// Marca genérica da demonstração (sem a logo do projeto principal).
export function Logo({ size = 48 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Gestão Demo" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="48" height="48" rx="12" fill="#1E4A38" />
      <rect x="11" y="26" width="6" height="11" rx="2" fill="#7EC8A4" />
      <rect x="21" y="19" width="6" height="18" rx="2" fill="#7EC8A4" />
      <rect x="31" y="11" width="6" height="26" rx="2" fill="#C9B06A" />
    </svg>
  )
}

// Cabeçalho das barras laterais: marca + nome.
export function MarcaLateral() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 22px 24px', borderBottom: '1px solid #1E3530' }}>
      <Logo size={40} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#EDE8D8', letterSpacing: '0.01em' }}>Gestão Demo</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#94BBA9', letterSpacing: '0.06em' }}>FINANCEIRO · ESTOQUE</div>
      </div>
    </div>
  )
}
