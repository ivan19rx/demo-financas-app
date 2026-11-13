import { moeda } from '../utils/format'

// Células de tabela reutilizadas em Lançamentos e Extrato.

type Tipo = 'ENTRADA' | 'SAIDA'

export function TipoCell({ tipo }: { tipo: Tipo }) {
  const isEntrada = tipo === 'ENTRADA'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: isEntrada ? '#4ADE80' : '#F87171',
      background: isEntrada ? '#12321F' : '#3A1616',
      padding: '3px 10px', borderRadius: 999,
    }}>
      {isEntrada ? '▲ Entrada' : '▼ Saída'}
    </span>
  )
}

export function ValorCell({ valor, tipo }: { valor: string; tipo: Tipo }) {
  const num = parseFloat(valor) || 0
  const isEntrada = tipo === 'ENTRADA'
  return (
    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: isEntrada ? '#4ADE80' : '#F87171' }}>
      {isEntrada ? '+ ' : '- '}{moeda(Math.abs(num))}
    </span>
  )
}
