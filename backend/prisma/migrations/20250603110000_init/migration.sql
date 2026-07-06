-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "alert_recipient_status" AS ENUM ('NOTIFIED', 'ACKNOWLEDGED', 'RESPONDED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "approval_entity_type" AS ENUM ('BLOOD_DONATION', 'BLOOD_REQUEST', 'PRODUCT', 'SELLER_PROFILE', 'BLOG', 'CAMPAIGN', 'REWARD_CLAIM', 'RENTAL', 'DONATION_ITEM', 'EQUIPMENT', 'COMMUNITY_GROUP', 'Q&A_QUESTION');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED');

-- CreateEnum
CREATE TYPE "area_status" AS ENUM ('ACTIVE', 'INACTIVE', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('EMAIL', 'MOBILE_OTP', 'GOOGLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "blog_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "blood_group" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "blood_request_status" AS ENUM ('OPEN', 'FULFILLED', 'PARTIALLY_FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "campaign_type" AS ENUM ('BLOOD', 'DONATION', 'AWARENESS', 'EMERGENCY', 'MEDICAL', 'FUNDRAISING');

-- CreateEnum
CREATE TYPE "conversation_type" AS ENUM ('DIRECT', 'GROUP', 'SUPPORT', 'CAMPAIGN', 'CHANNEL');

-- CreateEnum
CREATE TYPE "donation_item_condition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "donation_item_status" AS ENUM ('AVAILABLE', 'REQUESTED', 'APPROVED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "donation_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "equipment_condition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "feature_flag_status" AS ENUM ('ENABLED', 'DISABLED', 'BETA', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "group_member_role" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "group_member_status" AS ENUM ('ACTIVE', 'PENDING', 'BANNED', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "group_privacy" AS ENUM ('PUBLIC', 'PRIVATE', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED', 'PENDING');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'SYSTEM', 'STICKER', 'BLOOD_REQUEST', 'SOS_ALERT');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('ORDER', 'DELIVERY', 'PAYMENT', 'REWARD', 'CAMPAIGN', 'BLOOD_REQUEST', 'RENTAL', 'SUPPORT', 'COMMUNITY', 'CHAT', 'SYSTEM', 'PREMIUM', 'SOS', 'SAFETY');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('REGISTRATION', 'LOGIN', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION', 'TRANSACTION', 'SOS');

-- CreateEnum
CREATE TYPE "participant_status" AS ENUM ('REGISTERED', 'CONFIRMED', 'ATTENDED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('UPI', 'CARD', 'NET_BANKING', 'WALLET', 'COD', 'REWARD_POINTS', 'SUBSCRIPTION', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "payment_purpose" AS ENUM ('ORDER', 'RENTAL', 'SUBSCRIPTION', 'DONATION', 'CAMPAIGN', 'REWARD_REDEMPTION', 'SECURITY_DEPOSIT');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "post_status" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "question_status" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED', 'PENDING_REVIEW', 'REMOVED');

-- CreateEnum
CREATE TYPE "rental_status" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'OVERDUE', 'RETURNED', 'CANCELLED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'VIOLENCE', 'NUDITY', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "return_condition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "return_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'REFUND_INITIATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "reward_activity" AS ENUM ('BLOOD_DONATION', 'BLOOD_REQUEST_FULFILLMENT', 'CAMPAIGN_PARTICIPATION', 'PRODUCT_DONATION', 'DONATION_ITEM_DONATION', 'EQUIPMENT_SUPPORT', 'COMMUNITY_POST', 'REFERRAL', 'PROFILE_COMPLETION', 'FIRST_PURCHASE', 'REVIEW_SUBMISSION', 'SOS_RESPONSE', 'BLOG_CREATION', 'QA_ANSWER');

-- CreateEnum
CREATE TYPE "reward_claim_status" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CREDITED');

-- CreateEnum
CREATE TYPE "reward_transaction_type" AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED', 'BONUS', 'REVERSED');

-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "shipping_type" AS ENUM ('STANDARD', 'EXPRESS', 'SAME_DAY', 'PICKUP');

-- CreateEnum
CREATE TYPE "sos_status" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'FALSE_ALARM');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "urgency_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'SELLER', 'PREMIUM_USER', 'PREMIUM_SELLER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION');

-- CreateTable
CREATE TABLE "area_postal_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_area_id" UUID NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "locality" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_postal_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" VARCHAR(255),
    "device_name" VARCHAR(255),
    "device_type" VARCHAR(100),
    "os" VARCHAR(100),
    "app_version" VARCHAR(50),
    "ip_address" INET,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_ip" INET,
    "replaced_by_session_id" UUID,
    "revoke_reason" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_admin_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_compatibility" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_group" "blood_group" NOT NULL,
    "recipient_group" "blood_group" NOT NULL,
    "is_compatible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "blood_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donation_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blood_request_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "units_pledged" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "status" "donation_status" NOT NULL DEFAULT 'PENDING',
    "response_note" TEXT,
    "donation_date" DATE,
    "donation_id" UUID,
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_donation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_id" UUID NOT NULL,
    "blood_group" "blood_group" NOT NULL,
    "donation_date" DATE NOT NULL,
    "donation_center" VARCHAR(255),
    "hospital_name" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "units_donated" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "status" "donation_status" NOT NULL DEFAULT 'PENDING',
    "proof_image_url" TEXT,
    "notes" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "certificate_url" TEXT,
    "is_camp_donation" BOOLEAN NOT NULL DEFAULT false,
    "campaign_id" UUID,
    "reward_claimed" BOOLEAN NOT NULL DEFAULT false,
    "reward_claim_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "blood_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donor_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "blood_group" "blood_group" NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "total_donations" INTEGER NOT NULL DEFAULT 0,
    "last_donation_date" DATE,
    "next_eligible_date" DATE,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "medical_conditions" TEXT,
    "currently_on_meds" BOOLEAN NOT NULL DEFAULT false,
    "preferred_city" VARCHAR(100),
    "preferred_state" VARCHAR(100),
    "notify_nearby" BOOLEAN NOT NULL DEFAULT true,
    "radius_km" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_donor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "patient_name" VARCHAR(255) NOT NULL,
    "blood_group" "blood_group" NOT NULL,
    "units_required" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "units_fulfilled" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "urgency" "urgency_level" NOT NULL DEFAULT 'MEDIUM',
    "hospital_name" VARCHAR(255) NOT NULL,
    "hospital_address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_mobile" VARCHAR(20) NOT NULL,
    "required_by_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "blood_request_status" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "admin_note" TEXT,
    "verified_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_at_add" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "session_id" VARCHAR(255),
    "coupon_code" VARCHAR(100),
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "seller_id" UUID,
    "rate" DECIMAL(5,2) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "effective_to" DATE,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "discount" DECIMAL(12,2) NOT NULL,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "discount_type" VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    "discount_value" DECIMAL(10,2) NOT NULL,
    "min_order_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "max_discount" DECIMAL(12,2),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applicable_to" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_fees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_area_id" UUID NOT NULL,
    "shipping_type" "shipping_type" NOT NULL DEFAULT 'STANDARD',
    "min_order_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_free_above" DECIMAL(12,2),
    "estimated_days" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tracking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "status" VARCHAR(100) NOT NULL,
    "location" VARCHAR(255),
    "description" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "device_id" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "certificate_no" VARCHAR(100) NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_url" TEXT NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_item_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_item_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_item_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_item_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "quantity_needed" INTEGER NOT NULL DEFAULT 1,
    "purpose" TEXT NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_item_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID,
    "condition" "donation_item_condition" NOT NULL DEFAULT 'GOOD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "donation_item_status" NOT NULL DEFAULT 'AVAILABLE',
    "pickup_city" VARCHAR(100) NOT NULL,
    "pickup_state" VARCHAR(100) NOT NULL,
    "pickup_address" TEXT,
    "is_pickup_only" BOOLEAN NOT NULL DEFAULT true,
    "admin_note" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "donation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donation_item_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "transfer_date" DATE,
    "proof_image_url" TEXT,
    "donor_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "recipient_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "admin_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "relation" VARCHAR(100) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_sos" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "owner_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "brand" VARCHAR(255),
    "model" VARCHAR(255),
    "serial_number" VARCHAR(255),
    "condition" "equipment_condition" NOT NULL DEFAULT 'GOOD',
    "daily_rate" DECIMAL(10,2) NOT NULL,
    "weekly_rate" DECIMAL(10,2),
    "monthly_rate" DECIMAL(10,2),
    "security_deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_rental_days" INTEGER NOT NULL DEFAULT 1,
    "max_rental_days" INTEGER NOT NULL DEFAULT 90,
    "total_quantity" INTEGER NOT NULL DEFAULT 1,
    "available_quantity" INTEGER NOT NULL DEFAULT 1,
    "rented_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "requires_training" BOOLEAN NOT NULL DEFAULT false,
    "training_notes" TEXT,
    "service_area_id" UUID,
    "pickup_available" BOOLEAN NOT NULL DEFAULT false,
    "delivery_available" BOOLEAN NOT NULL DEFAULT true,
    "weight_kg" DECIMAL(8,2),
    "dimensions" JSONB,
    "specifications" JSONB,
    "admin_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "available_qty" INTEGER NOT NULL DEFAULT 0,
    "booked_qty" INTEGER NOT NULL DEFAULT 0,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,

    CONSTRAINT "equipment_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "image_url" TEXT,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_maintenance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "maintenance_type" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "performed_by" VARCHAR(255),
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "cost" DECIMAL(10,2),
    "next_due_date" DATE,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "banner_url" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featured_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_number" VARCHAR(100) NOT NULL,
    "payment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "billing_name" VARCHAR(255) NOT NULL,
    "billing_address" TEXT NOT NULL,
    "billing_gst" VARCHAR(50),
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "performed_by_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "duration_days" INTEGER NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'PREMIUM_USER',
    "features" JSONB NOT NULL DEFAULT '[]',
    "max_products" INTEGER,
    "commission_rate" DECIMAL(5,2),
    "reward_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'PENDING',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "payment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "seller_id" UUID NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "variant_name" VARCHAR(255),
    "sku" VARCHAR(255),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(12,2) NOT NULL,
    "image_url" TEXT,
    "is_returnable" BOOLEAN NOT NULL DEFAULT true,
    "return_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "condition" "return_condition",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "return_request_status" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB,
    "refund_amount" DECIMAL(12,2),
    "refund_method" "payment_method",
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(100) NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reward_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "payment_status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "coupon_id" UUID,
    "coupon_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_address_id" UUID NOT NULL,
    "shipping_type" "shipping_type" NOT NULL DEFAULT 'STANDARD',
    "estimated_delivery" DATE,
    "notes" TEXT,
    "cancel_reason" TEXT,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "commission_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "seller_payout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payout_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "payout_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" VARCHAR(255) NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "payment_status" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "payment_method" NOT NULL,
    "gateway" VARCHAR(100),
    "response" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "ip_address" INET,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "payment_purpose" NOT NULL,
    "reference_type" VARCHAR(100) NOT NULL,
    "reference_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "gateway" VARCHAR(100),
    "gateway_order_id" VARCHAR(255),
    "gateway_payment_id" VARCHAR(255),
    "gateway_signature" TEXT,
    "gateway_response" JSONB,
    "failure_reason" TEXT,
    "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "icon_url" TEXT,
    "parent_id" UUID,
    "commission_rate" DECIMAL(5,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_inventory_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "change" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "performed_by_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" VARCHAR(255),
    "body" TEXT,
    "images" JSONB,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "seller_reply" TEXT,
    "seller_reply_at" TIMESTAMPTZ(6),
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(255),
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "weight_grams" INTEGER,
    "image_url" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "short_description" TEXT,
    "brand" VARCHAR(255),
    "sku" VARCHAR(255),
    "barcode" VARCHAR(255),
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "cost_price" DECIMAL(12,2),
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "weight_grams" INTEGER,
    "length_cm" DECIMAL(8,2),
    "width_cm" DECIMAL(8,2),
    "height_cm" DECIMAL(8,2),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_admin_product" BOOLEAN NOT NULL DEFAULT false,
    "allow_cod" BOOLEAN NOT NULL DEFAULT true,
    "is_returnable" BOOLEAN NOT NULL DEFAULT true,
    "return_days" INTEGER NOT NULL DEFAULT 7,
    "tags" TEXT[],
    "specifications" JSONB,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(5,2),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "gateway_refund_id" VARCHAR(255),
    "gateway_response" JSONB,
    "initiated_by_id" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_penalties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rental_transaction_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ(6),
    "payment_id" UUID,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "waived_by_id" UUID,
    "waiver_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "rental_days" INTEGER NOT NULL,
    "daily_rate" DECIMAL(10,2) NOT NULL,
    "rental_amount" DECIMAL(12,2) NOT NULL,
    "security_deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "rental_status" NOT NULL DEFAULT 'PENDING',
    "delivery_type" "shipping_type" NOT NULL DEFAULT 'STANDARD',
    "delivery_address_id" UUID,
    "special_instructions" TEXT,
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rental_transaction_id" UUID NOT NULL,
    "return_date" DATE NOT NULL,
    "condition" "return_condition" NOT NULL,
    "inspection_notes" TEXT,
    "images" JSONB,
    "penalty_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penalty_reason" TEXT,
    "deposit_refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "inspected_by_id" UUID NOT NULL,
    "inspected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rental_request_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "actual_start_date" DATE,
    "actual_end_date" DATE,
    "agreed_end_date" DATE NOT NULL,
    "status" "rental_status" NOT NULL DEFAULT 'ACTIVE',
    "security_deposit_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "security_deposit_status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "total_rental_amount" DECIMAL(12,2) NOT NULL,
    "penalty_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_id" UUID,
    "condition_at_checkout" "equipment_condition",
    "condition_at_return" "return_condition",
    "checkout_notes" TEXT,
    "return_notes" TEXT,
    "checkout_images" JSONB,
    "return_images" JSONB,
    "checked_out_by_id" UUID,
    "received_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claim_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "activity" "reward_activity" NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "proof_images" JSONB,
    "proof_description" TEXT,
    "status" "reward_claim_status" NOT NULL DEFAULT 'PENDING',
    "points_requested" INTEGER NOT NULL,
    "points_credited" INTEGER,
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "credited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_claim_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "points_used" INTEGER NOT NULL,
    "monetary_value" DECIMAL(10,2) NOT NULL,
    "order_id" UUID,
    "rental_id" UUID,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity" "reward_activity" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "max_per_day" INTEGER,
    "max_per_month" INTEGER,
    "max_lifetime" INTEGER,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "requires_admin_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "conditions" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "reward_transaction_type" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "activity" "reward_activity",
    "rule_id" UUID,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "description" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "performed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "total_redeemed" INTEGER NOT NULL DEFAULT 0,
    "total_expired" INTEGER NOT NULL DEFAULT 0,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_balance" INTEGER NOT NULL DEFAULT 0,
    "tier" VARCHAR(50) NOT NULL DEFAULT 'BRONZE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "business_type" VARCHAR(100),
    "gst_number" VARCHAR(50),
    "pan_number" VARCHAR(50),
    "description" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "status" "seller_status" NOT NULL DEFAULT 'PENDING',
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "bank_account_no" VARCHAR(50),
    "bank_ifsc" VARCHAR(20),
    "bank_name" VARCHAR(255),
    "bank_account_name" VARCHAR(255),
    "upi_id" VARCHAR(255),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "service_area_ids" UUID[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "status" "area_status" NOT NULL DEFAULT 'ACTIVE',
    "base_lat" DECIMAL(10,8),
    "base_lng" DECIMAL(11,8),
    "radius_km" DECIMAL(8,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "tracking_number" VARCHAR(255),
    "carrier" VARCHAR(255),
    "tracking_url" TEXT,
    "status" VARCHAR(100) NOT NULL DEFAULT 'PENDING',
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "estimated_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "label" VARCHAR(100),
    "full_name" VARCHAR(255) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "mobile" VARCHAR(20),
    "mobile_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "gender" "gender",
    "date_of_birth" DATE,
    "profile_image_url" TEXT,
    "blood_group" "blood_group",
    "bio" TEXT,
    "is_available_donor" BOOLEAN NOT NULL DEFAULT false,
    "last_donation_date" DATE,
    "referral_code" VARCHAR(20),
    "referred_by_id" UUID,
    "total_donations" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_credited" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_debited" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "description" TEXT NOT NULL,
    "payment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "area_postal_codes_is_active_idx" ON "area_postal_codes"("is_active");

-- CreateIndex
CREATE INDEX "area_postal_codes_created_at_idx" ON "area_postal_codes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "area_postal_codes_unique" ON "area_postal_codes"("service_area_id", "postal_code");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_is_active_idx" ON "auth_sessions"("is_active");

-- CreateIndex
CREATE INDEX "auth_sessions_created_at_idx" ON "auth_sessions"("created_at");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_is_active_idx" ON "auth_sessions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "auth_sessions_replaced_by_session_id_idx" ON "auth_sessions"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "blood_admin_notes_created_at_idx" ON "blood_admin_notes"("created_at");

-- CreateIndex
CREATE INDEX "blood_admin_notes_entity_id_idx" ON "blood_admin_notes"("entity_id");

-- CreateIndex
CREATE INDEX "blood_admin_notes_admin_id_idx" ON "blood_admin_notes"("admin_id");

-- CreateIndex
CREATE INDEX "blood_admin_notes_entity_type_entity_id_idx" ON "blood_admin_notes"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "blood_compatibility_unique" ON "blood_compatibility"("donor_group", "recipient_group");

-- CreateIndex
CREATE INDEX "blood_donation_responses_status_idx" ON "blood_donation_responses"("status");

-- CreateIndex
CREATE INDEX "blood_donation_responses_created_at_idx" ON "blood_donation_responses"("created_at");

-- CreateIndex
CREATE INDEX "blood_donation_responses_donation_id_idx" ON "blood_donation_responses"("donation_id");

-- CreateIndex
CREATE INDEX "blood_donation_responses_reviewed_by_id_idx" ON "blood_donation_responses"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donation_responses_unique" ON "blood_donation_responses"("blood_request_id", "donor_id");

-- CreateIndex
CREATE INDEX "blood_donations_status_idx" ON "blood_donations"("status");

-- CreateIndex
CREATE INDEX "blood_donations_created_at_idx" ON "blood_donations"("created_at");

-- CreateIndex
CREATE INDEX "blood_donations_deleted_at_idx" ON "blood_donations"("deleted_at");

-- CreateIndex
CREATE INDEX "blood_donations_donor_id_idx" ON "blood_donations"("donor_id");

-- CreateIndex
CREATE INDEX "blood_donations_verified_by_id_idx" ON "blood_donations"("verified_by_id");

-- CreateIndex
CREATE INDEX "blood_donations_campaign_id_idx" ON "blood_donations"("campaign_id");

-- CreateIndex
CREATE INDEX "blood_donations_reward_claim_id_idx" ON "blood_donations"("reward_claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donor_profiles_user_id_key" ON "blood_donor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "blood_donor_profiles_created_at_idx" ON "blood_donor_profiles"("created_at");

-- CreateIndex
CREATE INDEX "blood_requests_urgency_idx" ON "blood_requests"("urgency");

-- CreateIndex
CREATE INDEX "blood_requests_status_idx" ON "blood_requests"("status");

-- CreateIndex
CREATE INDEX "blood_requests_created_at_idx" ON "blood_requests"("created_at");

-- CreateIndex
CREATE INDEX "blood_requests_deleted_at_idx" ON "blood_requests"("deleted_at");

-- CreateIndex
CREATE INDEX "blood_requests_requester_id_idx" ON "blood_requests"("requester_id");

-- CreateIndex
CREATE INDEX "blood_requests_verified_by_id_idx" ON "blood_requests"("verified_by_id");

-- CreateIndex
CREATE INDEX "cart_items_created_at_idx" ON "cart_items"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_unique" ON "cart_items"("cart_id", "product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE INDEX "carts_created_at_idx" ON "carts"("created_at");

-- CreateIndex
CREATE INDEX "commission_settings_created_at_idx" ON "commission_settings"("created_at");

-- CreateIndex
CREATE INDEX "commission_settings_category_id_idx" ON "commission_settings"("category_id");

-- CreateIndex
CREATE INDEX "commission_settings_seller_id_idx" ON "commission_settings"("seller_id");

-- CreateIndex
CREATE INDEX "commission_settings_created_by_id_idx" ON "commission_settings"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_unique" ON "coupon_usages"("coupon_id", "user_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "coupons_created_at_idx" ON "coupons"("created_at");

-- CreateIndex
CREATE INDEX "coupons_created_by_id_idx" ON "coupons"("created_by_id");

-- CreateIndex
CREATE INDEX "delivery_fees_is_active_idx" ON "delivery_fees"("is_active");

-- CreateIndex
CREATE INDEX "delivery_fees_created_at_idx" ON "delivery_fees"("created_at");

-- CreateIndex
CREATE INDEX "delivery_fees_service_area_id_idx" ON "delivery_fees"("service_area_id");

-- CreateIndex
CREATE INDEX "delivery_tracking_events_status_idx" ON "delivery_tracking_events"("status");

-- CreateIndex
CREATE INDEX "delivery_tracking_events_created_at_idx" ON "delivery_tracking_events"("created_at");

-- CreateIndex
CREATE INDEX "delivery_tracking_events_shipment_id_idx" ON "delivery_tracking_events"("shipment_id");

-- CreateIndex
CREATE INDEX "device_tokens_is_active_idx" ON "device_tokens"("is_active");

-- CreateIndex
CREATE INDEX "device_tokens_created_at_idx" ON "device_tokens"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_unique" ON "device_tokens"("user_id", "device_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "donation_certificates_donation_id_key" ON "donation_certificates"("donation_id");

-- CreateIndex
CREATE UNIQUE INDEX "donation_certificates_certificate_no_key" ON "donation_certificates"("certificate_no");

-- CreateIndex
CREATE INDEX "donation_certificates_created_at_idx" ON "donation_certificates"("created_at");

-- CreateIndex
CREATE INDEX "donation_certificates_donor_id_idx" ON "donation_certificates"("donor_id");

-- CreateIndex
CREATE INDEX "donation_item_images_created_at_idx" ON "donation_item_images"("created_at");

-- CreateIndex
CREATE INDEX "donation_item_images_donation_item_id_idx" ON "donation_item_images"("donation_item_id");

-- CreateIndex
CREATE INDEX "donation_item_requests_status_idx" ON "donation_item_requests"("status");

-- CreateIndex
CREATE INDEX "donation_item_requests_created_at_idx" ON "donation_item_requests"("created_at");

-- CreateIndex
CREATE INDEX "donation_item_requests_donation_item_id_idx" ON "donation_item_requests"("donation_item_id");

-- CreateIndex
CREATE INDEX "donation_item_requests_requester_id_idx" ON "donation_item_requests"("requester_id");

-- CreateIndex
CREATE INDEX "donation_item_requests_reviewed_by_id_idx" ON "donation_item_requests"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "donation_items_status_idx" ON "donation_items"("status");

-- CreateIndex
CREATE INDEX "donation_items_created_at_idx" ON "donation_items"("created_at");

-- CreateIndex
CREATE INDEX "donation_items_deleted_at_idx" ON "donation_items"("deleted_at");

-- CreateIndex
CREATE INDEX "donation_items_donor_id_idx" ON "donation_items"("donor_id");

-- CreateIndex
CREATE INDEX "donation_items_category_id_idx" ON "donation_items"("category_id");

-- CreateIndex
CREATE INDEX "donation_items_verified_by_id_idx" ON "donation_items"("verified_by_id");

-- CreateIndex
CREATE INDEX "donation_transfers_created_at_idx" ON "donation_transfers"("created_at");

-- CreateIndex
CREATE INDEX "donation_transfers_donation_item_id_idx" ON "donation_transfers"("donation_item_id");

-- CreateIndex
CREATE INDEX "donation_transfers_request_id_idx" ON "donation_transfers"("request_id");

-- CreateIndex
CREATE INDEX "donation_transfers_donor_id_idx" ON "donation_transfers"("donor_id");

-- CreateIndex
CREATE INDEX "donation_transfers_recipient_id_idx" ON "donation_transfers"("recipient_id");

-- CreateIndex
CREATE INDEX "emergency_contacts_created_at_idx" ON "emergency_contacts"("created_at");

-- CreateIndex
CREATE INDEX "emergency_contacts_user_id_idx" ON "emergency_contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_slug_key" ON "equipment"("slug");

-- CreateIndex
CREATE INDEX "equipment_is_active_idx" ON "equipment"("is_active");

-- CreateIndex
CREATE INDEX "equipment_created_at_idx" ON "equipment"("created_at");

-- CreateIndex
CREATE INDEX "equipment_deleted_at_idx" ON "equipment"("deleted_at");

-- CreateIndex
CREATE INDEX "equipment_category_id_idx" ON "equipment"("category_id");

-- CreateIndex
CREATE INDEX "equipment_owner_id_idx" ON "equipment"("owner_id");

-- CreateIndex
CREATE INDEX "equipment_service_area_id_idx" ON "equipment"("service_area_id");

-- CreateIndex
CREATE INDEX "equipment_verified_by_id_idx" ON "equipment"("verified_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_availability_unique" ON "equipment_availability"("equipment_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_slug_key" ON "equipment_categories"("slug");

-- CreateIndex
CREATE INDEX "equipment_categories_is_active_idx" ON "equipment_categories"("is_active");

-- CreateIndex
CREATE INDEX "equipment_categories_created_at_idx" ON "equipment_categories"("created_at");

-- CreateIndex
CREATE INDEX "equipment_categories_parent_id_idx" ON "equipment_categories"("parent_id");

-- CreateIndex
CREATE INDEX "equipment_images_created_at_idx" ON "equipment_images"("created_at");

-- CreateIndex
CREATE INDEX "equipment_images_equipment_id_idx" ON "equipment_images"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_maintenance_created_at_idx" ON "equipment_maintenance"("created_at");

-- CreateIndex
CREATE INDEX "equipment_maintenance_equipment_id_idx" ON "equipment_maintenance"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_maintenance_created_by_id_idx" ON "equipment_maintenance"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "featured_products_product_id_key" ON "featured_products"("product_id");

-- CreateIndex
CREATE INDEX "featured_products_is_active_idx" ON "featured_products"("is_active");

-- CreateIndex
CREATE INDEX "featured_products_created_at_idx" ON "featured_products"("created_at");

-- CreateIndex
CREATE INDEX "featured_products_created_by_id_idx" ON "featured_products"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoices_payment_id_idx" ON "invoices"("payment_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "membership_history_created_at_idx" ON "membership_history"("created_at");

-- CreateIndex
CREATE INDEX "membership_history_user_id_idx" ON "membership_history"("user_id");

-- CreateIndex
CREATE INDEX "membership_history_subscription_id_idx" ON "membership_history"("subscription_id");

-- CreateIndex
CREATE INDEX "membership_history_plan_id_idx" ON "membership_history"("plan_id");

-- CreateIndex
CREATE INDEX "membership_history_performed_by_id_idx" ON "membership_history"("performed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_slug_key" ON "membership_plans"("slug");

-- CreateIndex
CREATE INDEX "membership_plans_role_idx" ON "membership_plans"("role");

-- CreateIndex
CREATE INDEX "membership_plans_is_active_idx" ON "membership_plans"("is_active");

-- CreateIndex
CREATE INDEX "membership_plans_created_at_idx" ON "membership_plans"("created_at");

-- CreateIndex
CREATE INDEX "membership_subscriptions_status_idx" ON "membership_subscriptions"("status");

-- CreateIndex
CREATE INDEX "membership_subscriptions_created_at_idx" ON "membership_subscriptions"("created_at");

-- CreateIndex
CREATE INDEX "membership_subscriptions_user_id_idx" ON "membership_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "membership_subscriptions_plan_id_idx" ON "membership_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "membership_subscriptions_payment_id_idx" ON "membership_subscriptions"("payment_id");

-- CreateIndex
CREATE INDEX "order_items_created_at_idx" ON "order_items"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "order_items_seller_id_idx" ON "order_items"("seller_id");

-- CreateIndex
CREATE INDEX "order_return_items_created_at_idx" ON "order_return_items"("created_at");

-- CreateIndex
CREATE INDEX "order_return_items_return_id_idx" ON "order_return_items"("return_id");

-- CreateIndex
CREATE INDEX "order_return_items_order_item_id_idx" ON "order_return_items"("order_item_id");

-- CreateIndex
CREATE INDEX "order_returns_status_idx" ON "order_returns"("status");

-- CreateIndex
CREATE INDEX "order_returns_created_at_idx" ON "order_returns"("created_at");

-- CreateIndex
CREATE INDEX "order_returns_order_id_idx" ON "order_returns"("order_id");

-- CreateIndex
CREATE INDEX "order_returns_buyer_id_idx" ON "order_returns"("buyer_id");

-- CreateIndex
CREATE INDEX "order_returns_seller_id_idx" ON "order_returns"("seller_id");

-- CreateIndex
CREATE INDEX "order_returns_reviewed_by_id_idx" ON "order_returns"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_buyer_id_idx" ON "orders"("buyer_id");

-- CreateIndex
CREATE INDEX "orders_seller_id_idx" ON "orders"("seller_id");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- CreateIndex
CREATE INDEX "orders_shipping_address_id_idx" ON "orders"("shipping_address_id");

-- CreateIndex
CREATE INDEX "orders_cancelled_by_id_idx" ON "orders"("cancelled_by_id");

-- CreateIndex
CREATE INDEX "otp_verifications_created_at_idx" ON "otp_verifications"("created_at");

-- CreateIndex
CREATE INDEX "otp_verifications_identifier_purpose_idx" ON "otp_verifications"("identifier", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_created_at_idx" ON "password_reset_tokens"("created_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_id_idx" ON "payment_attempts"("payment_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_reference_id_idx" ON "payments"("reference_id");

-- CreateIndex
CREATE INDEX "payments_reference_type_reference_id_idx" ON "payments"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_is_active_idx" ON "product_categories"("is_active");

-- CreateIndex
CREATE INDEX "product_categories_created_at_idx" ON "product_categories"("created_at");

-- CreateIndex
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories"("parent_id");

-- CreateIndex
CREATE INDEX "product_images_created_at_idx" ON "product_images"("created_at");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_inventory_logs_created_at_idx" ON "product_inventory_logs"("created_at");

-- CreateIndex
CREATE INDEX "product_inventory_logs_product_id_idx" ON "product_inventory_logs"("product_id");

-- CreateIndex
CREATE INDEX "product_inventory_logs_variant_id_idx" ON "product_inventory_logs"("variant_id");

-- CreateIndex
CREATE INDEX "product_inventory_logs_reference_id_idx" ON "product_inventory_logs"("reference_id");

-- CreateIndex
CREATE INDEX "product_inventory_logs_performed_by_id_idx" ON "product_inventory_logs"("performed_by_id");

-- CreateIndex
CREATE INDEX "product_inventory_logs_reference_type_reference_id_idx" ON "product_inventory_logs"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "product_reviews_created_at_idx" ON "product_reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_unique" ON "product_reviews"("order_id", "reviewer_id", "product_id");

-- CreateIndex
CREATE INDEX "product_variants_is_active_idx" ON "product_variants"("is_active");

-- CreateIndex
CREATE INDEX "product_variants_created_at_idx" ON "product_variants"("created_at");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "products_seller_id_idx" ON "products"("seller_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_verified_by_id_idx" ON "products"("verified_by_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_created_at_idx" ON "refunds"("created_at");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_user_id_idx" ON "refunds"("user_id");

-- CreateIndex
CREATE INDEX "refunds_initiated_by_id_idx" ON "refunds"("initiated_by_id");

-- CreateIndex
CREATE INDEX "rental_penalties_created_at_idx" ON "rental_penalties"("created_at");

-- CreateIndex
CREATE INDEX "rental_penalties_rental_transaction_id_idx" ON "rental_penalties"("rental_transaction_id");

-- CreateIndex
CREATE INDEX "rental_penalties_renter_id_idx" ON "rental_penalties"("renter_id");

-- CreateIndex
CREATE INDEX "rental_penalties_payment_id_idx" ON "rental_penalties"("payment_id");

-- CreateIndex
CREATE INDEX "rental_penalties_waived_by_id_idx" ON "rental_penalties"("waived_by_id");

-- CreateIndex
CREATE INDEX "rental_requests_status_idx" ON "rental_requests"("status");

-- CreateIndex
CREATE INDEX "rental_requests_created_at_idx" ON "rental_requests"("created_at");

-- CreateIndex
CREATE INDEX "rental_requests_equipment_id_idx" ON "rental_requests"("equipment_id");

-- CreateIndex
CREATE INDEX "rental_requests_renter_id_idx" ON "rental_requests"("renter_id");

-- CreateIndex
CREATE INDEX "rental_requests_delivery_address_id_idx" ON "rental_requests"("delivery_address_id");

-- CreateIndex
CREATE INDEX "rental_requests_reviewed_by_id_idx" ON "rental_requests"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "rental_returns_created_at_idx" ON "rental_returns"("created_at");

-- CreateIndex
CREATE INDEX "rental_returns_rental_transaction_id_idx" ON "rental_returns"("rental_transaction_id");

-- CreateIndex
CREATE INDEX "rental_returns_inspected_by_id_idx" ON "rental_returns"("inspected_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_transactions_rental_request_id_key" ON "rental_transactions"("rental_request_id");

-- CreateIndex
CREATE INDEX "rental_transactions_status_idx" ON "rental_transactions"("status");

-- CreateIndex
CREATE INDEX "rental_transactions_created_at_idx" ON "rental_transactions"("created_at");

-- CreateIndex
CREATE INDEX "rental_transactions_renter_id_idx" ON "rental_transactions"("renter_id");

-- CreateIndex
CREATE INDEX "rental_transactions_equipment_id_idx" ON "rental_transactions"("equipment_id");

-- CreateIndex
CREATE INDEX "rental_transactions_payment_id_idx" ON "rental_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "rental_transactions_checked_out_by_id_idx" ON "rental_transactions"("checked_out_by_id");

-- CreateIndex
CREATE INDEX "rental_transactions_received_by_id_idx" ON "rental_transactions"("received_by_id");

-- CreateIndex
CREATE INDEX "reward_claim_requests_status_idx" ON "reward_claim_requests"("status");

-- CreateIndex
CREATE INDEX "reward_claim_requests_created_at_idx" ON "reward_claim_requests"("created_at");

-- CreateIndex
CREATE INDEX "reward_claim_requests_user_id_idx" ON "reward_claim_requests"("user_id");

-- CreateIndex
CREATE INDEX "reward_claim_requests_rule_id_idx" ON "reward_claim_requests"("rule_id");

-- CreateIndex
CREATE INDEX "reward_claim_requests_reference_id_idx" ON "reward_claim_requests"("reference_id");

-- CreateIndex
CREATE INDEX "reward_claim_requests_reviewed_by_id_idx" ON "reward_claim_requests"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "reward_claim_requests_reference_type_reference_id_idx" ON "reward_claim_requests"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_configurations_key_key" ON "reward_configurations"("key");

-- CreateIndex
CREATE INDEX "reward_configurations_updated_by_id_idx" ON "reward_configurations"("updated_by_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_status_idx" ON "reward_redemptions"("status");

-- CreateIndex
CREATE INDEX "reward_redemptions_created_at_idx" ON "reward_redemptions"("created_at");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_wallet_id_idx" ON "reward_redemptions"("wallet_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_order_id_idx" ON "reward_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_rental_id_idx" ON "reward_redemptions"("rental_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_transaction_id_idx" ON "reward_redemptions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_rules_activity_unique" ON "reward_rules"("activity");

-- CreateIndex
CREATE INDEX "reward_rules_is_active_idx" ON "reward_rules"("is_active");

-- CreateIndex
CREATE INDEX "reward_rules_created_at_idx" ON "reward_rules"("created_at");

-- CreateIndex
CREATE INDEX "reward_rules_created_by_id_idx" ON "reward_rules"("created_by_id");

-- CreateIndex
CREATE INDEX "reward_transactions_created_at_idx" ON "reward_transactions"("created_at");

-- CreateIndex
CREATE INDEX "reward_transactions_wallet_id_idx" ON "reward_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "reward_transactions_user_id_idx" ON "reward_transactions"("user_id");

-- CreateIndex
CREATE INDEX "reward_transactions_rule_id_idx" ON "reward_transactions"("rule_id");

-- CreateIndex
CREATE INDEX "reward_transactions_reference_id_idx" ON "reward_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "reward_transactions_performed_by_id_idx" ON "reward_transactions"("performed_by_id");

-- CreateIndex
CREATE INDEX "reward_transactions_reference_type_reference_id_idx" ON "reward_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_wallets_user_id_key" ON "reward_wallets"("user_id");

-- CreateIndex
CREATE INDEX "reward_wallets_created_at_idx" ON "reward_wallets"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE INDEX "seller_profiles_status_idx" ON "seller_profiles"("status");

-- CreateIndex
CREATE INDEX "seller_profiles_created_at_idx" ON "seller_profiles"("created_at");

-- CreateIndex
CREATE INDEX "seller_profiles_deleted_at_idx" ON "seller_profiles"("deleted_at");

-- CreateIndex
CREATE INDEX "seller_profiles_verified_by_id_idx" ON "seller_profiles"("verified_by_id");

-- CreateIndex
CREATE INDEX "service_areas_status_idx" ON "service_areas"("status");

-- CreateIndex
CREATE INDEX "service_areas_created_at_idx" ON "service_areas"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_created_at_idx" ON "shipments"("created_at");

-- CreateIndex
CREATE INDEX "user_addresses_created_at_idx" ON "user_addresses"("created_at");

-- CreateIndex
CREATE INDEX "user_addresses_deleted_at_idx" ON "user_addresses"("deleted_at");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_unique" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_referred_by_id_idx" ON "users"("referred_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_user_id_key" ON "wallet_accounts"("user_id");

-- CreateIndex
CREATE INDEX "wallet_accounts_is_active_idx" ON "wallet_accounts"("is_active");

-- CreateIndex
CREATE INDEX "wallet_accounts_created_at_idx" ON "wallet_accounts"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_idx" ON "wallet_transactions"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_id_idx" ON "wallet_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_payment_id_idx" ON "wallet_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "wishlists_created_at_idx" ON "wishlists"("created_at");

-- CreateIndex
CREATE INDEX "wishlists_variant_id_idx" ON "wishlists"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_unique" ON "wishlists"("user_id", "product_id");
