-- =========================================================
-- Sistema de Vendas e Orcamentos - Ferragens W Guimaraes
-- Modelo Fisico do Banco de Dados (PostgreSQL)
-- Baseado no Modelo Conceitual / Logico definidos no
-- Projeto Integrador VI - Etapas A1 e A2
-- =========================================================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  nivel_acesso VARCHAR(20) NOT NULL DEFAULT 'administrador',
  data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id_cliente SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  telefone VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  endereco VARCHAR(200) NULL,
  data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 3. PRODUTOS
CREATE TABLE IF NOT EXISTS produtos (
  id_produto SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  categoria VARCHAR(80) NULL,
  unidade VARCHAR(20) NOT NULL DEFAULT 'UN',
  preco_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 4. ORCAMENTOS
CREATE TABLE IF NOT EXISTS orcamentos (
  id_orcamento SERIAL PRIMARY KEY,
  id_cliente INTEGER NOT NULL
    REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
  id_usuario INTEGER NOT NULL
    REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  data_orcamento DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  observacao VARCHAR(255) NULL,
  valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  data_criacao TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_status CHECK (status IN ('PENDENTE', 'APROVADO', 'CANCELADO'))
);

-- 5. ITENS DO ORCAMENTO
CREATE TABLE IF NOT EXISTS itens_orcamento (
  id_item SERIAL PRIMARY KEY,
  id_orcamento INTEGER NOT NULL
    REFERENCES orcamentos(id_orcamento) ON DELETE CASCADE,
  id_produto INTEGER NOT NULL
    REFERENCES produtos(id_produto) ON DELETE RESTRICT,
  quantidade NUMERIC(10, 2) NOT NULL CHECK (quantidade > 0),
  valor_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_total_item NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- =========================================================
-- INDICES (performance em buscas frequentes)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data ON orcamentos(data_orcamento);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_itens_orcamento_orcamento ON itens_orcamento(id_orcamento);

-- =========================================================
-- TRIGGER - calcula o valor do item e atualiza o total do orcamento
-- (dispara em INSERT/UPDATE dos itens)
-- =========================================================
CREATE OR REPLACE FUNCTION fn_calcula_item_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_total_item := NEW.quantidade * NEW.valor_unitario;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calcula_item_orcamento ON itens_orcamento;
CREATE TRIGGER trg_calcula_item_orcamento
BEFORE INSERT OR UPDATE ON itens_orcamento
FOR EACH ROW EXECUTE FUNCTION fn_calcula_item_orcamento();

-- =========================================================
-- TRIGGER - recalcula o valor_total do orcamento sempre que um
-- item e inserido, atualizado ou removido (AFTER, para refletir
-- o estado final da tabela de itens)
-- =========================================================
CREATE OR REPLACE FUNCTION fn_atualiza_total_orcamento()
RETURNS TRIGGER AS $$
DECLARE
  v_id_orcamento INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id_orcamento := OLD.id_orcamento;
  ELSE
    v_id_orcamento := NEW.id_orcamento;
  END IF;

  UPDATE orcamentos
  SET valor_total = (
    SELECT COALESCE(SUM(valor_total_item), 0)
    FROM itens_orcamento
    WHERE id_orcamento = v_id_orcamento
  )
  WHERE id_orcamento = v_id_orcamento;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualiza_total_orcamento ON itens_orcamento;
CREATE TRIGGER trg_atualiza_total_orcamento
AFTER INSERT OR UPDATE OR DELETE ON itens_orcamento
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_total_orcamento();

-- =========================================================
-- VIEW - orcamentos pendentes
-- =========================================================
CREATE OR REPLACE VIEW vw_orcamentos_pendentes AS
SELECT
  o.id_orcamento,
  c.nome AS cliente,
  o.data_orcamento,
  o.valor_total
FROM orcamentos o
JOIN clientes c ON c.id_cliente = o.id_cliente
WHERE o.status = 'PENDENTE'
ORDER BY o.data_orcamento DESC;

-- =========================================================
-- VIEW - produtos mais orcados
-- =========================================================
CREATE OR REPLACE VIEW vw_produtos_mais_orcados AS
SELECT
  p.id_produto,
  p.nome,
  SUM(i.quantidade) AS quantidade_total_orcada
FROM itens_orcamento i
JOIN produtos p ON p.id_produto = i.id_produto
GROUP BY p.id_produto, p.nome
ORDER BY quantidade_total_orcada DESC;
