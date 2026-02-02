-- Migration: Adicionar campos para rastreamento de convites
-- Previne reenvio acidental e permite throttle de 60 segundos

-- 1. Adicionar campos na tabela usuarios_permitidos
ALTER TABLE usuarios_permitidos
ADD COLUMN IF NOT EXISTS last_invite_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invite_status TEXT CHECK (invite_status IN ('sent', 'accepted', 'expired', 'failed'));

-- 2. Criar índice para otimizar consultas por status e data
CREATE INDEX IF NOT EXISTS idx_usuarios_permitidos_invite_status 
ON usuarios_permitidos(invite_status);

CREATE INDEX IF NOT EXISTS idx_usuarios_permitidos_last_invite_sent_at 
ON usuarios_permitidos(last_invite_sent_at);

-- 3. Comentários explicativos
COMMENT ON COLUMN usuarios_permitidos.last_invite_sent_at IS 
'Timestamp do último envio de convite. Usado para throttle de 60s e auditoria.';

COMMENT ON COLUMN usuarios_permitidos.invite_status IS 
'Status do convite: sent (enviado), accepted (usuário definiu senha), expired (link expirou), failed (erro no envio).';

-- 4. Atualizar registros existentes (usuários criados antes desta migration)
-- Marcar como 'accepted' se foram criados há mais de 1 dia (assumindo que já definiram senha)
UPDATE usuarios_permitidos 
SET invite_status = 'accepted'
WHERE invite_status IS NULL 
  AND created_at < NOW() - INTERVAL '1 day';

-- 5. Função helper para verificar se pode reenviar convite (throttle de 60s)
CREATE OR REPLACE FUNCTION can_resend_invite(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_sent TIMESTAMPTZ;
BEGIN
  SELECT last_invite_sent_at INTO v_last_sent
  FROM usuarios_permitidos
  WHERE email = LOWER(TRIM(p_email));
  
  -- Se nunca foi enviado, pode enviar
  IF v_last_sent IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Se foi enviado há mais de 60 segundos, pode reenviar
  RETURN (NOW() - v_last_sent) > INTERVAL '60 seconds';
END;
$$;

COMMENT ON FUNCTION can_resend_invite IS 
'Verifica se pode reenviar convite (throttle de 60 segundos).';
