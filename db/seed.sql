-- =========================================================
-- Dados de exemplo (seed) - DESATIVADO
-- Os INSERTs de clientes/produtos de demonstração foram removidos
-- porque este arquivo roda a cada reinício do servidor (ver
-- startCommand no render.yaml), e sem uma coluna UNIQUE em
-- clientes/produtos o "ON CONFLICT DO NOTHING" não impedia
-- duplicação. A criação do usuário admin continua acontecendo
-- normalmente via scripts/seed.js (essa parte é idempotente).
-- =========================================================

