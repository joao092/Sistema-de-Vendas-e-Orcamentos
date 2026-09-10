-- =========================================================
-- Dados de exemplo (seed) - opcional, apenas para demonstracao
-- A senha do usuario admin sera definida via script Node
-- (scripts/seed.js) usando bcrypt, e nao neste arquivo puro SQL.
-- =========================================================

INSERT INTO clientes (nome, telefone, email, endereco) VALUES
  ('José Ferreira', '(12) 98888-1234', 'jose.ferreira@email.com', 'Rua das Flores, 120'),
  ('Construtora Alvorada', '(12) 3122-4455', 'contato@alvorada.com.br', 'Av. Industrial, 850'),
  ('Marcenaria Bom Corte', '(12) 99777-5566', 'contato@bomcorte.com.br', 'Rua dos Marceneiros, 45')
ON CONFLICT DO NOTHING;

INSERT INTO produtos (nome, categoria, unidade, preco_unitario) VALUES
  ('Parafuso 6mm', 'Ferragens', 'Caixa', 18.50),
  ('Fio Elétrico 2,5mm', 'Elétrica', 'Metro', 3.20),
  ('Torneira Cromada', 'Hidráulica', 'Unidade', 89.90),
  ('Furadeira de Impacto', 'Ferramentas', 'Unidade', 249.00)
ON CONFLICT DO NOTHING;
