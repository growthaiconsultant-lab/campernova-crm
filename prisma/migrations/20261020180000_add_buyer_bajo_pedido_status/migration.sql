-- COM-8: clasificación activa de compradores que buscan vehículo bajo pedido.
-- Expansión aditiva; no modifica compradores existentes ni sus valores por defecto.
ALTER TYPE "BuyerLeadStatus" ADD VALUE 'BAJO_PEDIDO';
