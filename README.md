# Sistema de Gestão — Demonstração

Versão de demonstração do `front-gerenciamento`. Funciona **sem backend e sem login**:
na tela inicial a pessoa escolhe **Entrar como Empresa** ou **Entrar como Administrador**.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5174
```

Para publicar (ex.: Vercel), `npm run build` gera `dist/`. O `vercel.json` já
redireciona todas as rotas para o `index.html`. Não há variáveis de ambiente.

## Como funciona

- As telas são as mesmas do sistema real (cópia de `front-gerenciamento/src`).
- `src/auth/api.ts` não chama a rede: toda requisição vai para
  `src/demo/server.ts`, uma API simulada com as mesmas rotas, regras e respostas do
  backend (`sistema-gerenciamento`): ajuste de saldo do cliente em lançamentos e
  movimentações, bloqueio de exclusões com vínculos, nomes duplicados, filtros do
  extrato, rotas exclusivas do admin, etc.
- `src/demo/db.ts` gera os dados fictícios (3 empresas, clientes/fornecedores,
  produtos, ~6 meses de lançamentos e movimentações, histórico de logins e de
  requisições) e guarda tudo no `localStorage` do navegador.
- Cada visitante tem os próprios dados. O selo **DEMO** (canto inferior direito)
  permite trocar de perfil ou restaurar os dados de exemplo.

## O que dá para mostrar

**Empresa:** dashboard com gráficos, clientes/fornecedores (a pagar / a receber),
categorias, produtos, tipos de conta, lançamentos por mês, movimentações
(entradas/saídas de mercadoria), extrato com filtros, CSV e relatórios em PDF.

**Administrador:** cadastro e desativação de empresas, botão *Acessar* para entrar
nos dados de qualquer empresa (com troca rápida de empresa), registros de login por
dispositivo e registros de requisições (os seus próprios cliques aparecem ali).

## Atualizando a demo quando o sistema mudar

Copie as telas novas de `front-gerenciamento/src` para cá, mantendo:
`src/auth/api.ts`, `src/config.ts`, `src/pages/Login.tsx`, a pasta `src/demo/` e a
linha do `<DemoBadge />` em `src/App.tsx`. Se o backend ganhar rotas novas,
implemente-as em `src/demo/server.ts`. Ao mudar o formato dos dados de exemplo,
aumente `VERSAO` em `src/demo/db.ts` para os navegadores recriarem o seed.
