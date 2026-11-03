-- Definicao anterior capturada via MCP, sem dados comerciais.
CREATE OR REPLACE FUNCTION public.atendimento_presencial_criancas_contexto(p_rascunho uuid, p_cliente uuid, p_executor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE r public.atendimento_presencial_atendimentos; papel text;
BEGIN
  SELECT * INTO r FROM public.atendimento_presencial_atendimentos WHERE id=p_rascunho FOR UPDATE;
  SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor AND ativo;
  IF papel IS NULL OR r.id IS NULL OR r.status <> 'rascunho' OR r.expira_em <= now()
    OR r.consultora_usuario_id IS DISTINCT FROM p_executor OR r.cliente_id IS DISTINCT FROM p_cliente
    OR NOT EXISTS (SELECT 1 FROM public.atendimento_presencial_clientes WHERE id=p_cliente AND status='ativo')
    OR NOT EXISTS (SELECT 1 FROM public.app_unidades WHERE id=r.unidade_id AND ativo)
  THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
  IF papel <> 'superadmin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.app_usuarios_unidades WHERE usuario_id=p_executor AND unidade_id=r.unidade_id)
      OR NOT EXISTS (
        SELECT 1 FROM public.app_modulos m
        LEFT JOIN public.app_permissoes_usuario u ON u.modulo_id=m.id AND u.usuario_id=p_executor
        LEFT JOIN public.app_usuarios_perfis up ON up.usuario_id=p_executor
        LEFT JOIN public.app_perfis_acesso perfil ON perfil.id=up.perfil_id AND perfil.ativo
        LEFT JOIN public.app_permissoes_perfil pp ON pp.modulo_id=m.id AND pp.perfil_id=perfil.id
        WHERE m.chave='atendimento_presencial_ficha' AND m.ativo AND NOT m.publico AND NOT m.somente_superadmin
        AND (u.permitido=true OR (u.permitido IS NULL AND pp.permitido=true)))
    THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
  END IF;
END $function$
