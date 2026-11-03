-- Somente substitui a verificacao de contexto; preserva dados, assinatura e ACL.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$ BEGIN
 IF (SELECT md5(replace(prosrc,chr(13),'')) FROM pg_proc WHERE oid='public.atendimento_presencial_criancas_contexto(uuid,uuid,uuid)'::regprocedure)
 IS DISTINCT FROM '88dc113dd90f48738d87691ddd5fa85b' THEN RAISE EXCEPTION 'contexto_definicao_divergente'; END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_criancas_contexto(p_rascunho uuid, p_cliente uuid, p_executor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE r public.atendimento_presencial_atendimentos; papel text; perfil_chave text; perfis integer;
BEGIN
  SELECT * INTO r FROM public.atendimento_presencial_atendimentos WHERE id=p_rascunho FOR UPDATE;
  SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor AND ativo;
  IF papel IS NULL OR r.id IS NULL OR r.status <> 'rascunho' OR r.expira_em <= now()
    OR r.cliente_id IS DISTINCT FROM p_cliente
    OR NOT EXISTS (SELECT 1 FROM public.atendimento_presencial_clientes WHERE id=p_cliente AND status='ativo')
    OR NOT EXISTS (SELECT 1 FROM public.app_unidades WHERE id=r.unidade_id AND ativo)
  THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
  IF papel <> 'superadmin' THEN
    -- Mesma politica de usuarioPodeAcessarRascunho: consultora apenas propria;
    -- demais perfis ativos dependem de unidade e modulo.
    SELECT min(p.chave), count(*) INTO perfil_chave, perfis
    FROM public.app_usuarios_perfis v JOIN public.app_perfis_acesso p ON p.id=v.perfil_id AND p.ativo
    WHERE v.usuario_id=p_executor;
    IF perfis <> 1 OR (perfil_chave='consultora' AND r.consultora_usuario_id IS DISTINCT FROM p_executor)
    THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
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
