// API simulada da demonstração.
//
// Reproduz as rotas do backend (sistema-gerenciamento) dentro do navegador:
// mesmas URLs, mesmas regras de negócio (ajuste de saldo, validações,
// bloqueios de exclusão) e mesmo formato de resposta. O `fetchComReenvio` do
// app chama `demoFetch` em vez da rede, então nenhuma tela precisou mudar.

import { authStore } from '../auth/store'
import {
  getDB, salvar, proximoId, MAX_REQUISICOES,
  type DB, type Tipo, type Unidade, type Empresa, type FornecedorCliente, type TipoDispositivo,
} from './db'
import {
  parseCentavos, centavosParaDecimal, decimalParaCentavos, multiplicarCentavos,
  MAX_CENTAVOS, MSG_VALOR_INVALIDO,
} from './valores'

// ── Infra ───────────────────────────────────────────────────────────────────

type Body = Record<string, unknown>

interface Req {
  metodo: string
  partes: string[]          // caminho quebrado: '/lancamentos/12' → ['lancamentos', '12']
  query: URLSearchParams
  body: Body
  empresaId: number | null  // tenant resolvido
}

class HttpErro extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

const erro = (status: number, message: string): never => { throw new HttpErro(status, message) }
const agora = () => new Date().toISOString()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function texto(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function idDaRota(p: string | undefined): number {
  const id = Number(p)
  if (!id || isNaN(id)) erro(400, 'ID inválido')
  return id
}

function exigirEmpresa(req: Req): number {
  if (!req.empresaId) erro(400, 'Selecione uma empresa (cabeçalho X-Empresa-Id)')
  return req.empresaId!
}

// ── Informações do aparelho (para os registros do admin) ───────────────────

function aparelhoAtual(): { tipo: TipoDispositivo; sistema: string | null; navegador: string | null } {
  const ua = navigator.userAgent
  const tipo: TipoDispositivo = /iPad|Tablet/i.test(ua) ? 'TABLET'
    : /Mobi|Android|iPhone/i.test(ua) ? 'CELULAR' : 'COMPUTADOR'
  const sistema = /Windows/.test(ua) ? 'Windows'
    : /Android (\d+)/.test(ua) ? `Android ${RegExp.$1}`
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : null
  const m = /(Edg|OPR|Chrome|Firefox|Version)\/(\d+)/.exec(ua)
  const nomes: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Chrome: 'Chrome', Firefox: 'Firefox', Version: 'Safari' }
  const navegador = m ? `${nomes[m[1]]} ${m[2]}` : null
  return { tipo, sistema, navegador }
}

const IP_DEMO = '201.17.88.42'

// Registra um login feito pela tela de entrada da demonstração.
export function registrarLoginDemo(tipo: 'ADMIN' | 'EMPRESA', empresa?: Empresa) {
  const d = getDB()
  const ap = aparelhoAtual()
  d.registrosLogin.push({
    id: proximoId('registrosLogin'),
    tipoAcesso: tipo,
    sucesso: true,
    motivo: null,
    identificador: tipo === 'ADMIN' ? d.admins[0].email : empresa!.email,
    nomeUsuario: tipo === 'ADMIN' ? d.admins[0].email : (empresa!.nomeFantasia ?? empresa!.razaoSocial),
    adminId: tipo === 'ADMIN' ? d.admins[0].id : null,
    empresaId: tipo === 'EMPRESA' ? empresa!.id : null,
    ip: IP_DEMO,
    userAgent: navigator.userAgent,
    tipoDispositivo: ap.tipo,
    sistema: ap.sistema,
    navegador: ap.navegador,
    modelo: null,
    criadoEm: agora(),
  })
  salvar()
}

function registrarRequisicao(d: DB, metodo: string, caminho: string, consulta: string, status: number, duracaoMs: number, empresaId: number | null) {
  const { role, admin } = authStore.getState()
  const ap = aparelhoAtual()
  // rota "modelo": ids numéricos viram :id
  const rota = caminho.replace(/\/\d+(?=\/|$)/g, '/:id')
  d.registrosRequisicoes.push({
    id: proximoId('registrosRequisicoes'),
    metodo,
    caminho,
    rota,
    consulta: consulta || null,
    status,
    duracaoMs,
    tipoAcesso: role,
    adminId: role === 'ADMIN' ? (admin?.id ?? 1) : null,
    empresaId,
    ip: IP_DEMO,
    tipoDispositivo: ap.tipo,
    sistema: ap.sistema,
    navegador: ap.navegador,
    criadoEm: agora(),
  })
  if (d.registrosRequisicoes.length > MAX_REQUISICOES) {
    d.registrosRequisicoes.splice(0, d.registrosRequisicoes.length - MAX_REQUISICOES)
  }
}

// ── Ponto de entrada ────────────────────────────────────────────────────────

