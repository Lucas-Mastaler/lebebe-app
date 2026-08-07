---
name: executar-plano
description: "Use para implementar um plano já aprovado (de criar-plano, de um Projeto Multifase, ou combinado diretamente com o usuário) sem reabrir investigação ou planejamento já feitos. NÃO use quando ainda não existe plano nem diagnóstico claro — nesse caso use auditar-tarefa/criar-plano primeiro."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Executar Plano

O ponto central desta skill é economia: quando já existe investigação
suficiente e plano aprovado, execute — não reinicie o projeto do zero.

## Antes de executar

Valide só isto, sem repetir auditoria ampla "por segurança genérica":

- o plano ainda corresponde ao código real (checagem pontual, não releitura
  completa);
- não surgiu bloqueio novo desde a aprovação;
- não há contradição relevante entre plano e estado atual;
- a(s) rule(s) contextual(is) necessária(s) para os arquivos do plano estão
  carregadas (`AGENTS.md` §7).

## Durante a execução

- Siga as etapas do plano na ordem.
- Faça a menor alteração capaz de cumprir cada etapa.
- Não faça refactor paralelo, renomeação por estética, ou "aproveitar e
  arrumar" fora do escopo (`AGENTS.md` §3).
- Rode validações proporcionais à medida que etapas fecham (`AGENTS.md`
  §5) — não acumule tudo para o fim.
- Marque checkboxes do plano só quando a etapa estiver realmente concluída
  e validada, não como intenção.

## Desvio do plano

Só ocorre com evidência concreta (não suposição, não preferência estética):

1. Interrompa a etapa afetada.
2. Documente o problema encontrado (o que diverge e onde).
3. Avalie se é um ajuste técnico sem impacto no escopo aprovado — se for,
   siga e registre a nota.
4. Se o desvio alteraria regra de negócio ou escopo aprovado, **não decida
   sozinho**: pare e reporte ao usuário.
5. Se a tarefa pertence a um Projeto Multifase, registre o achado conforme
   `.agents/skills/projeto-multifase/SKILL.md` (pendência em `STATUS.md`,
   nunca resolução unilateral de escopo).

## Output

Ao terminar:

- alterações feitas (diff real, não resumo vago);
- arquivos tocados;
- etapas do plano concluídas vs. pendentes;
- validações executadas e resultado;
- problemas encontrados (se houver);
- recomendação explícita: seguir para `.agents/skills/validar-entrega/SKILL.md`.

Não faça auditoria pós-implementação completa aqui — isso é
responsabilidade de `validar-entrega`.

## Esforço recomendado

Baixo/médio quando o plano é claro e controlado; médio para implementação
com várias partes móveis; alto só se surgir dificuldade técnica real
durante a execução.
