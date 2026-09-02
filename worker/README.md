# Registro privado de visitas

Este Worker recebe acessos do site, salva os dados no Cloudflare D1 e expõe uma rota privada para revisão.

## 1. Login no Cloudflare

```bash
npx wrangler login
```

## 2. Criar o banco D1

```bash
npx wrangler d1 create midnight_visit_logs
```

Copie o `database_id` retornado e cole em `worker/wrangler.toml`, no lugar de `COLE_AQUI_O_DATABASE_ID_DO_D1`.

## 3. Configurar os segredos

```bash
npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.toml
npx wrangler secret put IP_HASH_SECRET --config worker/wrangler.toml
```

Use valores longos e difíceis de adivinhar. O `ADMIN_TOKEN` é a senha para revisar a lista.

## 4. Aplicar a tabela no banco

```bash
npx wrangler d1 migrations apply midnight_visit_logs --remote --config worker/wrangler.toml
```

## 5. Publicar o Worker

```bash
npx wrangler deploy --config worker/wrangler.toml
```

Depois do deploy, a Cloudflare vai mostrar uma URL parecida com:

```text
https://midnight-visit-logger.seu-usuario.workers.dev
```

## 6. Ligar a coleta no site

Crie um arquivo `.env` na raiz do site com:

```env
PUBLIC_VISIT_LOGGER_ENDPOINT=https://midnight-visit-logger.seu-usuario.workers.dev/visit
```

Depois gere e publique o site novamente:

```bash
npm run build
```

## Revisar a lista

Abra a rota `/admin` do Worker no navegador e digite o valor que você salvou em `ADMIN_TOKEN`.

Exemplo:

```text
https://midnight-visit-logger.seu-usuario.workers.dev/admin
```

O painel mostra os horários em Brasília, separa localização aproximada por IP da localização precisa autorizada e indica se a sessão ainda está aberta, quando teve o último sinal, quanto tempo durou e quando foi fechada. Ele também mostra o tipo de dispositivo e, quando o navegador permitir, o modelo provável do aparelho.

Também dá para revisar via terminal. Troque `SEU_TOKEN` pelo valor que você salvou em `ADMIN_TOKEN`.

```bash
curl -H "Authorization: Bearer SEU_TOKEN" "https://midnight-visit-logger.seu-usuario.workers.dev/admin/visits?limit=100"
```

## Apagar registros antigos

Exemplo para apagar registros com mais de 90 dias:

```bash
curl -X DELETE -H "Authorization: Bearer SEU_TOKEN" "https://midnight-visit-logger.seu-usuario.workers.dev/admin/visits?olderThanDays=90"
```

## Observação de privacidade

O IP e a localização aproximada vêm da conexão e dos dados da Cloudflare. A localização precisa só é enviada quando o visitante toca em permitir e aceita a permissão do navegador; depois disso, novas visitas podem reutilizar a permissão já concedida. IP, localização e informações do dispositivo são dados pessoais em muitos contextos, então mantenha a coleta em uma política de privacidade ou nos termos do site, com finalidade clara como segurança, prevenção de abuso e análise técnica.