export async function demoFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const inicio = performance.now()
  const u = new URL(url, 'http://demo.local')
  const metodo = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  let body: Body = {}
  if (typeof init.body === 'string' && init.body) {
    try { body = JSON.parse(init.body) } catch { body = {} }
  }

  // latência pequena, só para os estados de "carregando" aparecerem
  await sleep(metodo === 'GET' ? 120 + Math.random() * 180 : 200 + Math.random() * 250)

  const d = getDB()
  const { token, role, empresa, selectedEmpresa } = authStore.getState()
  const partes = u.pathname.split('/').filter(Boolean)
  let empresaId: number | null = null
  let status: number
  let resposta: unknown

  try {
    if (!token) erro(401, 'Token não informado')
    if (role === 'EMPRESA') empresaId = empresa?.id ?? null
    else if (role === 'ADMIN') {
      const h = headers.get('X-Empresa-Id')
      empresaId = h ? Number(h) : (selectedEmpresa?.id ?? null)
    }

    const req: Req = { metodo, partes, query: u.searchParams, body, empresaId }
    const r = rotear(d, req)
    status = r[0]
    resposta = r[1]
    if (metodo !== 'GET') salvar()
  } catch (e) {
    if (e instanceof HttpErro) {
      status = e.status
      resposta = { message: e.message }
    } else {
      console.error('[demo] erro na API simulada:', e)
      status = 500
      resposta = { message: 'Erro interno' }
    }
  }

  // Como no backend: consultas (GET) que deram certo em menos de 1 s não são
  // registradas; alterações, erros e consultas lentas sim.
  const recurso = partes[0] ?? ''
  const duracao = Math.round(performance.now() - inicio)
  if (!recurso.startsWith('registros-') && (metodo !== 'GET' || status >= 400 || duracao >= 1000)) {
    const empresaLog = recurso === 'empresas' ? null : empresaId
    registrarRequisicao(d, metodo, u.pathname, u.search.replace(/^\?/, ''), status, duracao, empresaLog)
    salvar()
  }

  return new Response(JSON.stringify(resposta), {
    status,
    statusText: status < 400 ? 'OK' : 'Erro',
    headers: { 'Content-Type': 'application/json' },
  })
}

function rotear(d: DB, req: Req): [number, unknown] {
  const [recurso] = req.partes
  const { role } = authStore.getState()
  const soAdmin = () => { if (role !== 'ADMIN') erro(403, 'Acesso restrito ao administrador') }

  switch (recurso) {
    case 'empresas': soAdmin(); return empresas(d, req)
    case 'registros-login': soAdmin(); return registrosLogin(d, req)
    case 'registros-requisicoes': soAdmin(); return registrosRequisicoes(d, req)
    case 'contas': return cadastroSimples(d, req, 'contas')
    case 'categorias': return cadastroSimples(d, req, 'categorias')
    case 'produtos': return produtos(d, req)
    case 'fornecedores-clientes': return fornecedoresClientes(d, req)
    case 'lancamentos': return lancamentos(d, req)
    case 'movimentacoes': return movimentacoes(d, req)
  }
  return erro(404, 'Rota não encontrada')
}

// ── Saldo ───────────────────────────────────────────────────────────────────

function ajustarSaldo(d: DB, fcId: number, delta: number): FornecedorCliente {
  const fc = d.clientes.find(c => c.id === fcId)!
  fc.saldo = centavosParaDecimal(decimalParaCentavos(fc.saldo) + delta)
  fc.atualizadoEm = agora()
  return fc
}

const efeito = (tipo: Tipo, centavos: number) => (tipo === 'ENTRADA' ? centavos : -centavos)
const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR')

// ── Contas / Categorias ─────────────────────────────────────────────────────

