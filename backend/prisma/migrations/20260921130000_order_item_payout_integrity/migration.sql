ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_commission_excludes_tax_check"
    CHECK (
      "commission_amount" IS NULL OR
      "commission_amount" <= "total_price" - "tax_amount"
    ) NOT VALID,
  ADD CONSTRAINT "order_items_payout_reconciles_check"
    CHECK (
      "seller_id" IS NULL OR "commission_amount" IS NULL OR "seller_payout" IS NULL OR
      "commission_amount" + "seller_payout" = "total_price"
    ) NOT VALID;
