# TasKiro — Lab 4: Spec Driven Development

Bem-vindo(a)! Este workspace contém o projeto **TasKiro**, um app full stack construído
com um ecossistema 100% Bun (React 19 + Tailwind v4 + shadcn/ui no front-end, ElysiaJS
e `bun:sqlite` no back-end).

O código da aplicação fica na subpasta **`taskiro/`**. As Specs (requirements, design e
tasks) que guiaram a construção estão em **`.kiro/specs/taskiro-fullstack-migration/`** e
abrem automaticamente no Kiro.

---

## Pré-requisitos

- **Bun** instalado (versão recente). Verifique com:

  ```powershell
  bun --version
  ```

  Se não tiver o Bun, instale com (PowerShell):

  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```

  Caso já tenha o Bun mas em versão antiga, atualize:

  ```powershell
  bun upgrade
  ```

---

## Como subir a aplicação

Todos os comandos abaixo rodam **dentro da subpasta `taskiro/`**, não na raiz do workspace.

1. Entre na subpasta do app:

   ```powershell
   cd taskiro
   ```

2. Instale as dependências (a pasta `node_modules/` não acompanha o projeto e é
   recriada aqui):

   ```powershell
   bun install
   ```

3. Inicie o servidor de desenvolvimento (com hot reload):

   ```powershell
   bun run dev
   ```

4. Abra no navegador:

   ```
   http://localhost:3100
   ```

Para rodar em modo de produção, use `bun run start` no lugar do passo 3.

---

## Credenciais de acesso (conta de demonstração)

Na primeira execução, o banco é populado automaticamente com uma conta de exemplo.
Use estas credenciais para fazer login:

- **E-mail:** `ana@taskiro.app`
- **Senha:** `taskiro123`

Essa conta vem junto com projetos, tarefas e notificações de exemplo já cadastrados.
A senha é apenas para demonstração e fica armazenada com hash (`Bun.password`), nunca
em texto puro.

---

## Banco de dados

O app usa `bun:sqlite`. O arquivo `taskiro.db` é criado automaticamente na primeira
execução e os dados de exemplo são populados sozinhos (seed). Reinícios não duplicam
dados. Não é necessário configurar nada.

> O `JWT_SECRET` possui um valor padrão de desenvolvimento, então a aplicação sobe sem
> nenhuma variável de ambiente. Em um cenário real de produção, defina `JWT_SECRET`.

---

## Estrutura do workspace

```
.
├── .kiro/                  # Specs do Kiro (requirements, design, tasks)
│   └── specs/taskiro-fullstack-migration/
├── README.md               # este guia
└── taskiro/                # código da aplicação (rode os comandos aqui)
    ├── package.json
    ├── src/
    │   ├── backend/        # ElysiaJS + bun:sqlite
    │   └── frontend/       # React + Tailwind + shadcn/ui
    └── ...
```

---

## Comandos úteis (dentro de `taskiro/`)

| Comando         | Descrição                                 |
| --------------- | ----------------------------------------- |
| `bun install`   | Instala as dependências                   |
| `bun run dev`   | Servidor de desenvolvimento (hot reload)  |
| `bun run start` | Servidor em modo de produção              |
| `bun test`      | Executa os testes                         |
