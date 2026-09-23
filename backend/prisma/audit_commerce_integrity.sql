-- Read-only audit for relationships enforced by
-- 20260921190000_commerce_referential_integrity.
-- Run with: psql "$DATABASE_URL" -f backend/prisma/audit_commerce_integrity.sql
-- A zero count is required before validating that constraint on historical rows.

SELECT relationship, orphan_rows
FROM (
  SELECT 'commission_settings.category_id -> product_categories.id' AS relationship, count(*) AS orphan_rows
  FROM commission_settings c LEFT JOIN product_categories p ON p.id = c.category_id
  WHERE c.category_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'commission_settings.seller_id -> seller_profiles.id', count(*)
  FROM commission_settings c LEFT JOIN seller_profiles s ON s.id = c.seller_id
  WHERE c.seller_id IS NOT NULL AND s.id IS NULL
  UNION ALL SELECT 'commission_settings.created_by_id -> users.id', count(*)
  FROM commission_settings c LEFT JOIN users u ON u.id = c.created_by_id
  WHERE u.id IS NULL
  UNION ALL SELECT 'coupon_usages.coupon_id -> coupons.id', count(*)
  FROM coupon_usages c LEFT JOIN coupons p ON p.id = c.coupon_id
  WHERE p.id IS NULL
  UNION ALL SELECT 'coupon_usages.user_id -> users.id', count(*)
  FROM coupon_usages c LEFT JOIN users u ON u.id = c.user_id
  WHERE u.id IS NULL
  UNION ALL SELECT 'coupon_usages.order_id -> orders.id', count(*)
  FROM coupon_usages c LEFT JOIN orders o ON o.id = c.order_id
  WHERE c.order_id IS NOT NULL AND o.id IS NULL
  UNION ALL SELECT 'coupons.created_by_id -> users.id', count(*)
  FROM coupons c LEFT JOIN users u ON u.id = c.created_by_id WHERE u.id IS NULL
  UNION ALL SELECT 'delivery_tracking_events.shipment_id -> shipments.id', count(*)
  FROM delivery_tracking_events e LEFT JOIN shipments s ON s.id = e.shipment_id
  WHERE s.id IS NULL
  UNION ALL SELECT 'order_items.order_id -> orders.id', count(*)
  FROM order_items i LEFT JOIN orders o ON o.id = i.order_id WHERE o.id IS NULL
  UNION ALL SELECT 'order_items.product_id -> products.id', count(*)
  FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE p.id IS NULL
  UNION ALL SELECT 'order_items.variant_id -> product_variants.id', count(*)
  FROM order_items i LEFT JOIN product_variants v ON v.id = i.variant_id
  WHERE i.variant_id IS NOT NULL AND v.id IS NULL
  UNION ALL SELECT 'order_items.seller_id -> seller_profiles.id', count(*)
  FROM order_items i LEFT JOIN seller_profiles s ON s.id = i.seller_id
  WHERE i.seller_id IS NOT NULL AND s.id IS NULL
  UNION ALL SELECT 'order_return_items.return_id -> order_returns.id', count(*)
  FROM order_return_items i LEFT JOIN order_returns r ON r.id = i.return_id WHERE r.id IS NULL
  UNION ALL SELECT 'order_return_items.order_item_id -> order_items.id', count(*)
  FROM order_return_items i LEFT JOIN order_items o ON o.id = i.order_item_id WHERE o.id IS NULL
  UNION ALL SELECT 'order_returns.order_id -> orders.id', count(*)
  FROM order_returns r LEFT JOIN orders o ON o.id = r.order_id WHERE o.id IS NULL
  UNION ALL SELECT 'order_returns.buyer_id -> users.id', count(*)
  FROM order_returns r LEFT JOIN users u ON u.id = r.buyer_id WHERE u.id IS NULL
  UNION ALL SELECT 'order_returns.seller_id -> seller_profiles.id', count(*)
  FROM order_returns r LEFT JOIN seller_profiles s ON s.id = r.seller_id
  WHERE r.seller_id IS NOT NULL AND s.id IS NULL
  UNION ALL SELECT 'order_returns.reviewed_by_id -> users.id', count(*)
  FROM order_returns r LEFT JOIN users u ON u.id = r.reviewed_by_id
  WHERE r.reviewed_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'orders.buyer_id -> users.id', count(*)
  FROM orders o LEFT JOIN users u ON u.id = o.buyer_id WHERE o.buyer_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'orders.seller_id -> seller_profiles.id', count(*)
  FROM orders o LEFT JOIN seller_profiles s ON s.id = o.seller_id
  WHERE o.seller_id IS NOT NULL AND s.id IS NULL
  UNION ALL SELECT 'orders.coupon_id -> coupons.id', count(*)
  FROM orders o LEFT JOIN coupons c ON c.id = o.coupon_id
  WHERE o.coupon_id IS NOT NULL AND c.id IS NULL
  UNION ALL SELECT 'orders.created_by_id -> users.id', count(*)
  FROM orders o LEFT JOIN users u ON u.id = o.created_by_id
  WHERE o.created_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'orders.cancelled_by_id -> users.id', count(*)
  FROM orders o LEFT JOIN users u ON u.id = o.cancelled_by_id
  WHERE o.cancelled_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'orders.shipping_address_id -> user_addresses.id', count(*)
  FROM orders o LEFT JOIN user_addresses a ON a.id = o.shipping_address_id
  WHERE o.shipping_address_id IS NOT NULL AND a.id IS NULL
  UNION ALL SELECT 'product_categories.parent_id -> product_categories.id', count(*)
  FROM product_categories c LEFT JOIN product_categories p ON p.id = c.parent_id
  WHERE c.parent_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'product_images.product_id -> products.id', count(*)
  FROM product_images i LEFT JOIN products p ON p.id = i.product_id WHERE p.id IS NULL
  UNION ALL SELECT 'product_inventory_logs.product_id -> products.id', count(*)
  FROM product_inventory_logs i LEFT JOIN products p ON p.id = i.product_id WHERE p.id IS NULL
  UNION ALL SELECT 'product_inventory_logs.variant_id -> product_variants.id', count(*)
  FROM product_inventory_logs i LEFT JOIN product_variants v ON v.id = i.variant_id
  WHERE i.variant_id IS NOT NULL AND v.id IS NULL
  UNION ALL SELECT 'product_inventory_logs.performed_by_id -> users.id', count(*)
  FROM product_inventory_logs i LEFT JOIN users u ON u.id = i.performed_by_id
  WHERE i.performed_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'product_reviews.product_id -> products.id', count(*)
  FROM product_reviews r LEFT JOIN products p ON p.id = r.product_id WHERE p.id IS NULL
  UNION ALL SELECT 'product_reviews.order_id -> orders.id', count(*)
  FROM product_reviews r LEFT JOIN orders o ON o.id = r.order_id
  WHERE r.order_id IS NOT NULL AND o.id IS NULL
  UNION ALL SELECT 'product_reviews.reviewer_id -> users.id', count(*)
  FROM product_reviews r LEFT JOIN users u ON u.id = r.reviewer_id WHERE u.id IS NULL
  UNION ALL SELECT 'product_variants.product_id -> products.id', count(*)
  FROM product_variants v LEFT JOIN products p ON p.id = v.product_id WHERE p.id IS NULL
  UNION ALL SELECT 'products.seller_id -> seller_profiles.id', count(*)
  FROM products p LEFT JOIN seller_profiles s ON s.id = p.seller_id
  WHERE p.seller_id IS NOT NULL AND s.id IS NULL
  UNION ALL SELECT 'products.category_id -> product_categories.id', count(*)
  FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE c.id IS NULL
  UNION ALL SELECT 'products.verified_by_id -> users.id', count(*)
  FROM products p LEFT JOIN users u ON u.id = p.verified_by_id
  WHERE p.verified_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'shipments.order_id -> orders.id', count(*)
  FROM shipments s LEFT JOIN orders o ON o.id = s.order_id WHERE o.id IS NULL
  UNION ALL SELECT 'seller_profiles.user_id -> users.id', count(*)
  FROM seller_profiles s LEFT JOIN users u ON u.id = s.user_id WHERE u.id IS NULL
  UNION ALL SELECT 'seller_profiles.verified_by_id -> users.id', count(*)
  FROM seller_profiles s LEFT JOIN users u ON u.id = s.verified_by_id
  WHERE s.verified_by_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'user_addresses.user_id -> users.id', count(*)
  FROM user_addresses a LEFT JOIN users u ON u.id = a.user_id WHERE u.id IS NULL
) AS audit
ORDER BY relationship;
