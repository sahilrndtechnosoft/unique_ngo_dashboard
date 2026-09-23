-- Read-only audit for order and order-item commission/payout snapshots.
-- Review and repair anomalies before validating the corresponding CHECKs.

SELECT invariant, invalid_rows
FROM (
  SELECT 'orders.commission_rate in [0, 100]' AS invariant, count(*) AS invalid_rows
  FROM orders WHERE commission_rate < 0 OR commission_rate > 100
  UNION ALL SELECT 'orders.commission_amount >= 0', count(*)
  FROM orders WHERE commission_amount < 0
  UNION ALL SELECT 'orders.seller_payout >= 0', count(*)
  FROM orders WHERE seller_payout < 0
  UNION ALL SELECT 'orders.discount_amount between 0 and subtotal', count(*)
  FROM orders WHERE discount_amount < 0 OR discount_amount > subtotal
  UNION ALL SELECT 'orders.commission_amount <= subtotal - discount_amount', count(*)
  FROM orders WHERE commission_amount > subtotal - discount_amount
  UNION ALL SELECT 'commission_settings.rate in [0, 100]', count(*)
  FROM commission_settings WHERE rate < 0 OR rate > 100
  UNION ALL SELECT 'product_categories.commission_rate in [0, 100]', count(*)
  FROM product_categories WHERE commission_rate < 0 OR commission_rate > 100
  UNION ALL SELECT 'products.commission_rate in [0, 100]', count(*)
  FROM products WHERE commission_rate < 0 OR commission_rate > 100
  UNION ALL SELECT 'seller_profiles.commission_rate in [0, 100]', count(*)
  FROM seller_profiles WHERE commission_rate < 0 OR commission_rate > 100
  UNION ALL SELECT 'orders.total_amount = subtotal - discount_amount + tax_amount + shipping_fee', count(*)
  FROM orders WHERE total_amount <> subtotal - discount_amount + tax_amount + shipping_fee
  UNION ALL SELECT 'order_items.commission_rate in [0, 100]', count(*)
  FROM order_items WHERE commission_rate < 0 OR commission_rate > 100
  UNION ALL SELECT 'order_items.commission_amount >= 0', count(*)
  FROM order_items WHERE commission_amount < 0
  UNION ALL SELECT 'order_items.seller_payout >= 0', count(*)
  FROM order_items WHERE seller_payout < 0
  UNION ALL SELECT 'seller order items have commission and payout snapshots', count(*)
  FROM order_items WHERE seller_id IS NOT NULL
    AND (commission_rate IS NULL OR commission_amount IS NULL OR seller_payout IS NULL)
  UNION ALL SELECT 'order_items.commission_amount <= total_price - tax_amount', count(*)
  FROM order_items WHERE commission_amount IS NOT NULL
    AND commission_amount > total_price - tax_amount
  UNION ALL SELECT 'seller order item commission + payout = total_price', count(*)
  FROM order_items WHERE seller_id IS NOT NULL
    AND commission_amount IS NOT NULL AND seller_payout IS NOT NULL
    AND commission_amount + seller_payout <> total_price
  UNION ALL SELECT 'admin-owned order items have no seller payout', count(*)
  FROM order_items WHERE seller_id IS NULL AND COALESCE(seller_payout, 0) <> 0
  UNION ALL SELECT 'orders commission_amount equals item snapshots', count(*)
  FROM orders o LEFT JOIN (
    SELECT order_id, sum(COALESCE(commission_amount, 0)) AS amount
    FROM order_items GROUP BY order_id
  ) i ON i.order_id = o.id
  WHERE o.commission_amount <> COALESCE(i.amount, 0)
  UNION ALL SELECT 'orders seller_payout equals item snapshots', count(*)
  FROM orders o LEFT JOIN (
    SELECT order_id, sum(COALESCE(seller_payout, 0)) AS amount
    FROM order_items GROUP BY order_id
  ) i ON i.order_id = o.id
  WHERE o.seller_payout <> COALESCE(i.amount, 0)
) AS audit
ORDER BY invariant;
