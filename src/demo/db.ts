// "Banco de dados" da demonstração: vive no localStorage do navegador.
//
// Os registros têm o mesmo formato que o backend real devolve (Prisma →
// JSON): valores Decimal como string ("1234.56") e datas em ISO. Assim as
// telas do sistema funcionam sem nenhuma alteração.

import { centavosParaDecimal, decimalParaCentavos, multiplicarCentavos } from './valores'

export type Tipo = 'ENTRADA' | 'SAIDA'
export type Unidade = 'KG' | 'CAIXA' | 'PCT'
export type TipoAcesso = 'ADMIN' | 'EMPRESA'
export type TipoDispositivo = 'COMPUTADOR' | 'CELULAR' | 'TABLET' | 'DESCONHECIDO'

export interface Empresa {
  id: number
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  inscricaoEstadual: string | null
  inscricaoMunicipal: string | null
  endereco: string | null
  email: string
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface Admin { id: number; email: string; cnpj: string | null }

export interface FornecedorCliente {
  id: number
  nome: string
  saldo: string
  ativo: boolean
  empresaId: number
  criadoEm: string
  atualizadoEm: string
}

export interface Conta { id: number; nome: string; empresaId: number }
export interface Categoria { id: number; nome: string; empresaId: number }

export interface Produto {
  id: number
  nome: string
  unidadeMedida: Unidade
  empresaId: number
  criadoEm: string
  atualizadoEm: string
}

export interface Lancamento {
  id: number
  dataLancamento: string
  tipo: Tipo
  valor: string
  classificacao: string | null
  observacao: string | null
  empresaId: number
  fornecedorClienteId: number
  contaId: number
  categoriaId: number
  criadoEm: string
  atualizadoEm: string
}

export interface Movimentacao {
  id: number
  dataMovimento: string
  tipo: Tipo
  quantidade: string | null
  preco: string | null
  total: string
  valorDetalhado: string | null
  nf: string | null
  motorista: string | null
  veiculo: string | null
  transportadora: string | null
  descricao: string | null
  empresaId: number
  fornecedorClienteId: number
  produtoId: number | null
  criadoEm: string
  atualizadoEm: string
}

export interface RegistroLogin {
  id: number
  tipoAcesso: TipoAcesso
  sucesso: boolean
  motivo: string | null
  identificador: string
  nomeUsuario: string | null
  adminId: number | null
  empresaId: number | null
  ip: string | null
  userAgent: string | null
  tipoDispositivo: TipoDispositivo
  sistema: string | null
  navegador: string | null
  modelo: string | null
  criadoEm: string
}

export interface RegistroRequisicao {
  id: number
  metodo: string
  caminho: string
  rota: string
  consulta: string | null
  status: number
  duracaoMs: number
  tipoAcesso: TipoAcesso | null
  adminId: number | null
  empresaId: number | null
  ip: string | null
  tipoDispositivo: TipoDispositivo
  sistema: string | null
  navegador: string | null
  criadoEm: string
}

export interface DB {
  versao: number
  seq: Record<string, number>
  admins: Admin[]
  empresas: Empresa[]
  clientes: FornecedorCliente[]
  contas: Conta[]
  categorias: Categoria[]
  produtos: Produto[]
  lancamentos: Lancamento[]
  movimentacoes: Movimentacao[]
  registrosLogin: RegistroLogin[]
  registrosRequisicoes: RegistroRequisicao[]
}

const STORAGE_KEY = 'demo-db'
const VERSAO = 2
// limite de registros de requisição guardados (os mais antigos saem)
export const MAX_REQUISICOES = 2500

// ── Persistência ────────────────────────────────────────────────────────────

let db: DB | null = null

export function getDB(): DB {
  if (db) return db
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.versao === VERSAO) {
        db = parsed
        return db
      }
    }
  } catch {
    /* corrompido/indisponível: recria */
  }
  db = gerarSeed()
  salvar()
  return db
}

