---
inclusion: manual
name: code-review
description: Revisão de código completa do app To-Do (qualidade, segurança e acessibilidade)
---

# Revisão de código completa — TasKiro (To-Do)

Faça uma revisão de código abrangente do aplicativo To-Do (diretório `taskiro/`),
cobrindo backend (`src/backend`), frontend (`src/frontend`) e código compartilhado.
Analise o código real dos arquivos antes de reportar; não faça suposições sem ler.

Organize o relatório nas três áreas abaixo. Em cada achado, indique o arquivo e a
linha (quando possível) e classifique a severidade como **Crítico**, **Importante**
ou **Menor**. Não altere arquivos automaticamente — apenas reporte e sugira, a menos
que eu peça explicitamente para aplicar as correções.

## 1. Qualidade de código
- Consistência com os padrões do projeto (nomes, estrutura de pastas, imports).
- Tipagem TypeScript: `any` desnecessário, tipos ausentes, uso de tipos/interfaces.
- Legibilidade, duplicação, código morto, funções muito longas ou complexas.
- Tratamento de erros: try/catch onde apropriado, Promises rejeitadas, validação de
  entradas, erros silenciados e mensagens de erro úteis.
- Edge cases não tratados e potenciais bugs.

## 2. Segurança
- Credenciais, chaves de API, tokens ou senhas hardcoded (devem vir de env).
- Autenticação e autorização: verificação de JWT, escopo de acesso por usuário,
  proteção de rotas e checagem de propriedade dos recursos.
- Validação e sanitização de entradas; risco de injeção (SQL em `bun:sqlite`,
  queries não parametrizadas) e XSS no frontend.
- Exposição de dados sensíveis em respostas, logs ou no bundle do frontend.
- Rate limiting e proteção contra abuso.
- Dependências com versões abertas ou pacotes suspeitos.

## 3. Acessibilidade (frontend React)
- Uso de HTML semântico e landmarks; hierarquia de headings.
- Atributos ARIA corretos e necessários (roles, aria-label, aria-describedby).
- Navegação por teclado: foco visível, ordem de tab, foco em diálogos/modais,
  fechamento com Esc.
- Labels associados a inputs; formulários acessíveis.
- Contraste de cores e não depender só de cor para transmitir informação.
- Textos alternativos para ícones e imagens; nomes acessíveis em botões só de ícone.

## Formato de saída
- Resumo executivo curto no topo (contagem por severidade).
- Achados agrupados pelas três áreas, ordenados por severidade.
- Para cada achado: arquivo:linha, descrição do problema e sugestão de correção.
- Ao final, uma nota de que a validação completa de acessibilidade requer testes
  manuais com tecnologias assistivas e revisão por especialista.
