ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_seller_financial_snapshot_required_check"
    CHECK (
      "seller_id" IS NULL OR (
        "commission_rate" IS NOT NULL AND
        "commission_amount" IS NOT NULL AND
        "seller_payout" IS NOT NULL
      )
    ) NOT VALID;
