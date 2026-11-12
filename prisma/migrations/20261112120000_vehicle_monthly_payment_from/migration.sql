-- An advertised instalment is optional and must be positive when set.
ALTER TABLE "vehicles"
    ADD COLUMN "monthly_payment_from" DECIMAL(10,2),
    ADD CONSTRAINT "vehicles_monthly_payment_from_positive" CHECK ("monthly_payment_from" > 0);
