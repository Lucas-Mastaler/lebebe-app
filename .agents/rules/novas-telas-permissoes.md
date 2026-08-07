# Novas telas e permissões

## Gatilho

Carregue esta regra para: nova página interna, nova sub-rota interna, novo
item de menu/sidebar, nova área administrativa, ou qualquer tela operacional
interna nova ou alterada.

Não se aplica a páginas públicas intencionais já classificadas
`publico = true` em `app_modulos`, nem a webhooks, callbacks OAuth ou crons
(esses seguem seu próprio padrão de segurança).

## Regra

Antes de criar ou alterar uma tela interna, leia e siga por completo o
checklist da seção 3 de `docs/ia/padrao-novas-telas-permissoes.md` —
cadastro em `app_modulos`, proteção com `checkModuleAndWindowAccess`, item
no Sidebar via `NAVIGATION_GROUPS`, proteção da API no backend, e os
redirects corretos (`/acesso-negado`, `/fora-do-horario`, fallback neutro
`/inicio`, nunca `/dashboard`).

Não considere a tela pronta enquanto não estiver cadastrada em
`app_modulos`, protegida pelo wrapper e visível na gestão de perfis
(Superadmin > Perfis).

Este arquivo não repete o checklist — a fonte completa e atualizada é
`docs/ia/padrao-novas-telas-permissoes.md`.
