-- Enforce financial snapshot invariants for new/changed order rows while
-- leaving legacy rows available for audit and repair before validation.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_commission_rate_range_check"
    CHECK ("commission_rate" >= 0 AND "commission_rate" <= 100) NOT VALID,
  ADD CONSTRAINT "orders_commission_amount_nonnegative_check"
    CHECK ("commission_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "orders_seller_payout_nonnegative_check"
    CHECK ("seller_payout" >= 0) NOT VALID,
  ADD CONSTRAINT "orders_discount_within_subtotal_check"
    CHECK ("discount_amount" >= 0 AND "discount_amount" <= "subtotal") NOT VALID,
  ADD CONSTRAINT "orders_commission_excludes_tax_shipping_check"
    CHECK ("commission_amount" <= "subtotal" - "discount_amount") NOT VALID;
