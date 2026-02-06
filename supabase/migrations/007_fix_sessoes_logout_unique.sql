-- Adicionar constraint UNIQUE na coluna email para permitir upsert com onConflict
ALTER TABLE sessoes_logout_automatico
ADD CONSTRAINT sessoes_logout_automatico_email_key UNIQUE (email);
