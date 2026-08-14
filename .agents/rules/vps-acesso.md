# Acesso à VPS

## Gatilho

Carregue esta regra sempre que a tarefa exigir inspecionar, diagnosticar ou
validar algo que roda na VPS de produção: workers Python, serviços Docker
Swarm (Easypanel), cron jobs, containers, logs de runtime fora da Vercel/
Supabase.

## Acesso

- Host: `72.60.252.7` (hostname interno `srv1055297`)
- Usuário: `root`
- Autenticação: chave SSH já configurada localmente em
  `~/.ssh/id_ed25519_codex_vps` (não versionada, não deve ser copiada para
  o repositório nem para nenhum artefato persistente)
- Comando de conexão:

  ```
  ssh -i ~/.ssh/id_ed25519_codex_vps -o BatchMode=yes -o ConnectTimeout=8 root@72.60.252.7 "<comando>"
  ```

Esse acesso já está autorizado para uso operacional (diagnóstico, leitura de
logs, verificação de estado de serviços). Não é necessário perguntar ao
usuário se o acesso existe ou pedir confirmação para conectar — apenas usar.
Se a conexão falhar por motivo técnico (rede, chave, timeout), reporte o
erro real; não reporte "não tenho acesso à VPS".

## O que roda lá

- Orquestração via Docker Swarm, gerenciado pelo Easypanel.
- Serviços relevantes ao Le Bébé App incluem `lebebe_sgi_worker` (worker
  Python que consome a fila de integração SGI do Lebebe Exclusive — ver
  `.agents/rules/README.md` e `src/lib/pedidos-personalizados/server/`) e o
  cron do Hub Vendas (`/opt/hub-vendas-cron/executar-rota.sh`, ver
  `src/lib/digisac/hub-vendas/cron-schedule.ts`).
- Scripts Python de automação ficam em `/workspace/**/scripts/` dentro dos
  containers relevantes (ex.: `/workspace/erp-capturador/scripts/`).

## Comandos úteis (somente leitura, seguros por padrão)

```
docker service ls
docker service ps <nome_do_service> --no-trunc
docker service logs <nome_do_service> --since <janela> --timestamps
docker inspect <container_id> --format '{{.State.StartedAt}} restarts={{.RestartCount}}'
docker exec <container_id> <comando>
```

## Limites

- Ações somente leitura (`ps`, `logs`, `inspect`, `exec` para diagnóstico)
  podem ser usadas livremente para investigação.
- Qualquer ação que altere estado na VPS (restart de serviço, deploy,
  alteração de env/secret, escalar réplicas, editar arquivo, matar
  processo) segue a regra geral de ações arriscadas: sempre confirmar com o
  usuário antes, mesmo com o acesso disponível.
- Nunca exponha o conteúdo da chave privada, tokens ou secrets lidos de
  containers/env em nenhum artefato persistente (memória, docs, commits).
