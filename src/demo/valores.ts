// Cópia das regras de valores do backend (sistema-gerenciamento/src/valores.ts):
// todo valor monetário/quantidade é tratado em centavos inteiros e gravado
// como string decimal exata ("1234.56"), igual ao Decimal(10,2) do MySQL.

export const MAX_CENTAVOS = 9_999_999_999

export const MSG_VALOR_INVALIDO =
  'use um número com até 2 casas decimais (ex: 1.234,56 ou 1234.56)'

const RE_VIRGULA = /^\d+(,\d{1,2})?$/
const RE_PONTO = /^\d+(\.\d{1,2})?$/
const RE_MILHAR_VIRGULA = /^\d{1,3}(\.\d{3})+,\d{1,2}$/
const RE_MILHAR_SEM_CENTAVOS = /^\d{1,3}(\.\d{3}){2,}$/

function stringParaCentavos(texto: string): number | null {
  let s = texto.replace(/^R\$/i, '').replace(/\s+/g, '')
  let negativo = false
  if (s.startsWith('-')) {
    negativo = true
    s = s.slice(1)
  }
  const dividir = (sep: string): [string, string] => {
    const [i = '', f = ''] = s.split(sep)
    return [i, f]
  }
  let inteiro: string
  let fracao = ''
  if (RE_VIRGULA.test(s)) {
    ;[inteiro, fracao] = dividir(',')
  } else if (RE_PONTO.test(s)) {
    ;[inteiro, fracao] = dividir('.')
  } else if (RE_MILHAR_VIRGULA.test(s)) {
    ;[inteiro, fracao] = dividir(',')
    inteiro = inteiro.replace(/\./g, '')
  } else if (RE_MILHAR_SEM_CENTAVOS.test(s)) {
    inteiro = s.replace(/\./g, '')
  } else {
    return null
  }
  if (inteiro.length > 12) return null
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  return negativo ? -centavos : centavos
}

export function parseCentavos(valor: unknown, opcoes: { permitirNegativo?: boolean } = {}): number | null {
  let centavos: number | null = null
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null
    const c = Math.round(valor * 100)
    if (Math.abs(valor * 100 - c) > 1e-6) return null
    centavos = c
  } else if (typeof valor === 'string') {
    centavos = stringParaCentavos(valor.trim())
  }
  if (centavos === null) return null
  if (Object.is(centavos, -0)) centavos = 0
  if (!opcoes.permitirNegativo && centavos < 0) return null
  if (Math.abs(centavos) > MAX_CENTAVOS) return null
  return centavos
}

export function centavosParaDecimal(centavos: number): string {
  const negativo = centavos < 0
  const abs = Math.abs(centavos)
  const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  return negativo ? `-${texto}` : texto
}

export function decimalParaCentavos(valor: string | null | undefined): number {
  if (valor === null || valor === undefined) return 0
  return stringParaCentavos(valor) ?? 0
}

export function multiplicarCentavos(qtdCentavos: number, precoCentavos: number): number {
  const produto = BigInt(qtdCentavos) * BigInt(precoCentavos)
  return Number((produto + 50n) / 100n)
}
