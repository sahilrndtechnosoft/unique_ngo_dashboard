import {
  catalog_item_type,
  Prisma,
  PrismaClient,
  reward_activity,
} from '../generated/prisma/client';

export async function seedRewardsAndPartners(prisma: PrismaClient) {
  console.log('Seeding Rewards Rules, Partner Stores, Catalog Items, and Coupons...');

  const adminUser = await prisma.users.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  });
  if (!adminUser) {
    console.warn('  No admin user found to associate with reward rules seed.');
    return;
  }

  // 1. Reward Rules
  const rules = [
    {
      activity: reward_activity.BLOOD_DONATION,
      name: 'Blood Donation Reward',
      description: 'Earn 500 reward points for every successful verified blood donation',
      points: 500,
      multiplier: 1.0,
      max_per_day: 1,
      max_per_month: 1,
      requires_proof: true,
      requires_admin_approval: true,
      is_active: true,
    },
    {
      activity: reward_activity.COMMUNITY_VOLUNTEERING,
      name: 'Community Volunteering',
      description: 'Earn 300 points for participating in registered NGO community drives',
      points: 300,
      multiplier: 1.0,
      max_per_day: 1,
      max_per_month: 4,
      requires_proof: false,
      requires_admin_approval: true,
      is_active: true,
    },
    {
      activity: reward_activity.DONATION_ITEM,
      name: 'Item Donation Contribution',
      description: 'Earn 200 points for approved medical equipment or clothing donations',
      points: 200,
      multiplier: 1.0,
      max_per_day: 3,
      max_per_month: 10,
      requires_proof: true,
      requires_admin_approval: true,
      is_active: true,
    },
    {
      activity: reward_activity.PROFILE_COMPLETION,
      name: 'Profile Completion Bonus',
      description: 'One-time bonus of 100 points for completing your donor profile and blood group',
      points: 100,
      multiplier: 1.0,
      max_lifetime: 1,
      requires_proof: false,
      requires_admin_approval: false,
      is_active: true,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.reward_rules.findFirst({
      where: { activity: rule.activity },
    });
    if (existing) {
      await prisma.reward_rules.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          description: rule.description,
          points: rule.points,
          multiplier: rule.multiplier,
          max_per_day: rule.max_per_day,
          max_per_month: rule.max_per_month,
          max_lifetime: rule.max_lifetime,
          requires_proof: rule.requires_proof,
          requires_admin_approval: rule.requires_admin_approval,
          is_active: rule.is_active,
        },
      });
    } else {
      await prisma.reward_rules.create({
        data: {
          ...rule,
          created_by_id: adminUser.id,
        },
      });
    }
  }
  console.log(`  Reward rules seeded (${rules.length})`);

  // 2. Partner Stores
  const partnersData = [
    {
      name: 'Pizza Hut',
      slug: 'pizza-hut',
      description: 'Delicious pizzas, pasta, wings, and desserts available across India.',
      category: 'FOOD_AND_DINING',
      logo_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop',
      website_url: 'https://www.pizzahut.co.in',
      adapter_type: 'PIZZA_HUT',
      is_active: true,
      config: { api_mode: 'sandbox', brand_code: 'PH-IN' },
    },
    {
      name: 'Apollo Pharmacy',
      slug: 'apollo-pharmacy',
      description: 'India’s largest omnichannel pharmacy network for medicines and wellness essentials.',
      category: 'HEALTH_AND_WELLNESS',
      logo_url: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=200&h=200&fit=crop',
      website_url: 'https://www.apollopharmacy.in',
      adapter_type: 'MOCK',
      is_active: true,
      config: { store_count: 5500 },
    },
    {
      name: 'Subway',
      slug: 'subway',
      description: 'Freshly made subs, salads, and wraps crafted your way.',
      category: 'FOOD_AND_DINING',
      logo_url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=200&h=200&fit=crop',
      website_url: 'https://www.subway.com',
      adapter_type: 'MOCK',
      is_active: true,
      config: { region: 'APAC' },
    },
  ];

  const partners: Record<string, string> = {};
  for (const p of partnersData) {
    const existing = await prisma.partner_stores.findUnique({
      where: { slug: p.slug },
    });
    if (existing) {
      await prisma.partner_stores.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          description: p.description,
          category: p.category,
          logo_url: p.logo_url,
          website_url: p.website_url,
          adapter_type: p.adapter_type,
          is_active: p.is_active,
          config: p.config,
        },
      });
      partners[p.slug] = existing.id;
    } else {
      const created = await prisma.partner_stores.create({ data: p });
      partners[p.slug] = created.id;
    }
  }
  console.log(`  Partner stores seeded (${Object.keys(partners).length})`);

  // 3. Rewards Catalog Items
  const catalogItems = [
    {
      title: '₹200 Pizza Hut Meal Voucher',
      partner_store_id: partners['pizza-hut'],
      description: 'Get ₹200 off your favorite pizza, garlic bread, or beverages at Pizza Hut.',
      image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop',
      category: 'FOOD',
      points_cost: 200,
      monetary_value: new Prisma.Decimal(200),
      item_type: catalog_item_type.PARTNER_VOUCHER,
      stock: 100,
      validity_days: 30,
      min_user_tier: 'BRONZE',
      terms_and_conditions: 'Valid for 30 days from date of redemption. Can be combined with outlet offers.',
      is_active: true,
    },
    {
      title: '₹500 Pizza Hut Feast Voucher',
      partner_store_id: partners['pizza-hut'],
      description: 'Feast like a champion with ₹500 off on any Pizza Hut order above ₹500.',
      image_url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&h=400&fit=crop',
      category: 'FOOD',
      points_cost: 500,
      monetary_value: new Prisma.Decimal(500),
      item_type: catalog_item_type.PARTNER_VOUCHER,
      stock: 50,
      validity_days: 30,
      min_user_tier: 'SILVER',
      terms_and_conditions: 'Exclusive to Silver, Gold, and Platinum tier members.',
      is_active: true,
    },
    {
      title: '₹250 Apollo Health & Wellness Voucher',
      partner_store_id: partners['apollo-pharmacy'],
      description: 'Save ₹250 on essential healthcare, first aid, vitamins, and wellness products.',
      image_url: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600&h=400&fit=crop',
      category: 'HEALTHCARE',
      points_cost: 250,
      monetary_value: new Prisma.Decimal(250),
      item_type: catalog_item_type.PARTNER_VOUCHER,
      stock: 150,
      validity_days: 45,
      min_user_tier: 'BRONZE',
      terms_and_conditions: 'Valid at all Apollo Pharmacy offline stores and Apollo 24/7 online.',
      is_active: true,
    },
    {
      title: '₹150 Subway Fresh Meal Voucher',
      partner_store_id: partners['subway'],
      description: 'Enjoy ₹150 off fresh sandwiches, wraps, and cookies at Subway.',
      image_url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&h=400&fit=crop',
      category: 'FOOD',
      points_cost: 150,
      monetary_value: new Prisma.Decimal(150),
      item_type: catalog_item_type.PARTNER_VOUCHER,
      stock: 80,
      validity_days: 30,
      min_user_tier: 'BRONZE',
      terms_and_conditions: 'Valid across participating Subway restaurants across India.',
      is_active: true,
    },
    {
      title: 'Unique NGO Commemorative T-Shirt',
      partner_store_id: null,
      description: 'Exclusive 100% cotton donor champion T-shirt shipped directly to your address.',
      image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=400&fit=crop',
      category: 'MERCHANDISE',
      points_cost: 350,
      monetary_value: new Prisma.Decimal(350),
      item_type: catalog_item_type.PHYSICAL_PRODUCT,
      stock: 40,
      validity_days: 365,
      min_user_tier: 'BRONZE',
      terms_and_conditions: 'Standard delivery in 5-7 business days across India.',
      is_active: true,
    },
  ];

  for (const item of catalogItems) {
    const existing = await prisma.rewards_catalog_items.findFirst({
      where: { title: item.title },
    });
    if (existing) {
      await prisma.rewards_catalog_items.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.rewards_catalog_items.create({ data: item });
    }
  }
  console.log(`  Catalog items seeded (${catalogItems.length})`);

  // 4. Sample Coupons
  if (adminUser) {
    const sampleCoupons = [
      {
        code: 'WELCOME100',
        description: 'Flat ₹100 off on your first order above ₹499',
        discount_type: 'FLAT',
        discount_value: new Prisma.Decimal(100),
        min_order_value: new Prisma.Decimal(499),
        max_discount: new Prisma.Decimal(100),
        usage_limit: 1000,
        per_user_limit: 1,
        is_active: true,
        applicable_to: 'ALL',
        stacking_allowed: false,
        free_shipping: false,
        created_by_id: adminUser.id,
      },
      {
        code: 'FREESHIP',
        description: 'Free shipping on orders above ₹299',
        discount_type: 'FLAT',
        discount_value: new Prisma.Decimal(0),
        min_order_value: new Prisma.Decimal(299),
        usage_limit: 5000,
        per_user_limit: 3,
        is_active: true,
        applicable_to: 'PRODUCTS',
        stacking_allowed: true,
        free_shipping: true,
        created_by_id: adminUser.id,
      },
      {
        code: 'PIZZAHUT20',
        description: '20% off up to ₹150 on Pizza Hut items',
        discount_type: 'PERCENTAGE',
        discount_value: new Prisma.Decimal(20),
        min_order_value: new Prisma.Decimal(300),
        max_discount: new Prisma.Decimal(150),
        usage_limit: 500,
        per_user_limit: 2,
        is_active: true,
        applicable_to: 'ALL',
        partner_store_id: partners['pizza-hut'],
        stacking_allowed: false,
        free_shipping: false,
        created_by_id: adminUser.id,
      },
    ];

    for (const c of sampleCoupons) {
      const existing = await prisma.coupons.findUnique({ where: { code: c.code } });
      if (existing) {
        await prisma.coupons.update({
          where: { id: existing.id },
          data: c,
        });
      } else {
        await prisma.coupons.create({ data: c });
      }
    }
    console.log(`  Coupons seeded (${sampleCoupons.length})`);
  }
}