function cadastroSimples(d: DB, req: Req, tabela: 'contas' | 'categorias'): [number, unknown] {
  const empresaId = exigirEmpresa(req)
  const lista = d[tabela]
  const conta = tabela === 'contas'
  const chave = conta ? 'conta' : 'categoria'
  const [, idParam] = req.partes

  if (req.metodo === 'GET' && !idParam) {
    return [200, lista.filter(x => x.empresaId === empresaId).sort(porNome)
      .map(x => (conta ? x : { id: x.id, nome: x.nome }))]
  }

  if (req.metodo === 'POST' && !idParam) {
    const nome = texto(req.body.nome)
    if (!nome) erro(400, conta ? 'O campo nome é obrigatório' : 'O nome da categoria é obrigatório')
    if (lista.some(x => x.empresaId === empresaId && x.nome === nome)) {
      erro(409, conta ? 'Essa conta já existe' : 'Já existe uma categoria com esse nome')
    }
    const novo = { id: proximoId(tabela), nome: nome!, empresaId }
    lista.push(novo)
    return [201, { message: conta ? 'Conta criada com sucesso' : 'Categoria criada com sucesso', [chave]: novo }]
  }

  const id = idDaRota(idParam)
  const item = lista.find(x => x.id === id && x.empresaId === empresaId)

  if (req.metodo === 'PUT') {
    const nome = texto(req.body.nome)
    if (!nome) erro(400, conta ? 'O nome é obrigatório' : 'O nome da categoria é obrigatório')
    if (!item) erro(404, conta ? 'Conta não encontrada' : 'Categoria não encontrada')
    if (lista.some(x => x.empresaId === empresaId && x.nome === nome && x.id !== id)) {
      erro(409, conta ? 'Já existe uma conta com esse nome' : 'Já existe uma categoria com esse nome')
    }
    item!.nome = nome!
    return [200, { message: conta ? 'Conta atualizada com sucesso' : 'Categoria atualizada com sucesso', [chave]: item }]
  }

  if (req.metodo === 'DELETE') {
    if (!item) erro(404, conta ? 'Conta não encontrada' : 'Categoria não encontrada')
    const vinculados = d.lancamentos.some(l => l.empresaId === empresaId && (conta ? l.contaId : l.categoriaId) === id)
    if (vinculados) {
      erro(409, conta
        ? 'Não é possível excluir uma conta que possui lançamentos vinculados'
        : 'Não é possível excluir uma categoria que possui lançamentos vinculados')
    }
    d[tabela] = lista.filter(x => x.id !== id) as never
    return [200, { message: conta ? 'Conta excluída com sucesso' : 'Categoria removida com sucesso' }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Produtos ────────────────────────────────────────────────────────────────

const UNIDADES: Unidade[] = ['KG', 'CAIXA', 'PCT']

function produtos(d: DB, req: Req): [number, unknown] {
  const empresaId = exigirEmpresa(req)
  const [, idParam] = req.partes

  if (req.metodo === 'GET' && !idParam) {
    return [200, d.produtos.filter(p => p.empresaId === empresaId).sort(porNome)
      .map(p => ({ id: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida }))]
  }

  const validar = () => {
    const nome = texto(req.body.nome)
    if (!nome) erro(400, 'O nome do produto é obrigatório')
    const un = req.body.unidadeMedida as Unidade
    if (!UNIDADES.includes(un)) erro(400, 'Unidade de medida inválida. Use KG, CAIXA ou PCT')
    return { nome: nome!, un }
  }

  if (req.metodo === 'POST' && !idParam) {
    const { nome, un } = validar()
    if (d.produtos.some(p => p.empresaId === empresaId && p.nome === nome)) erro(409, 'Já existe um produto com esse nome')
    const produto = { id: proximoId('produtos'), nome, unidadeMedida: un, empresaId, criadoEm: agora(), atualizadoEm: agora() }
    d.produtos.push(produto)
    return [201, { message: 'Produto criado com sucesso', produto }]
  }

  const id = idDaRota(idParam)
  const produto = d.produtos.find(p => p.id === id && p.empresaId === empresaId)

  if (req.metodo === 'PUT') {
    const { nome, un } = validar()
    if (!produto) erro(404, 'Produto não encontrado')
    if (d.produtos.some(p => p.empresaId === empresaId && p.nome === nome && p.id !== id)) erro(409, 'Já existe um produto com esse nome')
    Object.assign(produto!, { nome, unidadeMedida: un, atualizadoEm: agora() })
    return [200, { message: 'Produto atualizado com sucesso', produto }]
  }

  if (req.metodo === 'DELETE') {
    if (!produto) erro(404, 'Produto não encontrado')
    if (d.movimentacoes.some(m => m.produtoId === id && m.empresaId === empresaId)) {
      erro(409, 'Não é possível excluir um produto que possui movimentações vinculadas')
    }
    d.produtos = d.produtos.filter(p => p.id !== id)
    return [200, { message: 'Produto removido com sucesso' }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Fornecedores / Clientes ─────────────────────────────────────────────────

function fornecedoresClientes(d: DB, req: Req): [number, unknown] {
  const empresaId = exigirEmpresa(req)
  const [, idParam] = req.partes
  const MSG_SALDO = `Saldo inválido: ${MSG_VALOR_INVALIDO}`

  if (req.metodo === 'GET' && !idParam) {
    return [200, d.clientes.filter(c => c.empresaId === empresaId).sort(porNome)]
  }

  if (req.metodo === 'GET' && idParam === 'resumo') {
    let receber = 0, pagar = 0
    for (const c of d.clientes) {
      if (c.empresaId !== empresaId) continue
      const s = decimalParaCentavos(c.saldo)
      if (s > 0) pagar += s
      else receber += -s
    }
    return [200, { resumo: { totalReceber: receber / 100, totalPagar: pagar / 100, saldo: (receber - pagar) / 100 } }]
  }

  if (req.metodo === 'POST' && !idParam) {
    const nome = texto(req.body.nome)
    if (!nome) erro(400, 'O nome é obrigatório')
    const s = req.body.saldo
    const temSaldo = s !== undefined && s !== null && s !== ''
    const saldoC = temSaldo ? parseCentavos(s, { permitirNegativo: true }) : 0
    if (temSaldo && saldoC === null) erro(400, MSG_SALDO)
    if (d.clientes.some(c => c.empresaId === empresaId && c.nome === nome)) erro(409, 'Já existe um fornecedor/cliente com esse nome')
    const fornecedorCliente: FornecedorCliente = {
      id: proximoId('clientes'), nome: nome!, saldo: centavosParaDecimal(saldoC ?? 0), ativo: true,
      empresaId, criadoEm: agora(), atualizadoEm: agora(),
    }
    d.clientes.push(fornecedorCliente)
    return [201, { message: 'Fornecedor/cliente criado com sucesso', fornecedorCliente }]
  }

  const id = idDaRota(idParam)
  const fc = d.clientes.find(c => c.id === id && c.empresaId === empresaId)

  if (req.metodo === 'PUT') {
    if (!fc) erro(404, 'Fornecedor/cliente não encontrado')
    const { nome, ativo, saldo, saldoEsperado } = req.body
    let novoSaldo: number | null = null
    if (saldo !== undefined && saldo !== null && saldo !== '') {
      novoSaldo = parseCentavos(saldo, { permitirNegativo: true })
      if (novoSaldo === null) erro(400, MSG_SALDO)
      const esperado = parseCentavos(saldoEsperado, { permitirNegativo: true })
      if (esperado === null) erro(400, 'Para ajustar o saldo, informe também o saldo atual exibido (saldoEsperado)')
      if (esperado !== decimalParaCentavos(fc!.saldo)) {
        erro(409, 'O saldo deste cliente/fornecedor mudou desde que o formulário foi aberto (houve um lançamento ou movimentação). Feche, reabra e confira antes de ajustar.')
      }
    }
    if (nome !== undefined) {
      const n = texto(nome)
      if (!n) erro(400, 'O nome não pode ser vazio')
      if (d.clientes.some(c => c.empresaId === empresaId && c.nome === n && c.id !== id)) erro(409, 'Já existe um fornecedor/cliente com esse nome')
      fc!.nome = n!
    }
    if (ativo !== undefined) fc!.ativo = Boolean(ativo)
    if (novoSaldo !== null) fc!.saldo = centavosParaDecimal(novoSaldo)
    fc!.atualizadoEm = agora()
    return [200, { message: 'Fornecedor/cliente atualizado com sucesso', fornecedorCliente: fc }]
  }

  if (req.metodo === 'DELETE') {
    if (!fc) erro(404, 'Fornecedor/cliente não encontrado')
    const nl = d.lancamentos.filter(l => l.fornecedorClienteId === id).length
    const nm = d.movimentacoes.filter(m => m.fornecedorClienteId === id).length
    if (nl > 0 || nm > 0) {
      const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
      const partes = [
        nl > 0 ? qtd(nl, 'lançamento', 'lançamentos') : null,
        nm > 0 ? qtd(nm, 'movimentação', 'movimentações') : null,
      ].filter(Boolean)
      erro(409, `Não é possível excluir: há ${partes.join(' e ')} deste fornecedor/cliente. Exclua esses registros antes ou inative o cadastro.`)
    }
    d.clientes = d.clientes.filter(c => c.id !== id)
    return [200, { message: 'Fornecedor/cliente removido com sucesso' }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Lançamentos ─────────────────────────────────────────────────────────────

function lancamentoCompleto(d: DB, l: DB['lancamentos'][number]) {
  const fc = d.clientes.find(c => c.id === l.fornecedorClienteId)
  const conta = d.contas.find(c => c.id === l.contaId)
  const cat = d.categorias.find(c => c.id === l.categoriaId)
  return {
    ...l,
    fornecedorCliente: fc ? { id: fc.id, nome: fc.nome, saldo: fc.saldo } : null,
    conta: conta ? { id: conta.id, nome: conta.nome } : null,
    categoria: cat ? { id: cat.id, nome: cat.nome } : null,
  }
}

const maisRecentes = <T extends { id: number }>(campo: keyof T) => (a: T, b: T) =>
  String(b[campo]).localeCompare(String(a[campo])) || b.id - a.id

function lancamentos(d: DB, req: Req): [number, unknown] {
  const empresaId = exigirEmpresa(req)
  const [, idParam] = req.partes
  const daEmpresa = () => d.lancamentos.filter(l => l.empresaId === empresaId)

  if (req.metodo === 'GET' && !idParam) {
    return [200, daEmpresa().sort(maisRecentes('dataLancamento')).map(l => lancamentoCompleto(d, l))]
  }

  if (req.metodo === 'GET' && idParam === 'resumo') {
    let e = 0, s = 0, qe = 0, qs = 0
    for (const l of daEmpresa()) {
      const v = decimalParaCentavos(l.valor)
      if (l.tipo === 'ENTRADA') { e += v; qe++ } else { s += v; qs++ }
    }
    return [200, { resumo: { totalEntradas: e / 100, totalSaidas: s / 100, saldoFinal: (e - s) / 100, quantidadeEntradas: qe, quantidadeSaidas: qs, totalRegistros: qe + qs } }]
  }

  if (req.metodo === 'GET' && idParam === 'filtros') {
    const q = req.query
    const num = (k: string, msg: string) => {
      const v = q.get(k)
      if (v === null || v === '') return null
      if (isNaN(Number(v))) erro(400, msg)
      return Number(v)
    }
    const clienteId = num('clienteId', 'ID do cliente inválido')
    const contaId = num('contaId', 'ID da conta inválido')
    const categoriaId = num('categoriaId', 'ID da categoria inválido')
    const tipo = (q.get('tipo') || 'TODOS').toUpperCase()
    if (!['TODOS', 'ENTRADA', 'SAIDA'].includes(tipo)) erro(400, 'Tipo inválido. Use TODOS, ENTRADA ou SAIDA')
    const dataInicio = q.get('dataInicio') || null
    const dataFim = q.get('dataFim') || null
    const ini = dataInicio ? new Date(`${dataInicio}T00:00:00.000Z`).getTime() : null
    const fim = dataFim ? new Date(`${dataFim}T23:59:59.999Z`).getTime() : null
    if (ini !== null && isNaN(ini)) erro(400, 'Data inicial inválida')
    if (fim !== null && isNaN(fim)) erro(400, 'Data final inválida')
    if (ini !== null && fim !== null && ini > fim) erro(400, 'A data inicial não pode ser maior que a data final')

    const lista = daEmpresa().filter(l => {
      const t = new Date(l.dataLancamento).getTime()
      return (clienteId === null || l.fornecedorClienteId === clienteId)
        && (contaId === null || l.contaId === contaId)
        && (categoriaId === null || l.categoriaId === categoriaId)
        && (tipo === 'TODOS' || l.tipo === tipo)
        && (ini === null || t >= ini)
        && (fim === null || t <= fim)
    }).sort(maisRecentes('dataLancamento'))

    let e = 0, s = 0
    for (const l of lista) {
      const v = decimalParaCentavos(l.valor)
      if (l.tipo === 'ENTRADA') e += v; else s += v
    }
    return [200, {
      filtros: { clienteId, contaId, categoriaId, tipo, dataInicio, dataFim },
      resumo: { totalRegistros: lista.length, totalEntradas: e / 100, totalSaidas: s / 100, saldoCalculado: (e - s) / 100 },
      lancamentos: lista.map(l => {
        const c = lancamentoCompleto(d, l)
        return {
          id: c.id, dataLancamento: c.dataLancamento, tipo: c.tipo, valor: c.valor, classificacao: c.classificacao,
          observacao: c.observacao, fornecedorCliente: c.fornecedorCliente, conta: c.conta, categoria: c.categoria,
        }
      }),
    }]
  }

  const b = req.body
  const pertence = <T extends { id: number; empresaId: number }>(lista: T[], id: unknown, msg: string) => {
    const item = lista.find(x => x.id === Number(id) && x.empresaId === empresaId)
    if (!item) erro(404, msg)
    return item!
  }

  if (req.metodo === 'POST' && !idParam) {
    if (!b.dataLancamento || !b.fornecedorClienteId || !b.tipo || b.valor === undefined || !b.contaId || !b.categoriaId) {
      erro(400, 'Data, fornecedor/cliente, tipo, valor, conta e categoria são obrigatórios')
    }
    if (!['ENTRADA', 'SAIDA'].includes(String(b.tipo))) erro(400, 'Tipo inválido. Use ENTRADA ou SAIDA')
    const valorC = parseCentavos(b.valor)
    if (valorC === null || valorC <= 0) erro(400, `Valor inválido: ${MSG_VALOR_INVALIDO}, maior que zero`)
    const data = new Date(String(b.dataLancamento))
    if (isNaN(data.getTime())) erro(400, 'Data inválida')
    pertence(d.clientes, b.fornecedorClienteId, 'Fornecedor/cliente não encontrado')
    pertence(d.contas, b.contaId, 'Conta não encontrada')
    pertence(d.categorias, b.categoriaId, 'Categoria não encontrada')

    const tipo = b.tipo as Tipo
    const fornecedorCliente = ajustarSaldo(d, Number(b.fornecedorClienteId), efeito(tipo, valorC!))
    const lancamento = {
      id: proximoId('lancamentos'),
      dataLancamento: data.toISOString(),
      tipo,
      valor: centavosParaDecimal(valorC!),
      classificacao: texto(b.classificacao),
      observacao: (b.observacao as string | null) ?? null,
      empresaId,
      fornecedorClienteId: Number(b.fornecedorClienteId),
      contaId: Number(b.contaId),
      categoriaId: Number(b.categoriaId),
      criadoEm: agora(),
      atualizadoEm: agora(),
    }
    d.lancamentos.push(lancamento)
    return [201, { message: 'Lançamento criado com sucesso', lancamento, fornecedorCliente }]
  }

  const id = idDaRota(idParam)

  if (req.metodo === 'DELETE') {
    const l = pertence(d.lancamentos, id, 'Lançamento não encontrado')
    const fornecedorCliente = ajustarSaldo(d, l.fornecedorClienteId, -efeito(l.tipo, decimalParaCentavos(l.valor)))
    d.lancamentos = d.lancamentos.filter(x => x.id !== id)
    return [200, { message: 'Lançamento deletado com sucesso', lancamento: l, fornecedorCliente }]
  }

  if (req.metodo === 'PATCH') {
    if (b.tipo !== undefined && !['ENTRADA', 'SAIDA'].includes(String(b.tipo))) erro(400, 'Tipo inválido. Use ENTRADA ou SAIDA')
    const valorC = b.valor !== undefined ? parseCentavos(b.valor) : undefined
    if (valorC !== undefined && (valorC === null || valorC <= 0)) erro(400, `Valor inválido: ${MSG_VALOR_INVALIDO}, maior que zero`)
    if (b.contaId !== undefined && (b.contaId === null || b.contaId === '' || isNaN(Number(b.contaId)))) erro(400, 'Conta inválida. A conta é obrigatória')
    if (b.categoriaId !== undefined && (b.categoriaId === null || b.categoriaId === '' || isNaN(Number(b.categoriaId)))) erro(400, 'Categoria inválida. A categoria é obrigatória')
    let data: Date | undefined
    if (b.dataLancamento !== undefined) {
      data = new Date(String(b.dataLancamento))
      if (isNaN(data.getTime())) erro(400, 'Data inválida')
    }

    const atual = pertence(d.lancamentos, id, 'Lançamento não encontrado')
    const novoFc = b.fornecedorClienteId !== undefined ? Number(b.fornecedorClienteId) : atual.fornecedorClienteId
    pertence(d.clientes, novoFc, 'Novo fornecedor/cliente não encontrado')
    if (b.contaId !== undefined) pertence(d.contas, b.contaId, 'Conta não encontrada')
    if (b.categoriaId !== undefined) pertence(d.categorias, b.categoriaId, 'Categoria não encontrada')

    ajustarSaldo(d, atual.fornecedorClienteId, -efeito(atual.tipo, decimalParaCentavos(atual.valor)))
    const novoTipo = (b.tipo as Tipo | undefined) ?? atual.tipo
    const novoValor = valorC ?? decimalParaCentavos(atual.valor)
    const fornecedorCliente = ajustarSaldo(d, novoFc, efeito(novoTipo, novoValor))

    if (data) atual.dataLancamento = data.toISOString()
    atual.fornecedorClienteId = novoFc
    atual.tipo = novoTipo
    atual.valor = centavosParaDecimal(novoValor)
    if (b.contaId !== undefined) atual.contaId = Number(b.contaId)
    if (b.categoriaId !== undefined) atual.categoriaId = Number(b.categoriaId)
    if (b.classificacao !== undefined) atual.classificacao = texto(b.classificacao)
    if (b.observacao !== undefined) atual.observacao = (b.observacao as string | null)
    atual.atualizadoEm = agora()
    return [200, { message: 'Lançamento atualizado com sucesso', lancamento: atual, fornecedorCliente }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Movimentações ───────────────────────────────────────────────────────────

const OPCIONAIS = ['valorDetalhado', 'nf', 'motorista', 'veiculo', 'transportadora', 'descricao'] as const
const MSG_TOTAL_GRANDE = 'O total (quantidade × preço) passa do limite de R$ 99.999.999,99'

function movimentacoes(d: DB, req: Req): [number, unknown] {
  const empresaId = exigirEmpresa(req)
  const [, idParam] = req.partes
  const b = req.body

  if (req.metodo === 'GET' && !idParam) {
    return [200, d.movimentacoes.filter(m => m.empresaId === empresaId).sort(maisRecentes('dataMovimento')).map(m => {
      const fc = d.clientes.find(c => c.id === m.fornecedorClienteId)
      const p = d.produtos.find(x => x.id === m.produtoId)
      return {
        id: m.id, dataMovimento: m.dataMovimento, tipo: m.tipo, quantidade: m.quantidade, preco: m.preco, total: m.total,
        valorDetalhado: m.valorDetalhado, nf: m.nf, motorista: m.motorista, veiculo: m.veiculo,
        transportadora: m.transportadora, descricao: m.descricao,
        fornecedorCliente: fc ? { id: fc.id, nome: fc.nome, saldo: fc.saldo } : null,
        produto: p ? { id: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida } : null,
      }
    })]
  }

  if (req.metodo === 'GET' && idParam === 'transportadoras') {
    const nomes = new Set<string>()
    for (const m of d.movimentacoes) if (m.empresaId === empresaId && m.transportadora) nomes.add(m.transportadora)
    return [200, [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }

  const pertence = <T extends { id: number; empresaId: number }>(lista: T[], id: unknown, msg: string) => {
    const item = lista.find(x => x.id === Number(id) && x.empresaId === empresaId)
    if (!item) erro(404, msg)
    return item!
  }

  if (req.metodo === 'POST' && !idParam) {
    if (!b.dataMovimento || !b.fornecedorClienteId || !b.produtoId || !b.tipo || b.quantidade === undefined || b.preco === undefined) {
      erro(400, 'Data, fornecedor/cliente, produto, tipo, quantidade e preço são obrigatórios')
    }
    if (!['ENTRADA', 'SAIDA'].includes(String(b.tipo))) erro(400, 'Tipo inválido. Use ENTRADA ou SAIDA')
    const qtd = parseCentavos(b.quantidade)
    if (qtd === null || qtd <= 0) erro(400, `Quantidade inválida: ${MSG_VALOR_INVALIDO}, maior que zero`)
    const preco = parseCentavos(b.preco)
    if (preco === null || preco <= 0) erro(400, `Preço inválido: ${MSG_VALOR_INVALIDO}, maior que zero`)
    const total = multiplicarCentavos(qtd!, preco!)
    if (total > MAX_CENTAVOS) erro(400, MSG_TOTAL_GRANDE)
    const data = new Date(String(b.dataMovimento))
    if (isNaN(data.getTime())) erro(400, 'Data inválida')
    pertence(d.clientes, b.fornecedorClienteId, 'Fornecedor/cliente não encontrado')
    pertence(d.produtos, b.produtoId, 'Produto não encontrado')

    const tipo = b.tipo as Tipo
    const fornecedorCliente = ajustarSaldo(d, Number(b.fornecedorClienteId), efeito(tipo, total))
    const movimentacao = {
      id: proximoId('movimentacoes'),
      dataMovimento: data.toISOString(),
      tipo,
      quantidade: centavosParaDecimal(qtd!),
      preco: centavosParaDecimal(preco!),
      total: centavosParaDecimal(total),
      valorDetalhado: texto(b.valorDetalhado),
      nf: texto(b.nf),
      motorista: texto(b.motorista),
      veiculo: texto(b.veiculo),
      transportadora: texto(b.transportadora),
      descricao: texto(b.descricao),
      empresaId,
      fornecedorClienteId: Number(b.fornecedorClienteId),
      produtoId: Number(b.produtoId),
      criadoEm: agora(),
      atualizadoEm: agora(),
    }
    d.movimentacoes.push(movimentacao)
    return [201, { message: 'Movimentação criada com sucesso', movimentacao, fornecedorCliente }]
  }

  const id = idDaRota(idParam)

  if (req.metodo === 'DELETE') {
    const m = pertence(d.movimentacoes, id, 'Movimentação não encontrada')
    const fornecedorCliente = ajustarSaldo(d, m.fornecedorClienteId, -efeito(m.tipo, decimalParaCentavos(m.total)))
    d.movimentacoes = d.movimentacoes.filter(x => x.id !== id)
    return [200, { message: 'Movimentação deletada com sucesso', movimentacao: m, fornecedorCliente }]
  }

  if (req.metodo === 'PATCH') {
    if (b.tipo !== undefined && !['ENTRADA', 'SAIDA'].includes(String(b.tipo))) erro(400, 'Tipo inválido. Use ENTRADA ou SAIDA')
    const qtdEnv = b.quantidade !== undefined ? parseCentavos(b.quantidade) : undefined
    if (qtdEnv !== undefined && (qtdEnv === null || qtdEnv <= 0)) erro(400, `Quantidade inválida: ${MSG_VALOR_INVALIDO}, maior que zero`)
    const precoEnv = b.preco !== undefined ? parseCentavos(b.preco) : undefined
    if (precoEnv !== undefined && (precoEnv === null || precoEnv <= 0)) erro(400, `Preço inválido: ${MSG_VALOR_INVALIDO}, maior que zero`)
    let data: Date | undefined
    if (b.dataMovimento !== undefined) {
      data = new Date(String(b.dataMovimento))
      if (isNaN(data.getTime())) erro(400, 'Data inválida')
    }

    const atual = pertence(d.movimentacoes, id, 'Movimentação não encontrada')
    const novoFc = b.fornecedorClienteId !== undefined ? Number(b.fornecedorClienteId) : atual.fornecedorClienteId
    const novoTipo = (b.tipo as Tipo | undefined) ?? atual.tipo
    const novaQtd = qtdEnv ?? decimalParaCentavos(atual.quantidade)
    const novoPreco = precoEnv ?? decimalParaCentavos(atual.preco)
    if (novaQtd <= 0 || novoPreco <= 0) erro(400, 'Quantidade e preço são obrigatórios e devem ser maiores que zero')
    const novoTotal = multiplicarCentavos(novaQtd, novoPreco)
    if (novoTotal > MAX_CENTAVOS) erro(400, MSG_TOTAL_GRANDE)
    pertence(d.clientes, novoFc, 'Novo fornecedor/cliente não encontrado')
    if (b.produtoId !== undefined) pertence(d.produtos, b.produtoId, 'Produto não encontrado')

    ajustarSaldo(d, atual.fornecedorClienteId, -efeito(atual.tipo, decimalParaCentavos(atual.total)))
    const fornecedorCliente = ajustarSaldo(d, novoFc, efeito(novoTipo, novoTotal))

    if (data) atual.dataMovimento = data.toISOString()
    atual.fornecedorClienteId = novoFc
    if (b.produtoId !== undefined) atual.produtoId = Number(b.produtoId)
    atual.tipo = novoTipo
    atual.quantidade = centavosParaDecimal(novaQtd)
    atual.preco = centavosParaDecimal(novoPreco)
    atual.total = centavosParaDecimal(novoTotal)
    for (const campo of OPCIONAIS) if (b[campo] !== undefined) atual[campo] = texto(b[campo])
    atual.atualizadoEm = agora()
    return [200, { message: 'Movimentação atualizada com sucesso', movimentacao: atual, fornecedorCliente }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Empresas (admin) ────────────────────────────────────────────────────────

function empresas(d: DB, req: Req): [number, unknown] {
  const [, idParam] = req.partes
  const b = req.body
  const digitos = (v: unknown) => String(v).replace(/\D/g, '')

  if (req.metodo === 'GET' && !idParam) {
    return [200, [...d.empresas].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'))]
  }

  if (req.metodo === 'POST' && !idParam) {
    if (!b.cnpj || !b.razaoSocial || !b.email || !b.senha) erro(400, 'CNPJ, razão social, e-mail e senha são obrigatórios')
    const cnpj = digitos(b.cnpj)
    if (cnpj.length !== 14) erro(400, 'CNPJ deve conter 14 dígitos')
    const email = String(b.email).trim().toLowerCase()
    if (String(b.senha).length < 6) erro(400, 'A senha deve ter ao menos 6 caracteres')
    if (d.empresas.some(e => e.cnpj === cnpj || e.email === email)) erro(409, 'Já existe uma empresa com esse CNPJ ou e-mail')
    const empresa: Empresa = {
      id: proximoId('empresas'),
      cnpj,
      razaoSocial: String(b.razaoSocial).trim(),
      nomeFantasia: texto(b.nomeFantasia),
      inscricaoEstadual: texto(b.inscricaoEstadual),
      inscricaoMunicipal: texto(b.inscricaoMunicipal),
      endereco: texto(b.endereco),
      email,
      ativo: true,
      criadoEm: agora(),
      atualizadoEm: agora(),
    }
    d.empresas.push(empresa)
    return [201, { message: 'Empresa criada com sucesso', empresa }]
  }

  const id = idDaRota(idParam)
  const empresa = d.empresas.find(e => e.id === id)

  if (req.metodo === 'GET') {
    if (!empresa) erro(404, 'Empresa não encontrada')
    return [200, empresa]
  }

  if (req.metodo === 'PUT') {
    if (!empresa) erro(404, 'Empresa não encontrada')
    const e = empresa!
    if (b.cnpj !== undefined) {
      const cnpj = digitos(b.cnpj)
      if (cnpj.length !== 14) erro(400, 'CNPJ deve conter 14 dígitos')
      if (d.empresas.some(x => x.cnpj === cnpj && x.id !== id)) erro(409, 'Já existe uma empresa com esse CNPJ')
      e.cnpj = cnpj
    }
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase()
      if (!email) erro(400, 'E-mail não pode ser vazio')
      if (d.empresas.some(x => x.email === email && x.id !== id)) erro(409, 'Já existe uma empresa com esse e-mail')
      e.email = email
    }
    if (b.razaoSocial !== undefined) {
      const rs = texto(b.razaoSocial)
      if (!rs) erro(400, 'Razão social não pode ser vazia')
      e.razaoSocial = rs!
    }
    if (b.nomeFantasia !== undefined) e.nomeFantasia = texto(b.nomeFantasia)
    if (b.inscricaoEstadual !== undefined) e.inscricaoEstadual = texto(b.inscricaoEstadual)
    if (b.inscricaoMunicipal !== undefined) e.inscricaoMunicipal = texto(b.inscricaoMunicipal)
    if (b.endereco !== undefined) e.endereco = texto(b.endereco)
    if (b.ativo !== undefined) e.ativo = Boolean(b.ativo)
    if (b.senha !== undefined && String(b.senha).length < 6) erro(400, 'A senha deve ter ao menos 6 caracteres')
    e.atualizadoEm = agora()
    return [200, { message: 'Empresa atualizada com sucesso', empresa: e }]
  }

  if (req.metodo === 'DELETE') {
    if (!empresa) erro(404, 'Empresa não encontrada')
    if (d.lancamentos.some(l => l.empresaId === id)) {
      erro(409, 'Não é possível excluir uma empresa com lançamentos vinculados. Desative-a com ativo=false.')
    }
    d.contas = d.contas.filter(x => x.empresaId !== id)
    d.categorias = d.categorias.filter(x => x.empresaId !== id)
    d.clientes = d.clientes.filter(x => x.empresaId !== id)
    d.produtos = d.produtos.filter(x => x.empresaId !== id)
    d.movimentacoes = d.movimentacoes.filter(x => x.empresaId !== id)
    d.empresas = d.empresas.filter(x => x.id !== id)
    return [200, { message: 'Empresa removida com sucesso' }]
  }

  return erro(404, 'Rota não encontrada')
}

// ── Registros (admin) ───────────────────────────────────────────────────────

function lerData(v: string | null): number | null | undefined {
  if (!v) return undefined
  const t = new Date(v).getTime()
  return isNaN(t) ? null : t
}

function limiteDe(q: URLSearchParams) {
  const n = Number(q.get('limite') ?? 500)
  return Number.isInteger(n) && n > 0 ? Math.min(n, 2000) : 500
}

const resumoEmpresa = (d: DB, id: number | null) => {
  const e = id ? d.empresas.find(x => x.id === id) : null
  return e ? { id: e.id, nomeFantasia: e.nomeFantasia, razaoSocial: e.razaoSocial } : null
}

function registrosLogin(d: DB, req: Req): [number, unknown] {
  const q = req.query
  const de = lerData(q.get('de'))
  const ate = lerData(q.get('ate'))
  if (de === null || ate === null) erro(400, 'Data inválida em de/ate (use ISO 8601)')
  const sucesso = q.get('sucesso')
  const tipoAcesso = q.get('tipoAcesso')
  const tipoDispositivo = q.get('tipoDispositivo')
  const empresaId = q.get('empresaId') ? Number(q.get('empresaId')) : null
  const busca = (q.get('busca') ?? '').trim().toLowerCase()

  const filtrados = d.registrosLogin.filter(r => {
    const t = new Date(r.criadoEm).getTime()
    if (de !== undefined && t < de!) return false
    if (ate !== undefined && t > ate!) return false
    if (sucesso === 'true' && !r.sucesso) return false
    if (sucesso === 'false' && r.sucesso) return false
    if (tipoAcesso && r.tipoAcesso !== tipoAcesso) return false
    if (tipoDispositivo && r.tipoDispositivo !== tipoDispositivo) return false
    if (empresaId && r.empresaId !== empresaId) return false
    if (busca) {
      const alvo = [r.identificador, r.nomeUsuario, r.ip, r.sistema, r.navegador, r.modelo].join(' ').toLowerCase()
      if (!alvo.includes(busca)) return false
    }
    return true
  })
  filtrados.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id - a.id)

  const porDispositivo = { COMPUTADOR: 0, CELULAR: 0, TABLET: 0, DESCONHECIDO: 0 }
  let ok = 0
  for (const r of filtrados) { porDispositivo[r.tipoDispositivo]++; if (r.sucesso) ok++ }
  const limite = limiteDe(q)
  return [200, {
    registros: filtrados.slice(0, limite).map(r => ({ ...r, empresa: resumoEmpresa(d, r.empresaId) })),
    total: filtrados.length,
    limite,
    resumo: { sucesso: ok, falhas: filtrados.length - ok, porDispositivo },
  }]
}

function registrosRequisicoes(d: DB, req: Req): [number, unknown] {
  const q = req.query
  const de = lerData(q.get('de'))
  const ate = lerData(q.get('ate'))
  if (de === null || ate === null) erro(400, 'Data inválida em de/ate (use ISO 8601)')
  const metodo = (q.get('metodo') ?? '').toUpperCase()
  const status = (q.get('status') ?? '').toLowerCase()
  const tipoAcesso = (q.get('tipoAcesso') ?? '').toUpperCase()
  const empresaId = q.get('empresaId') ? Number(q.get('empresaId')) : null
  const lentas = q.get('lentas') === 'true'
  const busca = (q.get('busca') ?? '').trim().toLowerCase()

  const statusOk = (s: number) => {
    if (!status) return true
    const faixa = /^([2-5])xx$/.exec(status)
    if (faixa) return Math.floor(s / 100) === Number(faixa[1])
    if (status === 'erros') return s >= 400
    if (/^\d{3}$/.test(status)) return s === Number(status)
    return erro(400, 'status inválido')
  }

  const filtrados = d.registrosRequisicoes.filter(r => {
    const t = new Date(r.criadoEm).getTime()
    if (de !== undefined && t < de!) return false
    if (ate !== undefined && t > ate!) return false
    if (metodo === 'ALTERACOES' ? r.metodo === 'GET' : metodo && r.metodo !== metodo) return false
    if (!statusOk(r.status)) return false
    if (tipoAcesso === 'ANONIMO' ? r.tipoAcesso !== null : tipoAcesso && r.tipoAcesso !== tipoAcesso) return false
    if (empresaId && r.empresaId !== empresaId) return false
    if (lentas && r.duracaoMs < 1000) return false
    if (busca && !`${r.caminho} ${r.consulta ?? ''} ${r.ip ?? ''}`.toLowerCase().includes(busca)) return false
    return true
  })
  filtrados.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id - a.id)

  const porClasse = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }
  let soma = 0
  for (const r of filtrados) {
    const c = `${Math.floor(r.status / 100)}xx` as keyof typeof porClasse
    if (c in porClasse) porClasse[c]++
    soma += r.duracaoMs
  }
  const limite = limiteDe(q)
  return [200, {
    registros: filtrados.slice(0, limite).map(r => ({
      ...r,
      empresa: resumoEmpresa(d, r.empresaId),
      admin: r.adminId ? { id: r.adminId, email: d.admins[0].email } : null,
    })),
    total: filtrados.length,
    limite,
    resumo: { porClasse, duracaoMediaMs: filtrados.length ? Math.round(soma / filtrados.length) : 0 },
  }]
}