export function salvar() {
  if (!db) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // cota estourada: descarta metade dos registros de requisição e tenta de novo
    db.registrosRequisicoes = db.registrosRequisicoes.slice(-Math.floor(MAX_REQUISICOES / 2))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) } catch { /* só memória */ }
  }
}

export function resetarDB() {
  db = null
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignora */ }
}

export function proximoId(tabela: string): number {
  const d = getDB()
  d.seq[tabela] = (d.seq[tabela] ?? 0) + 1
  return d.seq[tabela]
}

// ── Seed ────────────────────────────────────────────────────────────────────

// PRNG determinístico: a demonstração sempre começa com os mesmos dados.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

// Data "só dia" n dias atrás, no formato que o backend grava (meia-noite UTC).
function diaISO(diasAtras: number): string {
  const d = new Date()
  d.setDate(d.getDate() - diasAtras)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`
}

// Instante com hora, n dias (fracionados) atrás.
function instanteISO(diasAtras: number): string {
  return new Date(Date.now() - diasAtras * 86_400_000).toISOString()
}

interface Modelo {
  empresa: Omit<Empresa, 'id' | 'ativo' | 'criadoEm' | 'atualizadoEm'>
  ativo: boolean
  clientes: string[]
  fornecedores: string[]
  servicos: { nome: string; categoria: string; mensal: [number, number] }[]
  contas: string[]
  categorias: string[]
  produtos: { nome: string; unidade: Unidade; compra: number; venda: number; qtd: [number, number] }[]
  transportadoras: string[]
  motoristas: string[]
  veiculos: string[]
  semanas: number
  ritmo: number
}

const MODELOS: Modelo[] = [
  {
    empresa: {
      cnpj: '12345678000190',
      razaoSocial: 'Castanhas do Norte Comércio Ltda',
      nomeFantasia: 'Castanhas do Norte',
      inscricaoEstadual: '15.123.456-7',
      inscricaoMunicipal: '0045123',
      endereco: 'Rod. BR-316, km 12 — Ananindeua/PA',
      email: 'contato@castanhasdonorte.demo',
    },
    ativo: true,
    clientes: [
      'Atacadão Nordeste', 'Supermercados Bom Preço', 'Empório Sabor da Terra',
      'Mercado Central BH', 'Exportadora Atlântico', 'Rede Natural Fit',
    ],
    fornecedores: [
      'Cooperativa Agro Pará', 'Sítio Boa Esperança', 'Fazenda Santa Luzia',
      'João Batista (produtor)',
    ],
    servicos: [
      { nome: 'Equatorial Energia', categoria: 'Energia', mensal: [180000, 260000] },
      { nome: 'Equipe interna', categoria: 'Folha de pagamento', mensal: [1450000, 1600000] },
      { nome: 'TransNorte Logística', categoria: 'Frete', mensal: [320000, 610000] },
      { nome: 'Receita Federal', categoria: 'Impostos', mensal: [420000, 780000] },
    ],
    contas: ['Caixa', 'Banco do Brasil', 'Itaú', 'Pix'],
    categorias: [
      'Compra de matéria-prima', 'Venda de produtos', 'Frete', 'Folha de pagamento',
      'Energia', 'Impostos', 'Manutenção',
    ],
    produtos: [
      { nome: 'Castanha de caju W1', unidade: 'KG', compra: 3800, venda: 5900, qtd: [80, 600] },
      { nome: 'Castanha de caju W2', unidade: 'KG', compra: 3200, venda: 4900, qtd: [80, 600] },
      { nome: 'Castanha-do-pará', unidade: 'KG', compra: 4500, venda: 6900, qtd: [50, 400] },
      { nome: 'Mix de castanhas 500g', unidade: 'PCT', compra: 1800, venda: 2990, qtd: [40, 300] },
      { nome: 'Castanha caramelizada', unidade: 'CAIXA', compra: 9500, venda: 15500, qtd: [10, 80] },
    ],
    transportadoras: ['TransNorte Logística', 'Rápido Cearense', 'JM Transportes'],
    motoristas: ['Carlos Mendes', 'Raimundo Sousa', 'Antônio Lima', 'Paulo Rocha'],
    veiculos: ['QDA-4F21', 'OTX-7B33', 'PPA-2C90', 'JVK-8E14'],
    semanas: 26,
    ritmo: 1,
  },
  {
    empresa: {
      cnpj: '98765432000155',
      razaoSocial: 'Distribuidora Sol Nascente Eireli',
      nomeFantasia: 'Sol Nascente Alimentos',
      inscricaoEstadual: '06.987.654-3',
      inscricaoMunicipal: null,
      endereco: 'Av. Bezerra de Menezes, 1500 — Fortaleza/CE',
      email: 'financeiro@solnascente.demo',
    },
    ativo: true,
    clientes: ['Padaria Pão Dourado', 'Restaurante Mar Aberto', 'Mercadinho São José', 'Hotel Praia Mansa'],
    fornecedores: ['Moinho Fortaleza', 'Laticínios Serra Azul', 'Granja Boa Vista'],
    servicos: [
      { nome: 'Enel Ceará', categoria: 'Energia', mensal: [90000, 140000] },
      { nome: 'Colaboradores', categoria: 'Salários', mensal: [820000, 900000] },
    ],
    contas: ['Caixa', 'Bradesco', 'Pix'],
    categorias: ['Compras', 'Vendas', 'Energia', 'Salários', 'Aluguel'],
    produtos: [
      { nome: 'Farinha de trigo', unidade: 'KG', compra: 450, venda: 690, qtd: [200, 1500] },
      { nome: 'Queijo coalho', unidade: 'KG', compra: 2900, venda: 4200, qtd: [20, 150] },
      { nome: 'Ovos (caixa 30 un.)', unidade: 'CAIXA', compra: 1700, venda: 2400, qtd: [20, 120] },
    ],
    transportadoras: ['Entrega Rápida CE', 'Frota própria'],
    motoristas: ['José Augusto', 'Marcos Vieira'],
    veiculos: ['HXZ-1A22', 'OSL-9D07'],
    semanas: 16,
    ritmo: 0.7,
  },
  {
    empresa: {
      cnpj: '45678912000133',
      razaoSocial: 'Agro Vale Verde Ltda',
      nomeFantasia: 'Vale Verde',
      inscricaoEstadual: null,
      inscricaoMunicipal: null,
      endereco: 'Estrada Vicinal 4, s/n — Petrolina/PE',
      email: 'adm@valeverde.demo',
    },
    ativo: false,
    clientes: ['Ceasa Recife', 'Frutas do Vale Export'],
    fornecedores: ['Viveiro São Francisco'],
    servicos: [],
    contas: ['Caixa', 'Sicredi'],
    categorias: ['Insumos', 'Vendas'],
    produtos: [
      { nome: 'Manga Tommy', unidade: 'CAIXA', compra: 2200, venda: 3800, qtd: [30, 200] },
      { nome: 'Uva Vitória', unidade: 'CAIXA', compra: 3100, venda: 5200, qtd: [20, 120] },
    ],
    transportadoras: ['Vale Cargas'],
    motoristas: ['Severino Alves'],
    veiculos: ['PEX-3H55'],
    semanas: 8,
    ritmo: 0.5,
  },
]

function gerarSeed(): DB {
  const r = mulberry32(20261113)
  const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  const um = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)]

  const d: DB = {
    versao: VERSAO,
    seq: {},
    admins: [{ id: 1, email: 'admin@demo.com', cnpj: null }],
    empresas: [],
    clientes: [],
    contas: [],
    categorias: [],
    produtos: [],
    lancamentos: [],
    movimentacoes: [],
    registrosLogin: [],
    registrosRequisicoes: [],
  }
  const seq = (t: string) => (d.seq[t] = (d.seq[t] ?? 0) + 1)

  for (const m of MODELOS) {
    const criado = instanteISO(m.semanas * 7 + 20)
    const empresa: Empresa = {
      id: seq('empresas'), ...m.empresa, ativo: m.ativo, criadoEm: criado, atualizadoEm: criado,
    }
    d.empresas.push(empresa)
    const empresaId = empresa.id

    // saldo de cada fornecedor/cliente, acumulado em centavos
    const saldos = new Map<number, number>()
    const novoFC = (nome: string) => {
      const fc: FornecedorCliente = {
        id: seq('clientes'), nome, saldo: '0.00', ativo: true, empresaId, criadoEm: criado, atualizadoEm: criado,
      }
      d.clientes.push(fc)
      saldos.set(fc.id, 0)
      return fc
    }
    const clientes = m.clientes.map(novoFC)
    const fornecedores = m.fornecedores.map(novoFC)
    const servicos = m.servicos.map(s => ({ ...s, fc: novoFC(s.nome) }))

    const contas = m.contas.map(nome => {
      const c: Conta = { id: seq('contas'), nome, empresaId }
      d.contas.push(c)
      return c
    })
    const categorias = new Map<string, Categoria>()
    for (const nome of m.categorias) {
      const c: Categoria = { id: seq('categorias'), nome, empresaId }
      d.categorias.push(c)
      categorias.set(nome, c)
    }
    const catCompra = categorias.get(m.categorias[0])!
    const catVenda = categorias.get(m.categorias.find(c => c.startsWith('Venda')) ?? m.categorias[1])!

    const produtos = m.produtos.map(p => {
      const prod: Produto = {
        id: seq('produtos'), nome: p.nome, unidadeMedida: p.unidade, empresaId, criadoEm: criado, atualizadoEm: criado,
      }
      d.produtos.push(prod)
      return { ...p, prod }
    })

    const lancar = (dias: number, tipo: Tipo, centavos: number, fcId: number, cat: Categoria, classificacao: string | null, observacao: string | null) => {
      const quando = instanteISO(dias)
      d.lancamentos.push({
        id: seq('lancamentos'),
        dataLancamento: diaISO(dias),
        tipo,
        valor: centavosParaDecimal(centavos),
        classificacao,
        observacao,
        empresaId,
        fornecedorClienteId: fcId,
        contaId: um(contas).id,
        categoriaId: cat.id,
        criadoEm: quando,
        atualizadoEm: quando,
      })
      saldos.set(fcId, (saldos.get(fcId) ?? 0) + (tipo === 'ENTRADA' ? centavos : -centavos))
    }

    let nf = 1000 + empresaId * 1000
    const movimentar = (dias: number, tipo: Tipo, fcId: number, p: (typeof produtos)[number]) => {
      const qtdC = entre(p.qtd[0], p.qtd[1]) * 100
      const base = tipo === 'ENTRADA' ? p.compra : p.venda
      const precoC = Math.round(base * (0.92 + r() * 0.16))
      const totalC = multiplicarCentavos(qtdC, precoC)
      const saida = tipo === 'SAIDA'
      const quando = instanteISO(dias)
      d.movimentacoes.push({
        id: seq('movimentacoes'),
        dataMovimento: diaISO(dias),
        tipo,
        quantidade: centavosParaDecimal(qtdC),
        preco: centavosParaDecimal(precoC),
        total: centavosParaDecimal(totalC),
        valorDetalhado: null,
        nf: saida || r() < 0.5 ? String(++nf) : null,
        motorista: saida ? um(m.motoristas) : null,
        veiculo: saida ? um(m.veiculos) : null,
        transportadora: saida ? um(m.transportadoras) : null,
        descricao: r() < 0.25 ? (saida ? 'Entrega conforme pedido' : 'Lote conferido na recepção') : null,
        empresaId,
        fornecedorClienteId: fcId,
        produtoId: p.prod.id,
        criadoEm: quando,
        atualizadoEm: quando,
      })
      saldos.set(fcId, (saldos.get(fcId) ?? 0) + (tipo === 'ENTRADA' ? totalC : -totalC))
      return totalC
    }

    // Semana a semana: compras de fornecedores (pagas alguns dias depois) e
    // vendas para clientes (recebidas alguns dias depois). As mais recentes
    // ficam em aberto, gerando saldos a pagar / a receber.
    const totalDias = m.semanas * 7
    for (let dia = totalDias; dia >= 0; dia -= 7) {
      const compras = Math.max(1, Math.round(entre(1, 3) * m.ritmo))
      for (let i = 0; i < compras; i++) {
        const dias = Math.max(0, dia - entre(0, 6))
        const forn = um(fornecedores)
        const total = movimentar(dias, 'ENTRADA', forn.id, um(produtos))
        const pagoEm = dias - entre(3, 15)
        if (pagoEm >= 0) {
          const parcial = r() < 0.2
          lancar(pagoEm, 'SAIDA', parcial ? Math.round(total * 0.6) : total, forn.id, catCompra,
            parcial ? 'Pagamento parcial' : 'Pagamento fornecedor', null)
        }
      }
      const vendas = Math.max(1, Math.round(entre(2, 4) * m.ritmo))
      for (let i = 0; i < vendas; i++) {
        const dias = Math.max(0, dia - entre(0, 6))
        const cli = um(clientes)
        const total = movimentar(dias, 'SAIDA', cli.id, um(produtos))
        const recebidoEm = dias - entre(2, 20)
        if (recebidoEm >= 0) {
          const parcial = r() < 0.2
          lancar(recebidoEm, 'ENTRADA', parcial ? Math.round(total * 0.5) : total, cli.id, catVenda,
            parcial ? 'Recebimento parcial' : 'Recebimento venda', parcial ? 'Restante combinado para o próximo mês' : null)
        }
      }
    }

    // Despesas mensais (energia, folha, frete...). O saldo desses cadastros
    // representa a fatura do mês corrente, ainda a pagar.
    for (const s of servicos) {
      for (let mes = Math.floor(totalDias / 30); mes >= 1; mes--) {
        const valor = entre(s.mensal[0], s.mensal[1])
        lancar(mes * 30 - entre(0, 4), 'SAIDA', valor, s.fc.id, categorias.get(s.categoria)!, 'Despesa mensal', null)
      }
      saldos.set(s.fc.id, entre(s.mensal[0], s.mensal[1]))
    }

    if (categorias.has('Manutenção') && servicos[0]) {
      lancar(entre(10, 40), 'SAIDA', entre(45000, 120000), servicos[0].fc.id, categorias.get('Manutenção')!,
        'Avulso', 'Troca de disjuntor do galpão')
    }

    for (const fc of d.clientes.filter(c => c.empresaId === empresaId)) {
      fc.saldo = centavosParaDecimal(saldos.get(fc.id) ?? 0)
    }
  }

  // Um cliente inativo, para a tela de clientes mostrar o filtro de status.
  const inativo = d.clientes.find(c => c.nome === 'Rede Natural Fit')
  if (inativo) inativo.ativo = false

  gerarRegistros(d, r)
  return d
}

// ── Registros (histórico de logins e requisições do admin) ──────────────────

const PERFIS: { tipo: TipoDispositivo; sistema: string; navegador: string; modelo: string | null; ua: string }[] = [
  { tipo: 'COMPUTADOR', sistema: 'Windows 11', navegador: 'Chrome 131', modelo: null, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
  { tipo: 'COMPUTADOR', sistema: 'Windows 10', navegador: 'Edge 130', modelo: null, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' },
  { tipo: 'COMPUTADOR', sistema: 'macOS 14', navegador: 'Safari 17', modelo: null, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' },
  { tipo: 'CELULAR', sistema: 'Android 14', navegador: 'Chrome 131', modelo: 'Samsung Galaxy A54', ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { tipo: 'CELULAR', sistema: 'iOS 17', navegador: 'Safari 17', modelo: 'iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { tipo: 'TABLET', sistema: 'iPadOS 17', navegador: 'Safari 17', modelo: 'iPad', ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
]

const ROTAS_EMPRESA: { metodo: string; rota: string; peso: number }[] = [
  { metodo: 'GET', rota: '/lancamentos', peso: 20 },
  { metodo: 'GET', rota: '/fornecedores-clientes', peso: 18 },
  { metodo: 'GET', rota: '/movimentacoes', peso: 12 },
  { metodo: 'GET', rota: '/contas', peso: 8 },
  { metodo: 'GET', rota: '/categorias', peso: 8 },
  { metodo: 'GET', rota: '/produtos', peso: 6 },
  { metodo: 'GET', rota: '/fornecedores-clientes/resumo', peso: 6 },
  { metodo: 'GET', rota: '/lancamentos/filtros', peso: 6 },
  { metodo: 'GET', rota: '/movimentacoes/transportadoras', peso: 3 },
  { metodo: 'POST', rota: '/lancamentos', peso: 6 },
  { metodo: 'PATCH', rota: '/lancamentos/:id', peso: 2 },
  { metodo: 'DELETE', rota: '/lancamentos/:id', peso: 1 },
  { metodo: 'POST', rota: '/movimentacoes', peso: 4 },
  { metodo: 'PATCH', rota: '/movimentacoes/:id', peso: 1 },
  { metodo: 'POST', rota: '/fornecedores-clientes', peso: 2 },
  { metodo: 'PUT', rota: '/fornecedores-clientes/:id', peso: 1 },
  { metodo: 'DELETE', rota: '/categorias/:id', peso: 1 },
]

export function sortearPerfil(r: () => number) {
  return PERFIS[Math.floor(r() * PERFIS.length)]
}

function gerarRegistros(d: DB, r: () => number) {
  const ip = () => `177.${Math.floor(r() * 200) + 20}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`
  const ativas = d.empresas.filter(e => e.ativo)
  // cada empresa usa sempre os mesmos aparelhos/IP (fica mais crível)
  const aparelhos = new Map(d.empresas.map(e => [e.id, [sortearPerfil(r), sortearPerfil(r)]]))
  const ips = new Map(d.empresas.map(e => [e.id, [ip(), ip()]]))
  const adminPerfil = PERFIS[0]
  const adminIp = ip()

  const login: Omit<RegistroLogin, 'id'>[] = []
  for (let dia = 45; dia >= 0; dia--) {
    for (const e of ativas) {
      if (r() < 0.25) continue
      const k = r() < 0.7 ? 0 : 1
      const p = aparelhos.get(e.id)![k]
      const t = dia + r() * 0.5
      // de vez em quando alguém erra a senha antes de acertar
      if (r() < 0.12) {
        login.push({
          tipoAcesso: 'EMPRESA', sucesso: false, motivo: 'Senha incorreta', identificador: e.email,
          nomeUsuario: e.nomeFantasia ?? e.razaoSocial, adminId: null, empresaId: e.id, ip: ips.get(e.id)![k],
          userAgent: p.ua, tipoDispositivo: p.tipo, sistema: p.sistema, navegador: p.navegador, modelo: p.modelo,
          criadoEm: instanteISO(t + 0.002),
        })
      }
      login.push({
        tipoAcesso: 'EMPRESA', sucesso: true, motivo: null, identificador: r() < 0.5 ? e.email : e.cnpj,
        nomeUsuario: e.nomeFantasia ?? e.razaoSocial, adminId: null, empresaId: e.id, ip: ips.get(e.id)![k],
        userAgent: p.ua, tipoDispositivo: p.tipo, sistema: p.sistema, navegador: p.navegador, modelo: p.modelo,
        criadoEm: instanteISO(t),
      })
    }
    if (r() < 0.5) {
      login.push({
        tipoAcesso: 'ADMIN', sucesso: true, motivo: null, identificador: 'admin@demo.com', nomeUsuario: 'admin@demo.com',
        adminId: 1, empresaId: null, ip: adminIp, userAgent: adminPerfil.ua, tipoDispositivo: adminPerfil.tipo,
        sistema: adminPerfil.sistema, navegador: adminPerfil.navegador, modelo: null, criadoEm: instanteISO(dia + r() * 0.4),
      })
    }
    if (r() < 0.15) {
      const p = sortearPerfil(r)
      login.push({
        tipoAcesso: 'EMPRESA', sucesso: false, motivo: 'Usuário não encontrado', identificador: 'teste@teste.com',
        nomeUsuario: null, adminId: null, empresaId: null, ip: ip(), userAgent: p.ua, tipoDispositivo: p.tipo,
        sistema: p.sistema, navegador: p.navegador, modelo: p.modelo, criadoEm: instanteISO(dia + r() * 0.9),
      })
    }
  }
  login.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  d.registrosLogin = login.map(l => ({ ...l, id: (d.seq.registrosLogin = (d.seq.registrosLogin ?? 0) + 1) }))

  const pesoTotal = ROTAS_EMPRESA.reduce((s, x) => s + x.peso, 0)
  const sortearRota = () => {
    let x = r() * pesoTotal
    for (const rt of ROTAS_EMPRESA) { if ((x -= rt.peso) < 0) return rt }
    return ROTAS_EMPRESA[0]
  }
  const reqs: Omit<RegistroRequisicao, 'id'>[] = []
  for (let dia = 30; dia >= 0; dia--) {
    const n = 40 + Math.floor(r() * 40)
    for (let i = 0; i < n; i++) {
      const e = ativas[Math.floor(r() * ativas.length)]
      const viaAdmin = r() < 0.12
      const rt = sortearRota()
      const lancId = d.lancamentos.find(l => l.empresaId === e.id)?.id ?? 1
      const caminho = rt.rota.replace(':id', String(lancId + Math.floor(r() * 40)))
      let status = rt.metodo === 'POST' ? 201 : 200
      const x = r()
      if (x < 0.03) status = 400
      else if (x < 0.05) status = 404
      else if (x < 0.06 && rt.metodo !== 'GET') status = 409
      else if (x < 0.065) status = 500
      const k = r() < 0.7 ? 0 : 1
      const p = viaAdmin ? adminPerfil : aparelhos.get(e.id)![k]
      reqs.push({
        metodo: rt.metodo,
        caminho,
        rota: rt.rota,
        consulta: rt.rota === '/lancamentos/filtros' ? 'clienteId=&tipo=TODOS&dataInicio=&dataFim=' : null,
        status,
        duracaoMs: r() < 0.04 ? 1000 + Math.floor(r() * 2500) : 40 + Math.floor(r() * 500),
        tipoAcesso: viaAdmin ? 'ADMIN' : 'EMPRESA',
        adminId: viaAdmin ? 1 : null,
        empresaId: e.id,
        ip: viaAdmin ? adminIp : ips.get(e.id)![k],
        tipoDispositivo: p.tipo,
        sistema: p.sistema,
        navegador: p.navegador,
        criadoEm: instanteISO(dia + r()),
      })
    }
    // admin consultando empresas
    if (r() < 0.6) {
      reqs.push({
        metodo: 'GET', caminho: '/empresas', rota: '/empresas', consulta: null, status: 200,
        duracaoMs: 60 + Math.floor(r() * 200), tipoAcesso: 'ADMIN', adminId: 1, empresaId: null, ip: adminIp,
        tipoDispositivo: adminPerfil.tipo, sistema: adminPerfil.sistema, navegador: adminPerfil.navegador,
        criadoEm: instanteISO(dia + r()),
      })
    }
    // requisições sem login barradas (401)
    if (r() < 0.3) {
      reqs.push({
        metodo: 'GET', caminho: '/lancamentos', rota: '/lancamentos', consulta: null, status: 401,
        duracaoMs: 5 + Math.floor(r() * 20), tipoAcesso: null, adminId: null, empresaId: null, ip: ip(),
        tipoDispositivo: 'DESCONHECIDO', sistema: null, navegador: null, criadoEm: instanteISO(dia + r()),
      })
    }
  }
  // igual ao backend: GET bem-sucedido e rápido não fica registrado
  const registraveis = reqs.filter(q => q.metodo !== 'GET' || q.status >= 400 || q.duracaoMs >= 1000)
  registraveis.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  d.registrosRequisicoes = registraveis.map(q => ({ ...q, id: (d.seq.registrosRequisicoes = (d.seq.registrosRequisicoes ?? 0) + 1) }))
}

// Utilitário exportado para o servidor simulado.
export { decimalParaCentavos }
