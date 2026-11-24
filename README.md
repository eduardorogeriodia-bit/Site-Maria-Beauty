# Studio Maria Beauty

Site estático servido pelo backend Node.js. Os preços, as vendas e as contas administrativas são armazenados em SQLite no arquivo `data/studio-maria-beauty.sqlite` (não versionado).

## Requisitos e execução

- Node.js 22.13 ou superior.
- Execute `npm start` e abra `http://127.0.0.1:3000` no navegador.

Na primeira execução, com o banco ainda vazio, configure a conta inicial no PowerShell e inicie o servidor:

```powershell
$env:ADMIN_INITIAL_USERNAME = "Aglaene"
$env:ADMIN_INITIAL_PASSWORD = Read-Host "Digite a senha inicial"
npm start
```

Informe a senha inicial definida para o projeto. O servidor usa essas variáveis somente para criar o primeiro administrador; no SQLite, a senha é gravada com salt e hash PBKDF2. Depois da criação, as variáveis de ambiente não são necessárias. Se o banco for removido, será necessário repetir o bootstrap.

O acesso ao painel é pelo discreto botão “Área administrativa” no rodapé. O usuário pode alterar a senha no painel informando a senha atual. Preços e vendas são consultados e gravados no banco de dados do servidor.

## Implantação

O banco contém credenciais e registros comerciais: mantenha `data/` fora do Git e configure armazenamento persistente no host. Em produção, use HTTPS, configure `NODE_ENV=production` e restrinja o acesso ao servidor. Este projeto não inclui configuração de hospedagem nem backups automáticos do SQLite.
