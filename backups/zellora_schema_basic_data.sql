
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `agent_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `agent_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `preferred_payout_method` enum('upi','bank_transfer') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upi_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_holder` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number_enc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_last4` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_agent_profiles_user` (`user_id`),
  UNIQUE KEY `uq_agent_profiles_code` (`agent_code`),
  CONSTRAINT `fk_agent_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `attribute_value_dependencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attribute_value_dependencies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `attribute_value_id` bigint unsigned NOT NULL,
  `depends_on_value_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_attr_value_dependency` (`attribute_value_id`,`depends_on_value_id`),
  KEY `fk_avd_child` (`attribute_value_id`),
  KEY `fk_avd_parent` (`depends_on_value_id`),
  CONSTRAINT `fk_avd_child` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_avd_parent` FOREIGN KEY (`depends_on_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attribute_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `attribute_id` bigint unsigned NOT NULL,
  `value` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `price_adjustment` decimal(10,2) NOT NULL DEFAULT '0.00',
  `color_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_attribute_values_created_by` (`created_by`),
  KEY `fk_attribute_values_updated_by` (`updated_by`),
  KEY `fk_attrval_attr` (`attribute_id`),
  CONSTRAINT `fk_attribute_values_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attribute_values_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attrval_attr` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` bigint unsigned NOT NULL,
  `action` enum('create','update','delete') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_audit_logs_created_by` (`created_by`),
  KEY `fk_audit_logs_updated_by` (`updated_by`),
  KEY `fk_auditlog_user` (`user_id`),
  KEY `idx_audit_table_record` (`table_name`,`record_id`),
  CONSTRAINT `fk_audit_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_logs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_auditlog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `banner_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `banner_positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_banner_positions_slug` (`slug`),
  KEY `fk_banner_positions_created_by` (`created_by`),
  KEY `fk_banner_positions_updated_by` (`updated_by`),
  CONSTRAINT `fk_banner_positions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_banner_positions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `banners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `banners` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `banner_position_id` bigint unsigned NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_label` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtitle` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_text` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `media_type` enum('image','video') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'image',
  `video_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_banner_position` (`banner_position_id`),
  KEY `fk_banners_created_by` (`created_by`),
  KEY `fk_banners_updated_by` (`updated_by`),
  CONSTRAINT `fk_banner_position` FOREIGN KEY (`banner_position_id`) REFERENCES `banner_positions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_banners_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_banners_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `blog_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(170) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_blog_categories_slug` (`slug`),
  KEY `fk_blog_categories_created_by` (`created_by`),
  KEY `fk_blog_categories_updated_by` (`updated_by`),
  CONSTRAINT `fk_blog_categories_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blog_categories_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `blog_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_comments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `blog_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_blog_comments_created_by` (`created_by`),
  KEY `fk_blog_comments_updated_by` (`updated_by`),
  KEY `fk_blogcomment_blog` (`blog_id`),
  KEY `fk_blogcomment_user` (`user_id`),
  CONSTRAINT `fk_blog_comments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blog_comments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blogcomment_blog` FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blogcomment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `blogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blogs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `blog_category_id` bigint unsigned DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `featured_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_id` bigint unsigned DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_blogs_slug` (`slug`),
  KEY `fk_blog_author` (`author_id`),
  KEY `fk_blog_category` (`blog_category_id`),
  KEY `fk_blogs_created_by` (`created_by`),
  KEY `fk_blogs_updated_by` (`updated_by`),
  CONSTRAINT `fk_blog_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blog_category` FOREIGN KEY (`blog_category_id`) REFERENCES `blog_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blogs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_blogs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `bulk_order_enquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bulk_order_enquiries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_interest` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `status` enum('new','contacted','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `admin_comment` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bulk_order_enquiries_uuid` (`uuid`),
  UNIQUE KEY `uq_bulk_order_enquiries_uuid` (`uuid`),
  KEY `fk_bulk_order_enquiries_created_by` (`created_by`),
  KEY `fk_bulk_order_enquiries_updated_by` (`updated_by`),
  CONSTRAINT `fk_bulk_order_enquiries_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bulk_order_enquiries_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `cart_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `price_at_add` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned DEFAULT NULL,
  `item_id` bigint unsigned DEFAULT NULL,
  `style_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cartitem_cart_item_variant_unitprice` (`cart_id`,`style_id`,`variant_id`,`variant_unit_price_id`),
  KEY `fk_cart_items_created_by` (`created_by`),
  KEY `fk_cart_items_updated_by` (`updated_by`),
  KEY `fk_cartitem_cart` (`cart_id`),
  KEY `fk_cartitem_product` (`product_id`),
  KEY `fk_cartitem_variant` (`variant_id`),
  KEY `fk_cartitem_variant_unit_price` (`variant_unit_price_id`),
  KEY `fk_cartitem_item` (`item_id`),
  KEY `fk_cartitem_newitem` (`item_id`),
  CONSTRAINT `fk_cart_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cart_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cartitem_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cartitem_newitem` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cartitem_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cartitem_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cartitem_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `user_id` bigint unsigned DEFAULT NULL,
  `session_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coupon_id` bigint unsigned DEFAULT NULL,
  `status` enum('active','converted','abandoned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_activity_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cart_coupon` (`coupon_id`),
  KEY `fk_cart_user` (`user_id`),
  KEY `fk_carts_created_by` (`created_by`),
  KEY `fk_carts_updated_by` (`updated_by`),
  KEY `idx_cart_session` (`session_id`),
  KEY `idx_cart_status` (`status`),
  CONSTRAINT `fk_cart_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_carts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_carts_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `category_attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_attributes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `attribute_id` bigint unsigned NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_category_attribute` (`category_id`,`attribute_id`),
  KEY `fk_catattr_category` (`category_id`),
  KEY `fk_catattr_attribute` (`attribute_id`),
  CONSTRAINT `fk_catattr_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_catattr_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `combo_product_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `combo_product_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `combo_product_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_combo_product_items_created_by` (`created_by`),
  KEY `fk_combo_product_items_updated_by` (`updated_by`),
  KEY `fk_comboitem_combo` (`combo_product_id`),
  KEY `fk_comboitem_product` (`product_id`),
  KEY `fk_comboitem_variant_unit_price` (`variant_unit_price_id`),
  CONSTRAINT `fk_combo_product_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_combo_product_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comboitem_combo` FOREIGN KEY (`combo_product_id`) REFERENCES `combo_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comboitem_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comboitem_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `combo_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `combo_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_combo_products_slug` (`slug`),
  KEY `fk_combo_products_created_by` (`created_by`),
  KEY `fk_combo_products_updated_by` (`updated_by`),
  CONSTRAINT `fk_combo_products_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_combo_products_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `commission_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned NOT NULL,
  `agent_id` bigint unsigned DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_id` bigint unsigned DEFAULT NULL,
  `actor_role` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cal_entity` (`entity_type`,`entity_id`),
  KEY `idx_cal_agent` (`agent_id`),
  KEY `idx_cal_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=240 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `commission_payouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_payouts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` bigint unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `method` enum('upi','bank_transfer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `upi_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_holder_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number_enc` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_last4` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ifsc` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('requested','approved','rejected','paid','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requested',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `rejection_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `paid_by` bigint unsigned DEFAULT NULL,
  `transaction_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_commission_payouts_uuid` (`uuid`),
  KEY `idx_commission_payouts_agent_status` (`agent_id`,`status`),
  KEY `idx_commission_payouts_status` (`status`),
  CONSTRAINT `fk_commission_payouts_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `commission_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_rates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scope` enum('global','category','product') COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `product_id` bigint unsigned DEFAULT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_commission_rates_scope_key` (`scope_key`),
  KEY `idx_commission_rates_scope` (`scope`,`is_active`),
  KEY `idx_commission_rates_category` (`category_id`),
  KEY `idx_commission_rates_product` (`product_id`),
  CONSTRAINT `fk_commission_rates_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_commission_rates_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `product_amount` decimal(12,2) NOT NULL,
  `commission_percentage` decimal(5,2) NOT NULL,
  `rate_source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commission_amount` decimal(12,2) NOT NULL,
  `status` enum('pending','approved','payout_requested','payout_approved','paid','cancelled','reversed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `order_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `return_period_ends_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `payout_id` bigint unsigned DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  `reversal_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clawback_due` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_commissions_uuid` (`uuid`),
  UNIQUE KEY `uq_commissions_order_item` (`order_item_id`),
  KEY `idx_commissions_agent_status` (`agent_id`,`status`),
  KEY `idx_commissions_customer` (`customer_id`),
  KEY `idx_commissions_order` (`order_id`),
  KEY `idx_commissions_product` (`product_id`),
  KEY `idx_commissions_category` (`category_id`),
  KEY `idx_commissions_payout` (`payout_id`),
  KEY `idx_commissions_status_due` (`status`,`return_period_ends_at`),
  KEY `idx_commissions_referral_code` (`referral_code`),
  CONSTRAINT `fk_commissions_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_commissions_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`),
  CONSTRAINT `fk_commissions_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_commissions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_commissions_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`),
  CONSTRAINT `fk_commissions_payout` FOREIGN KEY (`payout_id`) REFERENCES `commission_payouts` (`id`),
  CONSTRAINT `fk_commissions_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'India',
  `pincode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gst_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_companies_uuid` (`uuid`),
  UNIQUE KEY `uq_companies_uuid` (`uuid`),
  KEY `fk_companies_created_by` (`created_by`),
  KEY `fk_companies_updated_by` (`updated_by`),
  CONSTRAINT `fk_companies_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_companies_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('new','read','replied') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_contact_messages_uuid` (`uuid`),
  UNIQUE KEY `uq_contact_messages_uuid` (`uuid`),
  KEY `fk_contact_messages_created_by` (`created_by`),
  KEY `fk_contact_messages_updated_by` (`updated_by`),
  CONSTRAINT `fk_contact_messages_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contact_messages_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupon_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `coupon_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupon_category` (`coupon_id`,`category_id`),
  KEY `fk_couponcat_category` (`category_id`),
  CONSTRAINT `fk_couponcat_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_couponcat_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupon_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `coupon_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupon_product` (`coupon_id`,`product_id`),
  KEY `fk_couponprod_product` (`product_id`),
  CONSTRAINT `fk_couponprod_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_couponprod_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupon_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_usage` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `coupon_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `discount_amount` decimal(10,2) NOT NULL,
  `used_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_coupon_usage_created_by` (`created_by`),
  KEY `fk_coupon_usage_updated_by` (`updated_by`),
  KEY `fk_couponusage_coupon` (`coupon_id`),
  KEY `fk_couponusage_order` (`order_id`),
  KEY `fk_couponusage_user` (`user_id`),
  CONSTRAINT `fk_coupon_usage_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_coupon_usage_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_couponusage_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_couponusage_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_couponusage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupons` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('flat','percentage') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `min_order_amount` decimal(10,2) DEFAULT '0.00',
  `max_discount_amount` decimal(10,2) DEFAULT NULL,
  `usage_limit` int DEFAULT NULL,
  `usage_limit_per_user` int DEFAULT '1',
  `valid_from` timestamp NULL DEFAULT NULL,
  `valid_to` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_coupons_code` (`code`),
  KEY `fk_coupons_created_by` (`created_by`),
  KEY `fk_coupons_updated_by` (`updated_by`),
  CONSTRAINT `fk_coupons_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_coupons_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `customer_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `user_id` bigint unsigned NOT NULL,
  `cust_id` bigint DEFAULT NULL,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_line1` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landmark` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `state` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pincode` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `address_type` enum('shipping','billing') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'shipping',
  PRIMARY KEY (`id`),
  KEY `fk_addr_user` (`user_id`),
  KEY `fk_customer_addresses_created_by` (`created_by`),
  KEY `fk_customer_addresses_updated_by` (`updated_by`),
  KEY `idx_addr_pincode` (`pincode`),
  CONSTRAINT `fk_addr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_addresses_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customer_addresses_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `customer_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `user_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(13) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_whatsapp` tinyint(1) DEFAULT '0',
  `whatsapp_no` varchar(13) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_image` longtext COLLATE utf8mb4_unicode_ci,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referred_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `status` tinyint(1) DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_profiles_user_id` (`user_id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `referral_code` (`referral_code`),
  UNIQUE KEY `uq_customer_profiles_referral_code` (`referral_code`),
  KEY `fk_cp_referrer` (`referred_by`),
  KEY `fk_customer_profiles_created_by` (`created_by`),
  KEY `fk_customer_profiles_updated_by` (`updated_by`),
  CONSTRAINT `fk_cp_referrer` FOREIGN KEY (`referred_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customer_profiles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customer_profiles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `customer_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_reports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `new_customers` int NOT NULL DEFAULT '0',
  `returning_customers` int NOT NULL DEFAULT '0',
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `report_date` (`report_date`),
  UNIQUE KEY `uq_customer_reports_report_date` (`report_date`),
  KEY `fk_customer_reports_created_by` (`created_by`),
  KEY `fk_customer_reports_updated_by` (`updated_by`),
  CONSTRAINT `fk_customer_reports_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customer_reports_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `delivery_partners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_partners` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_delivery_partners_code` (`code`),
  KEY `fk_delivery_partners_created_by` (`created_by`),
  KEY `fk_delivery_partners_updated_by` (`updated_by`),
  CONSTRAINT `fk_delivery_partners_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_delivery_partners_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `delivery_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_slots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `slot_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `max_orders` int NOT NULL DEFAULT '0',
  `booked_orders` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_delivery_slots_created_by` (`created_by`),
  KEY `fk_delivery_slots_updated_by` (`updated_by`),
  KEY `idx_slot_date` (`slot_date`),
  CONSTRAINT `fk_delivery_slots_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_delivery_slots_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `faq`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `question` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_faq_created_by` (`created_by`),
  KEY `fk_faq_updated_by` (`updated_by`),
  KEY `idx_faq_active_sort` (`is_active`,`sort_order`),
  KEY `idx_faq_category` (`category`),
  CONSTRAINT `fk_faq_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_faq_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `header_menu_item_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `header_menu_item_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `header_menu_item_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_hmic_item_category` (`header_menu_item_id`,`category_id`),
  KEY `fk_hmic_category` (`category_id`),
  CONSTRAINT `fk_hmic_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hmic_item` FOREIGN KEY (`header_menu_item_id`) REFERENCES `header_menu_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `header_menu_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `header_menu_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `label` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `gender` enum('men','women','kids','unisex') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_header_menu_created_by` (`created_by`),
  KEY `fk_header_menu_updated_by` (`updated_by`),
  CONSTRAINT `fk_header_menu_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_header_menu_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `inventories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quantity_available` int NOT NULL DEFAULT '0',
  `quantity_reserved` int NOT NULL DEFAULT '0',
  `reorder_level` int NOT NULL DEFAULT '0',
  `warehouse_location` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `variant_unit_price_id` (`variant_unit_price_id`),
  UNIQUE KEY `uq_inventories_variant_unit_price_id` (`variant_unit_price_id`),
  KEY `fk_inventories_created_by` (`created_by`),
  KEY `fk_inventories_updated_by` (`updated_by`),
  CONSTRAINT `fk_inv_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventories_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventories_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `inventory_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_reservations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  `cart_id` bigint unsigned DEFAULT NULL,
  `order_id` bigint unsigned DEFAULT NULL,
  `quantity` int NOT NULL,
  `status` enum('active','confirmed','expired','released') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_invres_vup` (`variant_unit_price_id`),
  KEY `fk_invres_cart` (`cart_id`),
  KEY `fk_invres_order` (`order_id`),
  KEY `idx_invres_status_expiry` (`status`,`expires_at`),
  CONSTRAINT `fk_invres_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invres_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invres_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `type` enum('in','out','reserved','released') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  `movement_type` enum('PURCHASE','SALE','RETURN','REPLACEMENT','ADJUSTMENT') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previous_stock` int DEFAULT NULL,
  `new_stock` int DEFAULT NULL,
  `reference_number` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_inventory_transactions_updated_by` (`updated_by`),
  KEY `fk_invtx_user` (`created_by`),
  KEY `idx_invtx_variant_unit_price` (`variant_unit_price_id`),
  KEY `idx_invtx_movement_type` (`movement_type`,`created_at`),
  KEY `idx_invtx_created` (`created_at`),
  CONSTRAINT `fk_inventory_transactions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invtx_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invtx_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=160 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `item_attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_attribute_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint unsigned NOT NULL,
  `attribute_id` bigint unsigned NOT NULL,
  `attribute_value_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_item_attribute_value` (`item_id`,`attribute_value_id`),
  KEY `fk_iav_item` (`item_id`),
  KEY `fk_iav_attribute` (`attribute_id`),
  KEY `fk_iav_value` (`attribute_value_id`),
  CONSTRAINT `fk_iav_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_iav_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_iav_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `short_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `out_of_stock` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `style_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_items_slug` (`slug`),
  UNIQUE KEY `uq_items_sku` (`sku`),
  KEY `fk_items_created_by` (`created_by`),
  KEY `fk_items_updated_by` (`updated_by`),
  KEY `idx_newitem_style` (`style_id`),
  KEY `fk_newitem_created_by` (`created_by`),
  KEY `fk_newitem_updated_by` (`updated_by`),
  CONSTRAINT `fk_newitem_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_newitem_style` FOREIGN KEY (`style_id`) REFERENCES `styles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_newitem_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `login_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('success','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_login_logs_created_by` (`created_by`),
  KEY `fk_login_logs_updated_by` (`updated_by`),
  KEY `fk_loginlog_user` (`user_id`),
  CONSTRAINT `fk_login_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_login_logs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_loginlog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `newsletter_subscribers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `newsletter_subscribers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `subscribed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_newsletter_subscribers_email` (`email`),
  KEY `fk_newsletter_subscribers_created_by` (`created_by`),
  KEY `fk_newsletter_subscribers_updated_by` (`updated_by`),
  CONSTRAINT `fk_newsletter_subscribers_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_newsletter_subscribers_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `notification_template_id` bigint unsigned DEFAULT NULL,
  `recipient` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('email','sms','push','whatsapp') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('sent','failed','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `response` text COLLATE utf8mb4_unicode_ci,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_notification_logs_created_by` (`created_by`),
  KEY `fk_notification_logs_updated_by` (`updated_by`),
  KEY `fk_notiflog_template` (`notification_template_id`),
  CONSTRAINT `fk_notification_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notification_logs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notiflog_template` FOREIGN KEY (`notification_template_id`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('email','sms','push','whatsapp') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_notification_templates_code` (`code`),
  KEY `fk_notification_templates_created_by` (`created_by`),
  KEY `fk_notification_templates_updated_by` (`updated_by`),
  CONSTRAINT `fk_notification_templates_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notification_templates_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_notif_user` (`user_id`),
  KEY `fk_notifications_created_by` (`created_by`),
  KEY `fk_notifications_updated_by` (`updated_by`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notifications_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offer_brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offer_brands` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `offer_id` bigint unsigned NOT NULL,
  `brand_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offer_brand` (`offer_id`,`brand_id`),
  KEY `fk_offerbrand_brand` (`brand_id`),
  CONSTRAINT `fk_offerbrand_brand` FOREIGN KEY (`brand_id`) REFERENCES `product_brands` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offerbrand_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offer_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offer_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `offer_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offer_category` (`offer_id`,`category_id`),
  KEY `fk_offercat_category` (`category_id`),
  CONSTRAINT `fk_offercat_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offercat_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offer_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `offer_id` bigint unsigned NOT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offer_item` (`offer_id`,`variant_unit_price_id`),
  KEY `fk_offeritem_vup` (`variant_unit_price_id`),
  KEY `fk_offer_items_created_by` (`created_by`),
  KEY `fk_offer_items_updated_by` (`updated_by`),
  CONSTRAINT `fk_offer_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_offer_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_offeritem_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offeritem_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offer_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offer_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `offer_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offer_product` (`offer_id`,`product_id`),
  KEY `fk_offer_products_created_by` (`created_by`),
  KEY `fk_offer_products_updated_by` (`updated_by`),
  KEY `fk_offerprod_product` (`product_id`),
  CONSTRAINT `fk_offer_products_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_offer_products_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_offerprod_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offerprod_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` enum('product','item') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'product',
  `type` enum('percentage','flat','special_price','bxgy') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `buy_quantity` int DEFAULT NULL,
  `get_quantity` int DEFAULT NULL,
  `min_quantity` int NOT NULL DEFAULT '1',
  `max_quantity` int DEFAULT NULL,
  `min_order_amount` decimal(10,2) DEFAULT '0.00',
  `max_discount_amount` decimal(10,2) DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '0',
  `terms` text COLLATE utf8mb4_unicode_ci,
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offers_code` (`code`),
  KEY `fk_offers_created_by` (`created_by`),
  KEY `fk_offers_updated_by` (`updated_by`),
  KEY `idx_offers_active_window` (`is_active`,`starts_at`,`ends_at`),
  KEY `idx_offers_level` (`level`),
  KEY `idx_offers_priority` (`priority`),
  CONSTRAINT `fk_offers_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_offers_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `order_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `order_id` bigint unsigned NOT NULL,
  `type` enum('billing','shipping') COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_line1` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_line2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landmark` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `state` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pincode` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_addresses_created_by` (`created_by`),
  KEY `fk_order_addresses_updated_by` (`updated_by`),
  KEY `fk_orderaddr_order` (`order_id`),
  CONSTRAINT `fk_order_addresses_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_addresses_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orderaddr_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `order_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `product_name_snapshot` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant_snapshot` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku_snapshot` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned DEFAULT NULL,
  `item_id` bigint unsigned DEFAULT NULL,
  `item_name_snapshot` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `style_id` bigint unsigned NOT NULL,
  `attributes_snapshot` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_items_created_by` (`created_by`),
  KEY `fk_order_items_updated_by` (`updated_by`),
  KEY `fk_orderitem_order` (`order_id`),
  KEY `fk_orderitem_product` (`product_id`),
  KEY `fk_orderitem_variant` (`variant_id`),
  KEY `fk_orderitem_variant_unit_price` (`variant_unit_price_id`),
  KEY `fk_orderitem_item` (`item_id`),
  KEY `fk_orderitem_newitem` (`item_id`),
  CONSTRAINT `fk_order_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orderitem_newitem` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orderitem_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orderitem_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_orderitem_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`),
  CONSTRAINT `fk_orderitem_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `order_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_status_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_status_history_created_by` (`created_by`),
  KEY `fk_order_status_history_updated_by` (`updated_by`),
  KEY `fk_orderhist_order` (`order_id`),
  KEY `fk_orderhist_user` (`changed_by`),
  CONSTRAINT `fk_order_status_history_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_status_history_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orderhist_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orderhist_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `order_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `cart_id` bigint unsigned DEFAULT NULL,
  `coupon_id` bigint unsigned DEFAULT NULL,
  `delivery_slot_id` bigint unsigned DEFAULT NULL,
  `order_status` enum('pending','confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','returned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payment_status` enum('pending','paid','failed','refunded','partial_refund') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `shipping_charge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `placed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `agent_id` bigint unsigned DEFAULT NULL,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `commission_percentage` decimal(5,2) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancellation_reason` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancellation_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by_user_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  UNIQUE KEY `uq_orders_order_number` (`order_number`),
  KEY `fk_order_cart` (`cart_id`),
  KEY `fk_order_coupon` (`coupon_id`),
  KEY `fk_order_slot` (`delivery_slot_id`),
  KEY `fk_orders_created_by` (`created_by`),
  KEY `fk_orders_updated_by` (`updated_by`),
  KEY `idx_order_created` (`created_at`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_order_user` (`user_id`),
  KEY `fk_orders_agent` (`agent_id`),
  KEY `idx_orders_referral_code` (`referral_code`),
  KEY `idx_order_delivered_at` (`delivered_at`),
  KEY `idx_order_cancelled_at` (`cancelled_at`),
  CONSTRAINT `fk_order_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_slot` FOREIGN KEY (`delivery_slot_id`) REFERENCES `delivery_slots` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_agent` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `otp_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_verifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `identifier` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` enum('login','register','reset_password','checkout') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `is_token_used` tinyint(1) NOT NULL DEFAULT '0',
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `verification_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_otp_user` (`user_id`),
  KEY `fk_otp_verifications_created_by` (`created_by`),
  KEY `fk_otp_verifications_updated_by` (`updated_by`),
  KEY `idx_otp_identifier` (`identifier`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_otp_verifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_otp_verifications_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `page_contents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `page_contents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `page_id` bigint unsigned NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_page_contents_created_by` (`created_by`),
  KEY `fk_page_contents_updated_by` (`updated_by`),
  KEY `fk_pagecontent_page` (`page_id`),
  CONSTRAINT `fk_page_contents_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_page_contents_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pagecontent_page` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_pages_slug` (`slug`),
  KEY `fk_pages_created_by` (`created_by`),
  KEY `fk_pages_updated_by` (`updated_by`),
  CONSTRAINT `fk_pages_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pages_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_gateway_webhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_gateway_webhooks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `gateway` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `status` enum('received','processed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_payment_gateway_webhooks_created_by` (`created_by`),
  KEY `fk_payment_gateway_webhooks_updated_by` (`updated_by`),
  CONSTRAINT `fk_payment_gateway_webhooks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_gateway_webhooks_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_payment_methods_code` (`code`),
  KEY `fk_payment_methods_created_by` (`created_by`),
  KEY `fk_payment_methods_updated_by` (`updated_by`),
  CONSTRAINT `fk_payment_methods_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_methods_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_redirect_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_redirect_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `razorpay_order_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `internal_order_ref` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipping_address_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `billing_address_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `key_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token` (`token`),
  KEY `idx_token_exp` (`token`,`expires_at`,`is_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint unsigned NOT NULL,
  `transaction_type` enum('charge','refund') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gateway_response` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_payment_transactions_created_by` (`created_by`),
  KEY `fk_payment_transactions_updated_by` (`updated_by`),
  KEY `fk_paytx_payment` (`payment_id`),
  CONSTRAINT `fk_payment_transactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_transactions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_paytx_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `payment_method_id` bigint unsigned NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `status` enum('pending','success','failed','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `gateway` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway_order_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway_payment_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_payment_method` (`payment_method_id`),
  KEY `fk_payments_created_by` (`created_by`),
  KEY `fk_payments_updated_by` (`updated_by`),
  KEY `idx_payment_order` (`order_id`),
  CONSTRAINT `fk_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_payment_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_permissions_slug` (`slug`),
  KEY `fk_permissions_created_by` (`created_by`),
  KEY `fk_permissions_updated_by` (`updated_by`),
  CONSTRAINT `fk_permissions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_permissions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pincode_serviceability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pincode_serviceability` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `zone_id` bigint unsigned NOT NULL,
  `pincode` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_zone_pincode` (`zone_id`,`pincode`),
  KEY `fk_pincode_serviceability_created_by` (`created_by`),
  KEY `fk_pincode_serviceability_updated_by` (`updated_by`),
  KEY `idx_pincode` (`pincode`),
  CONSTRAINT `fk_pincode_serviceability_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pincode_serviceability_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pincode_zone` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_attribute_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_attribute_configs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `attribute_id` bigint unsigned NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_attribute_config` (`product_id`,`attribute_id`),
  KEY `fk_pac_product` (`product_id`),
  KEY `fk_pac_attribute` (`attribute_id`),
  CONSTRAINT `fk_pac_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pac_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_attribute_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `attribute_id` bigint unsigned NOT NULL,
  `attribute_value_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pav_attr` (`attribute_id`),
  KEY `fk_pav_product` (`product_id`),
  KEY `fk_pav_value` (`attribute_value_id`),
  KEY `fk_product_attribute_values_created_by` (`created_by`),
  KEY `fk_product_attribute_values_updated_by` (`updated_by`),
  CONSTRAINT `fk_pav_attr` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pav_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pav_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_attribute_values_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_attribute_values_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_attributes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `type` enum('text','color') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `multiple_selection` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_product_attributes_slug` (`slug`),
  KEY `fk_product_attributes_created_by` (`created_by`),
  KEY `fk_product_attributes_updated_by` (`updated_by`),
  CONSTRAINT `fk_product_attributes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_attributes_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_brands` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(170) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_product_brands_slug` (`slug`),
  KEY `fk_brands_created_by` (`created_by`),
  KEY `fk_brands_updated_by` (`updated_by`),
  CONSTRAINT `fk_brands_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_brands_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `parent_id` bigint unsigned DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(170) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_product_categories_slug` (`slug`),
  KEY `fk_cat_parent` (`parent_id`),
  KEY `fk_categories_created_by` (`created_by`),
  KEY `fk_categories_updated_by` (`updated_by`),
  KEY `idx_cat_slug` (`slug`),
  CONSTRAINT `fk_cat_parent` FOREIGN KEY (`parent_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_categories_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_categories_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_category_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_category_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `category_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_text` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_category_images_created_by` (`created_by`),
  KEY `fk_category_images_updated_by` (`updated_by`),
  KEY `fk_catimg_cat` (`category_id`),
  CONSTRAINT `fk_category_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_category_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_catimg_cat` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_gst_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_gst_rates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cgst_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `sgst_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `igst_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_gst_rates_created_by` (`created_by`),
  KEY `fk_gst_rates_updated_by` (`updated_by`),
  CONSTRAINT `fk_gst_rates_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_gst_rates_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_hsn_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_hsn_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gst_rate_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_product_hsn_codes_code` (`code`),
  KEY `fk_hsn_codes_created_by` (`created_by`),
  KEY `fk_hsn_codes_updated_by` (`updated_by`),
  KEY `fk_hsn_gst` (`gst_rate_id`),
  CONSTRAINT `fk_hsn_codes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hsn_codes_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hsn_gst` FOREIGN KEY (`gst_rate_id`) REFERENCES `product_gst_rates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_text` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pimg_product` (`product_id`),
  KEY `fk_product_images_created_by` (`created_by`),
  KEY `fk_product_images_updated_by` (`updated_by`),
  CONSTRAINT `fk_pimg_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_questions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `question` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `answered_by` bigint unsigned DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `answered_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pq_answered_by` (`answered_by`),
  KEY `fk_pq_product` (`product_id`),
  KEY `fk_pq_user` (`user_id`),
  KEY `fk_product_questions_created_by` (`created_by`),
  KEY `fk_product_questions_updated_by` (`updated_by`),
  CONSTRAINT `fk_pq_answered_by` FOREIGN KEY (`answered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pq_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pq_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_questions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_questions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_tag_maps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_tag_maps` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `tag_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_tag` (`product_id`,`tag_id`),
  KEY `fk_product_tag_maps_created_by` (`created_by`),
  KEY `fk_product_tag_maps_updated_by` (`updated_by`),
  KEY `fk_ptm_tag` (`tag_id`),
  CONSTRAINT `fk_product_tag_maps_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_tag_maps_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ptm_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ptm_tag` FOREIGN KEY (`tag_id`) REFERENCES `product_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_product_tags_slug` (`slug`),
  KEY `fk_product_tags_created_by` (`created_by`),
  KEY `fk_product_tags_updated_by` (`updated_by`),
  CONSTRAINT `fk_product_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_tags_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_units` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('weight','volume','count','size') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'count',
  `base_unit_id` bigint unsigned DEFAULT NULL,
  `conversion_factor` decimal(12,4) NOT NULL DEFAULT '1.0000',
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_product_units_code` (`code`),
  KEY `fk_unit_base` (`base_unit_id`),
  KEY `fk_units_created_by` (`created_by`),
  KEY `fk_units_updated_by` (`updated_by`),
  CONSTRAINT `fk_unit_base` FOREIGN KEY (`base_unit_id`) REFERENCES `product_units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_units_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_units_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_variant_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variant_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_product_variant_images_created_by` (`created_by`),
  KEY `fk_product_variant_images_updated_by` (`updated_by`),
  KEY `fk_vimg_variant` (`variant_id`),
  CONSTRAINT `fk_product_variant_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_variant_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vimg_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `out_of_stock` tinyint(1) NOT NULL DEFAULT '0',
  `color_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_adjustment` decimal(10,2) NOT NULL DEFAULT '0.00',
  `item_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_variant_slug` (`slug`),
  UNIQUE KEY `uq_product_variants_slug` (`slug`),
  KEY `fk_product_variants_created_by` (`created_by`),
  KEY `fk_product_variants_updated_by` (`updated_by`),
  KEY `idx_variant_active_listing` (`is_active`,`deleted_at`,`created_at`),
  KEY `idx_variant_out_of_stock` (`out_of_stock`),
  KEY `idx_variant_item` (`item_id`),
  CONSTRAINT `fk_product_variants_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_product_variants_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_variant_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `category_id` bigint DEFAULT NULL,
  `brand_id` bigint unsigned DEFAULT NULL,
  `hsn_code_id` bigint unsigned DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `gender` enum('men','women','kids','unisex') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  UNIQUE KEY `idx_products_uuid` (`uuid`),
  UNIQUE KEY `uq_products_uuid` (`uuid`),
  KEY `fk_products_brand` (`brand_id`),
  KEY `fk_products_created_by` (`created_by`),
  KEY `fk_products_hsn` (`hsn_code_id`),
  KEY `fk_products_updated_by` (`updated_by`),
  KEY `idx_products_active` (`is_active`),
  KEY `idx_products_slug` (`slug`),
  KEY `idx_products_category` (`category_id`),
  CONSTRAINT `fk_products_brand` FOREIGN KEY (`brand_id`) REFERENCES `product_brands` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_hsn` FOREIGN KEY (`hsn_code_id`) REFERENCES `product_hsn_codes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `produt_brand_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produt_brand_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `brand_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_text` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_brand_images_created_by` (`created_by`),
  KEY `fk_brand_images_updated_by` (`updated_by`),
  KEY `fk_brandimg_brand` (`brand_id`),
  CONSTRAINT `fk_brand_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_brand_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_brandimg_brand` FOREIGN KEY (`brand_id`) REFERENCES `product_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `purchase_order_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `from_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_poh_po` (`purchase_order_id`),
  CONSTRAINT `fk_poh_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  `quantity_ordered` int NOT NULL,
  `quantity_received` int NOT NULL DEFAULT '0',
  `unit_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_poi_po` (`purchase_order_id`),
  KEY `idx_poi_vup` (`variant_unit_price_id`),
  CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_poi_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_id` bigint unsigned NOT NULL,
  `status` enum('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `expected_date` date DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `invoice_number` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reject_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `additional_charges` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `ordered_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `idempotency_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_uuid` (`uuid`),
  UNIQUE KEY `uq_po_number` (`po_number`),
  UNIQUE KEY `uq_po_idempotency_key` (`idempotency_key`),
  KEY `idx_po_vendor` (`vendor_id`),
  KEY `idx_po_status` (`status`),
  KEY `idx_po_purchase_date` (`purchase_date`),
  CONSTRAINT `fk_po_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `purchase_receipt_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_receipt_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `receipt_id` bigint unsigned NOT NULL,
  `purchase_order_item_id` bigint unsigned NOT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  `quantity_received` int NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_ri_receipt` (`receipt_id`),
  KEY `idx_ri_poi` (`purchase_order_item_id`),
  KEY `idx_ri_vup` (`variant_unit_price_id`),
  CONSTRAINT `fk_ri_poi` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`),
  CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `purchase_receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ri_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `purchase_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `receipt_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_number` (`receipt_number`),
  KEY `idx_receipt_po` (`purchase_order_id`),
  CONSTRAINT `fk_receipt_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `recently_viewed_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recently_viewed_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `session_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_id` bigint unsigned NOT NULL,
  `viewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_recently_viewed_products_created_by` (`created_by`),
  KEY `fk_recently_viewed_products_updated_by` (`updated_by`),
  KEY `fk_recentview_product` (`product_id`),
  KEY `idx_recentview_session` (`session_id`),
  KEY `idx_recentview_user` (`user_id`),
  CONSTRAINT `fk_recently_viewed_products_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recently_viewed_products_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recentview_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recentview_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `redirect_urls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `redirect_urls` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `from_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `redirect_type` smallint NOT NULL DEFAULT '301',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_redirect_urls_created_by` (`created_by`),
  KEY `fk_redirect_urls_updated_by` (`updated_by`),
  CONSTRAINT `fk_redirect_urls_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_redirect_urls_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `refunds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refunds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('initiated','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'initiated',
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `return_request_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_refund_order` (`order_id`),
  KEY `fk_refund_payment` (`payment_id`),
  KEY `fk_refunds_created_by` (`created_by`),
  KEY `fk_refunds_updated_by` (`updated_by`),
  KEY `idx_refund_return_request` (`return_request_id`),
  CONSTRAINT `fk_refund_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refund_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refund_return_request` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_refunds_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_refunds_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `replacement_request_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `replacement_request_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `replacement_request_id` bigint unsigned NOT NULL,
  `from_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_user_id` bigint unsigned DEFAULT NULL,
  `actor_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_replacement_hist_request` (`replacement_request_id`,`created_at`),
  KEY `idx_replacement_hist_actor` (`actor_user_id`),
  CONSTRAINT `fk_replacement_hist_request` FOREIGN KEY (`replacement_request_id`) REFERENCES `replacement_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `replacement_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `replacement_request_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `replacement_request_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned NOT NULL,
  `quantity` int NOT NULL,
  `requested_variant_id` bigint unsigned DEFAULT NULL,
  `requested_variant_unit_price_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `fk_replitem_request` (`replacement_request_id`),
  KEY `fk_replitem_orderitem` (`order_item_id`),
  KEY `fk_replitem_variant` (`requested_variant_id`),
  KEY `fk_replitem_vup` (`requested_variant_unit_price_id`),
  CONSTRAINT `fk_replitem_orderitem` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`),
  CONSTRAINT `fk_replitem_request` FOREIGN KEY (`replacement_request_id`) REFERENCES `replacement_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_replitem_variant` FOREIGN KEY (`requested_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_replitem_vup` FOREIGN KEY (`requested_variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `replacement_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `replacement_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `unboxing_video_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('replacement_requested','under_review','approved','rejected','pickup_scheduled','picked_up','replacement_processing','replacement_shipped','replaced','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'replacement_requested',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejected_by` bigint unsigned DEFAULT NULL,
  `rejection_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pickup_scheduled_at` timestamp NULL DEFAULT NULL,
  `shipped_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_replacement_requests_uuid` (`uuid`),
  KEY `fk_replacement_order` (`order_id`),
  KEY `fk_replacement_user` (`user_id`),
  KEY `idx_replacement_status` (`status`),
  KEY `idx_replacement_requested_at` (`requested_at`),
  CONSTRAINT `fk_replacement_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_replacement_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `return_request_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned NOT NULL,
  `quantity` int NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refund_amount` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_return_items_created_by` (`created_by`),
  KEY `fk_return_items_updated_by` (`updated_by`),
  KEY `fk_returnitem_orderitem` (`order_item_id`),
  KEY `fk_returnitem_request` (`return_request_id`),
  CONSTRAINT `fk_return_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_returnitem_orderitem` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`),
  CONSTRAINT `fk_returnitem_request` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `return_request_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_request_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `return_request_id` bigint unsigned NOT NULL,
  `from_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_user_id` bigint unsigned DEFAULT NULL,
  `actor_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_return_hist_request` (`return_request_id`,`created_at`),
  KEY `idx_return_hist_actor` (`actor_user_id`),
  CONSTRAINT `fk_return_hist_request` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `return_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('return_requested','under_review','approved','rejected','pickup_scheduled','picked_up','received','refund_pending','refunded','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'return_requested',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `unboxing_video_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `rejected_by` bigint unsigned DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pickup_scheduled_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_return_requests_uuid` (`uuid`),
  UNIQUE KEY `uq_return_requests_uuid` (`uuid`),
  KEY `fk_return_order` (`order_id`),
  KEY `fk_return_requests_created_by` (`created_by`),
  KEY `fk_return_requests_updated_by` (`updated_by`),
  KEY `fk_return_user` (`user_id`),
  KEY `idx_return_status` (`status`),
  KEY `idx_return_requested_at` (`requested_at`),
  CONSTRAINT `fk_return_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_return_requests_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_requests_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_return_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `review_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `review_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_review_images_created_by` (`created_by`),
  KEY `fk_review_images_updated_by` (`updated_by`),
  KEY `fk_reviewimg_review` (`review_id`),
  CONSTRAINT `fk_review_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reviewimg_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned DEFAULT NULL,
  `rating` tinyint unsigned NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_reviews_uuid` (`uuid`),
  UNIQUE KEY `uq_reviews_uuid` (`uuid`),
  KEY `fk_review_orderitem` (`order_item_id`),
  KEY `fk_review_product` (`product_id`),
  KEY `fk_review_user` (`user_id`),
  KEY `fk_review_variant_unit_price` (`variant_unit_price_id`),
  KEY `fk_reviews_created_by` (`created_by`),
  KEY `fk_reviews_updated_by` (`updated_by`),
  CONSTRAINT `fk_review_orderitem` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_review_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_review_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_review_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reviews_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `reward_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_points` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `total_points` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reward_points_user_id` (`user_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `fk_reward_points_created_by` (`created_by`),
  KEY `fk_reward_points_updated_by` (`updated_by`),
  CONSTRAINT `fk_reward_points_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reward_points_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rewardpoints_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `reward_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reward_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `type` enum('earn','redeem','expire') COLLATE utf8mb4_unicode_ci NOT NULL,
  `points` int NOT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_reward_transactions_created_by` (`created_by`),
  KEY `fk_reward_transactions_updated_by` (`updated_by`),
  KEY `fk_rewardtx_user` (`user_id`),
  CONSTRAINT `fk_reward_transactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reward_transactions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rewardtx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permission` (`role_id`,`permission_id`),
  KEY `fk_role_permissions_created_by` (`created_by`),
  KEY `fk_role_permissions_updated_by` (`updated_by`),
  KEY `fk_rp_permission` (`permission_id`),
  CONSTRAINT `fk_role_permissions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_role_permissions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `uq_roles_slug` (`slug`),
  KEY `fk_roles_created_by` (`created_by`),
  KEY `fk_roles_updated_by` (`updated_by`),
  CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_roles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sales_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_reports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `total_orders` int NOT NULL DEFAULT '0',
  `total_sales` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_tax` decimal(12,2) NOT NULL DEFAULT '0.00',
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `report_date` (`report_date`),
  UNIQUE KEY `uq_sales_reports_report_date` (`report_date`),
  KEY `fk_sales_reports_created_by` (`created_by`),
  KEY `fk_sales_reports_updated_by` (`updated_by`),
  CONSTRAINT `fk_sales_reports_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_reports_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `search_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `session_id` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `results_count` int NOT NULL DEFAULT '0',
  `searched_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_search_history_created_by` (`created_by`),
  KEY `fk_search_history_updated_by` (`updated_by`),
  KEY `fk_search_user` (`user_id`),
  CONSTRAINT `fk_search_history_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_search_history_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_search_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `seo_meta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seo_meta` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned NOT NULL,
  `meta_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_keywords` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `og_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_seo_entity` (`entity_type`,`entity_id`),
  KEY `fk_seo_meta_created_by` (`created_by`),
  KEY `fk_seo_meta_updated_by` (`updated_by`),
  CONSTRAINT `fk_seo_meta_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_seo_meta_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `key_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key_name` (`key_name`),
  UNIQUE KEY `uq_settings_key_name` (`key_name`),
  KEY `fk_settings_created_by` (`created_by`),
  KEY `fk_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_settings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `shipment_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipment_tracking` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `shipment_id` bigint unsigned NOT NULL,
  `status` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_shipment_tracking_created_by` (`created_by`),
  KEY `fk_shipment_tracking_updated_by` (`updated_by`),
  KEY `fk_shiptrack_shipment` (`shipment_id`),
  CONSTRAINT `fk_shipment_tracking_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipment_tracking_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shiptrack_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `shipments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `delivery_partner_id` bigint unsigned DEFAULT NULL,
  `tracking_number` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','picked_up','in_transit','out_for_delivery','delivered','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `shipped_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_staff_id` bigint unsigned DEFAULT NULL,
  `assignment_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `accepted_at` timestamp NULL DEFAULT NULL,
  `delivery_notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_shipment_delivery_staff` (`delivery_staff_id`),
  KEY `fk_shipment_order` (`order_id`),
  KEY `fk_shipment_partner` (`delivery_partner_id`),
  KEY `fk_shipments_created_by` (`created_by`),
  KEY `fk_shipments_updated_by` (`updated_by`),
  CONSTRAINT `fk_shipment_delivery_staff` FOREIGN KEY (`delivery_staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipment_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shipment_partner` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `shipping_charges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_charges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `zone_id` bigint unsigned DEFAULT NULL,
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_order_amount` decimal(10,2) DEFAULT NULL,
  `charge_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_free_above` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_shipcharge_zone` (`zone_id`),
  KEY `fk_shipping_charges_created_by` (`created_by`),
  KEY `fk_shipping_charges_updated_by` (`updated_by`),
  CONSTRAINT `fk_shipcharge_zone` FOREIGN KEY (`zone_id`) REFERENCES `shipping_zones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shipping_charges_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipping_charges_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `shipping_zones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_zones` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_shipping_zones_created_by` (`created_by`),
  KEY `fk_shipping_zones_updated_by` (`updated_by`),
  CONSTRAINT `fk_shipping_zones_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shipping_zones_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `size_charts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `size_charts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `gender` enum('men','women','kids','unisex') COLLATE utf8mb4_unicode_ci NOT NULL,
  `attribute_value_id` bigint unsigned NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_sizechart_cat_gender_value` (`category_id`,`gender`,`attribute_value_id`),
  KEY `idx_sizechart_cat_gender` (`category_id`,`gender`),
  KEY `idx_sizechart_attr_value` (`attribute_value_id`),
  CONSTRAINT `fk_sizechart_attribute_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sizechart_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stock_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `adjusted_by` bigint unsigned DEFAULT NULL,
  `adjustment_type` enum('add','remove') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_stock_adjustments_created_by` (`created_by`),
  KEY `fk_stock_adjustments_updated_by` (`updated_by`),
  KEY `fk_stockadj_user` (`adjusted_by`),
  KEY `fk_stockadj_variant_unit_price` (`variant_unit_price_id`),
  CONSTRAINT `fk_stock_adjustments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stock_adjustments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stockadj_user` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stockadj_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stock_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_reports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `opening_stock` int NOT NULL DEFAULT '0',
  `closing_stock` int NOT NULL DEFAULT '0',
  `sold_qty` int NOT NULL DEFAULT '0',
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_stock_reports_created_by` (`created_by`),
  KEY `fk_stock_reports_updated_by` (`updated_by`),
  KEY `fk_stockreport_variant_unit_price` (`variant_unit_price_id`),
  CONSTRAINT `fk_stock_reports_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stock_reports_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_stockreport_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `style_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `style_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_id` bigint unsigned NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_text` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_itemimg_item` (`item_id`),
  KEY `fk_item_images_created_by` (`created_by`),
  KEY `fk_item_images_updated_by` (`updated_by`),
  CONSTRAINT `fk_item_images_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_item_images_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_itemimg_item` FOREIGN KEY (`item_id`) REFERENCES `styles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `styles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `styles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `product_id` bigint unsigned NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `short_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `ingredients` text COLLATE utf8mb4_unicode_ci,
  `is_ready_to_mix` tinyint(1) NOT NULL DEFAULT '0',
  `cooking_recipe` text COLLATE utf8mb4_unicode_ci,
  `shelf_life` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `veg_type` enum('veg','nonveg','vegan','na') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'na',
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `out_of_stock` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `brand_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_styles_slug` (`slug`),
  UNIQUE KEY `uq_styles_sku` (`sku`),
  KEY `idx_item_product` (`product_id`),
  KEY `fk_items_created_by` (`created_by`),
  KEY `fk_items_updated_by` (`updated_by`),
  KEY `idx_styles_brand` (`brand_id`),
  CONSTRAINT `fk_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_styles_brand` FOREIGN KEY (`brand_id`) REFERENCES `product_brands` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `uq_user_sessions_token` (`token`),
  KEY `fk_user_sessions_created_by` (`created_by`),
  KEY `fk_user_sessions_updated_by` (`updated_by`),
  KEY `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_sessions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_sessions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(125) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_id` bigint unsigned NOT NULL,
  `cust_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','banned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `phone_verified_at` timestamp NULL DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `is_blocked` bigint DEFAULT NULL,
  `blocked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referred_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  UNIQUE KEY `users_referral_code` (`referral_code`),
  UNIQUE KEY `uq_users_referral_code` (`referral_code`),
  KEY `fk_users_created_by` (`created_by`),
  KEY `fk_users_role` (`role_id`),
  KEY `fk_users_updated_by` (`updated_by`),
  KEY `idx_users_status` (`status`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_users_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `variant_attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variant_attribute_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `variant_id` bigint unsigned NOT NULL,
  `attribute_id` bigint unsigned NOT NULL,
  `attribute_value_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_variant_attribute` (`variant_id`,`attribute_id`),
  KEY `fk_vav_attribute` (`attribute_id`),
  KEY `fk_vav_value` (`attribute_value_id`),
  CONSTRAINT `fk_vav_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vav_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vav_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `variant_price_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variant_price_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `old_base_price` decimal(10,2) DEFAULT NULL,
  `new_base_price` decimal(10,2) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_vph_created_by` (`created_by`),
  KEY `fk_vph_updated_by` (`updated_by`),
  KEY `fk_vph_variant_unit_price` (`variant_unit_price_id`),
  CONSTRAINT `fk_vph_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vph_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vph_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `variant_unit_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variant_unit_prices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `variant_id` bigint unsigned NOT NULL,
  `unit_id` bigint unsigned NOT NULL,
  `unit_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `attribute_value_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  UNIQUE KEY `uq_variant_unit_prices_sku` (`sku`),
  UNIQUE KEY `uniq_vup_variant_size` (`variant_id`,`attribute_value_id`),
  KEY `fk_vup_created_by` (`created_by`),
  KEY `fk_vup_unit` (`unit_id`),
  KEY `fk_vup_updated_by` (`updated_by`),
  KEY `fk_vup_variant` (`variant_id`),
  KEY `fk_vup_size_value` (`attribute_value_id`),
  CONSTRAINT `fk_vup_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vup_size_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vup_unit` FOREIGN KEY (`unit_id`) REFERENCES `product_units` (`id`),
  CONSTRAINT `fk_vup_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vup_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstin` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendors_uuid` (`uuid`),
  UNIQUE KEY `uq_vendors_code` (`code`),
  KEY `idx_vendors_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `wallet_id` bigint unsigned NOT NULL,
  `type` enum('credit','debit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_wallet_transactions_created_by` (`created_by`),
  KEY `fk_wallet_transactions_updated_by` (`updated_by`),
  KEY `fk_wallettx_wallet` (`wallet_id`),
  CONSTRAINT `fk_wallet_transactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallet_transactions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallettx_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallets_user_id` (`user_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `fk_wallets_created_by` (`created_by`),
  KEY `fk_wallets_updated_by` (`updated_by`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wallets_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wallets_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `whatsapp_campaign_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_campaign_recipients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `campaign_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned DEFAULT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUEUED',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `message_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wacr_camp_phone` (`campaign_id`,`phone_number`),
  KEY `idx_wacr_camp_status` (`campaign_id`,`status`),
  CONSTRAINT `fk_wacr_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `whatsapp_campaigns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `whatsapp_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_campaigns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UUID()',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CUSTOM',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `media_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `total_recipients` int NOT NULL DEFAULT '0',
  `sent_count` int NOT NULL DEFAULT '0',
  `failed_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wac_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `whatsapp_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_templates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FESTIVAL',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `media_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wishlist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wishlist_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'UUID()',
  `user_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `variant_unit_price_id` bigint unsigned DEFAULT NULL,
  `item_id` bigint unsigned DEFAULT NULL,
  `style_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist_user_product_variant` (`user_id`,`product_id`,`variant_id`),
  KEY `fk_wishlist_items_created_by` (`created_by`),
  KEY `fk_wishlist_items_updated_by` (`updated_by`),
  KEY `fk_wishlist_product` (`product_id`),
  KEY `fk_wishlist_variant` (`variant_id`),
  KEY `fk_wishlist_variant_unit_price` (`variant_unit_price_id`),
  KEY `fk_wishlist_item` (`item_id`),
  KEY `fk_wishlist_newitem` (`item_id`),
  CONSTRAINT `fk_wishlist_items_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wishlist_items_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wishlist_newitem` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wishlist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_variant_unit_price` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` (`id`, `name`, `slug`, `description`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`) VALUES (1,'ADMIN','admin','Administrator with full access','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(2,'STAFF','staff','Staff member with limited access','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(3,'CUSTOMER','customer','Regular customer','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(4,'AGENT','agent','Referral agent credited for attributed signups and orders','2026-09-25 05:35:26','2026-09-25 05:35:26',1,NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` (`id`, `name`, `slug`, `module`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`) VALUES (1,'PRODUCT_VIEW','product-view','PRODUCT','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(2,'PRODUCT_CREATE','product-create','PRODUCT','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(3,'PRODUCT_UPDATE','product-update','PRODUCT','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(4,'PRODUCT_DELETE','product-delete','PRODUCT','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(5,'CATEGORY_VIEW','category-view','CATEGORY','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(6,'CATEGORY_CREATE','category-create','CATEGORY','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(7,'CATEGORY_UPDATE','category-update','CATEGORY','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(8,'CATEGORY_DELETE','category-delete','CATEGORY','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(9,'ORDER_VIEW','order-view','ORDER','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(10,'ORDER_UPDATE','order-update','ORDER','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(11,'USER_VIEW','user-view','USER','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(12,'USER_UPDATE','user-update','USER','2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` (`id`, `role_id`, `permission_id`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`) VALUES (1,1,1,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(2,1,2,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(3,1,3,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(4,1,4,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(5,1,5,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(6,1,6,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(7,1,7,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(8,1,8,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(9,1,9,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(10,1,10,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(11,1,11,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL),(12,1,12,'2026-09-15 03:25:14','2026-09-15 03:25:14',1,NULL,NULL);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `banner_positions` WRITE;
/*!40000 ALTER TABLE `banner_positions` DISABLE KEYS */;
INSERT INTO `banner_positions` (`id`, `uuid`, `name`, `slug`, `page`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`) VALUES (1,'dc741205-5c0f-4150-a7f0-ea3dafcde28f','Home Hero Banner','home-hero','home','2026-09-15 03:25:14','2026-09-15 03:25:14',1,1,1),(2,'69b13d06-9caa-4ae5-9323-78860b497357','Home Offer Banner','home-offer','home','2026-09-15 03:25:14','2026-09-15 03:25:14',1,1,1),(3,'9c7e05bb-8d21-4f38-816a-329d4db6a6d9','Home Popup Offer','home-popup-offer','home','2026-09-15 03:25:14','2026-09-15 03:25:14',1,1,1),(4,'5c4556b7-8fb5-4669-a378-a097439b2fa9','Home Reels','home-reels','home','2026-09-15 03:25:14','2026-09-15 03:25:14',1,1,1),(5,'b7ea783b-f61b-4095-b650-951e9e740fba','Home Intro Image','home-hero-intro','home','2026-09-28 01:20:47','2026-09-28 01:20:47',1,51,51);
/*!40000 ALTER TABLE `banner_positions` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `product_gst_rates` WRITE;
/*!40000 ALTER TABLE `product_gst_rates` DISABLE KEYS */;
INSERT INTO `product_gst_rates` (`id`, `uuid`, `name`, `cgst_percent`, `sgst_percent`, `igst_percent`, `status`, `is_active`, `created_at`, `updated_at`, `created_by`, `updated_by`) VALUES (1,'923271ba-19a9-4a50-a1d6-859c1108a7f0','GST 5%',2.50,2.50,5.00,1,0,'2026-09-15 03:30:01','2026-09-15 03:30:01',1,1),(2,'a74e87bb-96aa-4866-8101-b766bba0dab3','GST 5%',2.50,2.50,5.00,1,1,'2026-09-15 03:38:59','2026-09-15 03:38:59',1,1),(3,'26e3a7d3-41c4-45f5-9593-1907f2d355de','GST 5% v2',2.50,2.50,5.00,1,0,'2026-09-15 03:39:16','2026-09-15 03:39:16',1,1),(4,'c00b8cad-09be-46f6-a309-750b32a0197a','GST 5% RV',2.50,2.50,5.00,1,0,'2026-09-15 04:07:57','2026-09-15 04:07:57',1,1),(5,'6decef91-26c9-4e5b-bf32-ba8addb990c1','GST 5% RP',2.50,2.50,5.00,1,0,'2026-09-15 05:18:00','2026-09-15 05:18:00',1,1),(6,'3f3f80d3-ba20-4417-b6f3-cd9f683fe584','GST 5% SR',2.50,2.50,5.00,1,0,'2026-09-15 05:25:11','2026-09-15 05:25:11',1,1),(7,'e0c5c637-ff44-4796-a61a-af6ae80a0038','GST 5% CP',2.50,2.50,5.00,1,0,'2026-09-15 06:11:32','2026-09-15 06:11:32',1,1),(8,'90aef47a-8a25-4641-b306-dceef7af08e8','GST 5% SC',2.50,2.50,5.00,1,0,'2026-09-15 06:47:48','2026-09-15 06:47:48',1,1),(9,'5ea71e8e-1757-47e0-9319-d3daa9b8f061','GST 5% UI',2.50,2.50,5.00,1,0,'2026-09-15 08:26:30','2026-09-15 08:26:30',1,1),(10,'60d4b69c-d78d-4c0f-97eb-1d3de4da0416','GST 5% SF',2.50,2.50,5.00,1,0,'2026-09-15 08:41:13','2026-09-15 08:41:13',1,1),(11,'e10a1648-29a9-4a54-bf5f-eeb23680a70b','GST 5% RS',2.50,2.50,5.00,1,0,'2026-09-15 10:06:47','2026-09-15 10:06:47',1,1),(12,'633defc9-2029-4b37-8187-1ad0daa1e3bf','GST 5% RF',2.50,2.50,5.00,1,0,'2026-09-15 23:16:37','2026-09-15 23:16:37',1,1),(13,'e4d98226-ab24-4d90-bc9b-d2730b9cc9ff','18',9.00,9.00,18.00,1,1,'2026-09-29 05:34:55','2026-09-29 05:34:55',1,1);
/*!40000 ALTER TABLE `product_gst_rates` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `product_hsn_codes` WRITE;
/*!40000 ALTER TABLE `product_hsn_codes` DISABLE KEYS */;
INSERT INTO `product_hsn_codes` (`id`, `uuid`, `code`, `description`, `gst_rate_id`, `created_at`, `updated_at`, `status`, `is_active`, `created_by`, `updated_by`) VALUES (1,'3116a2cc-d785-4dfa-9a83-2e7f0ee4b5b4','6109','T-shirts, singlets',1,'2026-09-15 03:30:06','2026-09-15 03:30:06',1,0,1,1),(3,'751d1444-4c79-4258-acd3-a71c9f5e774b','6109v2','T-shirts',3,'2026-09-15 03:39:24','2026-09-15 03:39:24',1,0,1,1),(4,'9313680b-a663-4e0d-b369-d544bb3a5f7d','6109RV','T-shirts',4,'2026-09-15 04:08:07','2026-09-15 04:08:07',1,0,1,1),(5,'764c22d3-1836-4a58-9f44-0913709577a3','6109RP','T-shirts',5,'2026-09-15 05:18:14','2026-09-15 05:18:14',1,0,1,1),(6,'ccf3fd6e-86fd-4443-b347-0a39a72397ce','6109SR','T-shirts',6,'2026-09-15 05:25:20','2026-09-15 05:25:20',1,0,1,1),(7,'2f887daf-131f-4807-bc75-0be1ea7bbd42','6109CP','T-shirts',7,'2026-09-15 06:11:42','2026-09-15 06:11:42',1,0,1,1),(8,'19708ddf-ec71-4e07-b7dd-64247b595bac','6109SC','T-shirts',8,'2026-09-15 06:48:07','2026-09-15 06:48:07',1,0,1,1),(9,'58cee5c4-c656-475e-a6aa-e1b22bed9a8e','6109UI','T-shirts',9,'2026-09-15 08:26:36','2026-09-15 08:26:36',1,0,1,1),(10,'f787a15d-8a8f-45a1-a779-ea046f398a88','6109SF','T-shirts',10,'2026-09-15 08:41:35','2026-09-15 08:41:35',1,0,1,1),(11,'c9e07b71-63d7-49ca-8671-1b0683306f9e','6109RS','T-shirts',11,'2026-09-15 10:06:56','2026-09-15 10:06:56',1,0,1,1),(12,'fdb118ec-1eb3-47e0-b825-3fe740df53b3','6109RF','T-shirts',12,'2026-09-15 23:16:48','2026-09-15 23:16:48',1,0,1,1),(13,'0e6612d9-183c-4320-b5ea-b81ffb072773','6104',NULL,2,'2026-09-16 03:07:23','2026-09-16 03:07:23',1,1,NULL,NULL);
/*!40000 ALTER TABLE `product_hsn_codes` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `product_units` WRITE;
/*!40000 ALTER TABLE `product_units` DISABLE KEYS */;
INSERT INTO `product_units` (`id`, `uuid`, `name`, `code`, `type`, `base_unit_id`, `conversion_factor`, `status`, `is_active`, `sort_order`, `created_at`, `updated_at`, `created_by`, `updated_by`) VALUES (1,'03d7800d-9073-4dd9-b40c-38fb166f8ee1','Piece','PC','count',NULL,1.0000,1,0,0,'2026-09-15 03:40:12','2026-09-15 03:40:12',1,1),(3,'7e0de851-94d5-4122-aa4d-1a21b802bc9c','Piece RV','PCRV','count',NULL,1.0000,1,0,0,'2026-09-15 04:12:40','2026-09-15 04:12:40',1,1),(4,'9159a91c-4b5c-4542-b878-8ef073ec9b3d','Piece SR','PCSR','count',NULL,1.0000,1,0,0,'2026-09-15 05:26:22','2026-09-15 05:26:22',1,1),(5,'0c3d9eee-2563-49c6-9766-9b1434e52d6d','Piece CP','PCCP','count',NULL,1.0000,1,0,0,'2026-09-15 06:12:05','2026-09-15 06:12:05',1,1),(6,'24b3ab11-62d3-465e-966b-6ee581594422','Piece GT','PCGT','count',NULL,1.0000,1,0,0,'2026-09-15 08:17:19','2026-09-15 08:17:19',1,1),(7,'00c00dee-addb-45ec-b19f-8c538c34c6e4','Piece SF','PCSF','count',NULL,1.0000,1,0,0,'2026-09-15 08:42:56','2026-09-15 08:42:56',1,1),(8,'ba3e0fc3-a11a-4c1b-9aae-d767bdf2ca5f','Piece RS','PCRS','count',NULL,1.0000,1,0,0,'2026-09-15 10:07:39','2026-09-15 10:07:39',1,1),(9,'ae6e6463-b3d6-4d3e-846a-966b96105f4d','Piece RF','PCRF','count',NULL,1.0000,1,0,0,'2026-09-15 23:17:32','2026-09-15 23:17:32',1,1),(10,'dd5bce03-b3bf-4ef0-b16d-37ebcb8afcd4','Count','Nos','count',NULL,1.0000,1,1,0,'2026-09-16 03:23:47','2026-09-16 03:23:47',NULL,NULL);
/*!40000 ALTER TABLE `product_units` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `whatsapp_templates` WRITE;
/*!40000 ALTER TABLE `whatsapp_templates` DISABLE KEYS */;
INSERT INTO `whatsapp_templates` (`id`, `name`, `category`, `message`, `media_url`, `is_active`, `created_at`, `updated_at`) VALUES (1,'Festive Season 20% Special Offer','FESTIVAL','Namaste {{customer_name}}! ✨\n\nCelebrate this season with exquisite designer wear and luxury timepieces from *Zellora*! ❤️\n\nEnjoy an exclusive *20% OFF* on all evening dresses and watches using coupon code *ZELLORA20* at checkout.\n\nShop the collection today: zellora.com 👗⌚',NULL,1,'2026-09-29 05:53:43','2026-09-29 05:53:43'),(2,'Festive Luxe Gift Box','FESTIVAL','Hello {{customer_name}}! 🎁\n\nTreat someone special to Zellora bespoke ethnic wear and handcrafted leather bags.\n\nComplimentary luxury gift wrapping on orders above ₹1999! ✨',NULL,1,'2026-09-29 05:53:43','2026-09-29 05:53:43'),(3,'Weekend Flash Sale','OFFER','Hello {{customer_name}}! ⚡\n\nLooking for the perfect weekend look? We\'ve got you covered!\n\nFlat 15% off on our relaxed linen shirts & denim collection this Saturday & Sunday only. Don\'t miss out! ✨',NULL,1,'2026-09-29 05:53:43','2026-09-29 05:53:43'),(4,'New Collection Drop','PROMOTION','Exciting news {{customer_name}}! 🌟\n\nWe just launched our all-new *AeroChrono Sapphire Watch* & *Emerald Silk Evening Gown*!\n\nBe among the first to explore the new drop with an introductory 15% discount. Discover luxury! ❤️',NULL,1,'2026-09-29 05:53:43','2026-09-29 05:53:43');
/*!40000 ALTER TABLE `whatsapp_templates` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES ('099fa805-6c46-43ef-8589-00fb7d20a011','ea3429c799c885155db7186580fd96a5e114f55ce0a148a7768d8fc01bdeda92','2026-09-16 11:10:45.738','20260916111045_add_color_size_price_adjustments',NULL,NULL,'2026-09-16 11:10:45.488',1),('107ecb69-3847-4d43-9941-0b8450c4e7cc','7f18b9aaf9096b416dbc5d473c9fbb783812aa20b3c5b6d18c74c5d323555231','2026-09-22 09:11:59.233','20260922100000_add_style_brand','',NULL,'2026-09-22 09:11:59.233',0),('20036d4c-c786-47f4-9978-d1cae6221870','e3593be88a009d9b7fa9294f791b247088fefeeba376935dd32e8d61bf72e2d9','2026-09-29 13:10:53.584','20261001100000_purchase_vendor_inventory',NULL,NULL,'2026-09-29 13:10:53.318',1),('2766979c-e94e-4e62-9eb4-5f99ab2a2aff','3ed8490e7a0393dbe479ff334a160ba3c307ce9ee495c056cf23a9a2b1c6edf1','2026-09-15 08:31:58.963','20260818100000_baseline',NULL,NULL,'2026-09-15 08:31:38.340',1),('3238c36e-1df0-4ab3-8b29-1550bdc5cb56','047837e6005abfb5b6ddcac226c7c3702874e0e688897825aced8cfba50bb23a','2026-09-25 15:05:41.891','20260926100000_order_specific_referral',NULL,NULL,'2026-09-25 15:05:40.613',1),('441646df-e572-48ee-b0fe-391344f5186b','a359ca62ea35a1ff8d0087d66b321d37a13daceeccee506ba8e13d25c2f1e570','2026-09-25 15:05:37.193','20260924100000_add_order_item_attributes_snapshot','',NULL,'2026-09-25 15:05:37.193',0),('5505e83c-882d-4da0-bf55-574f25a07c1b','a359ca62ea35a1ff8d0087d66b321d37a13daceeccee506ba8e13d25c2f1e570',NULL,'20260924100000_add_order_item_attributes_snapshot','A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260924100000_add_order_item_attributes_snapshot\n\nDatabase error code: 1060\n\nDatabase error:\nDuplicate column name \'attributes_snapshot\'\n\nPlease check the query number 1 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"20260924100000_add_order_item_attributes_snapshot\"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name=\"20260924100000_add_order_item_attributes_snapshot\"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:255','2026-09-25 15:05:37.185','2026-09-25 15:05:27.670',0),('57545f41-f01f-4982-88e7-4a888c631c14','1c9ede9b9630952c2c56b4c451964f52d800f58fcf231c330a51d061168d5ac9','2026-09-15 08:31:59.398','20260908140000_add_faq_icon',NULL,NULL,'2026-09-15 08:31:59.386',1),('5a6735ea-f610-4bf5-92d3-9dd228986f7c','6aa43f18f2b37b0943aa91427e54137c5264b47a1affc98625428bfefa600650','2026-09-17 16:32:13.975','20260917100000_add_agent_referral_attribution',NULL,NULL,'2026-09-17 16:32:06.283',1),('6194f55d-c648-4686-ac23-b2481f416071','d709db773390c49f319ee02d5c86878eb7dc5c1826796194ea5b841af1df1f73','2026-09-15 08:31:59.157','20260907000000_add_product_uuid_category_indexes',NULL,NULL,'2026-09-15 08:31:58.988',1),('69ddcb32-d9b0-4896-840a-eb8f5a31dec1','e93e9fcc735d121cb26b60833245839a0f0269b67ac96f083d7af6179972f262','2026-09-15 08:31:58.986','20260818120000_hash_registration_otp',NULL,NULL,'2026-09-15 08:31:58.967',1),('6cf80f2e-83b4-4192-89b8-c2c687e4da85','e01b15f8702b34c78ac78494036cbb788370b6c917e5fd396b3bb91af09e6e72','2026-09-25 05:37:05.395','20260925100000_agent_commission_system','',NULL,'2026-09-25 05:37:05.395',0),('6fc80b4f-4645-4c23-b09a-03afbcd6c14f','38fd1b0ba632389fefbc4b815344940aac728029d08c292e9fe700d713895767','2026-09-30 06:42:17.312','20261002100000_stock_movement_ledger',NULL,NULL,'2026-09-30 06:42:17.030',1),('7bd6d589-edb7-4a9c-90d4-23f376e3f733','3b9254d5c922b25d544ced840eba5fa59a060fc8878a33a0b37663b33a2fc2ee','2026-09-25 15:12:25.591','20260928100000_add_referral_code_to_payment_redirect_tokens',NULL,NULL,'2026-09-25 15:12:25.552',1),('95b1ed3e-57c2-4ec3-a773-c995c87d17fa','27de42c0259b9cbcaadcd01ccaad4ac20f270b74a4b18a9547ba038fdeb90222','2026-09-25 15:05:45.678','20260927100000_drop_user_referred_by_agent',NULL,NULL,'2026-09-25 15:05:41.894',1),('9778ac66-0589-4dae-be4e-b57c1b6173fa','7c8d1af54a429b6d2f732542162ae1f51479ce4ef3c90d8ec5f39b956fb30e76','2026-09-15 12:03:30.023','20260915120321_add_product_gender_and_size_charts','',NULL,'2026-09-15 12:03:30.023',0),('9ca24a6c-cf67-4d4c-890d-c732ece8ed78','3e7bd517f7ef669173a7e64ffc99b43c19a4c1b3b298fa1862b8cd65e70d55d9','2026-09-29 06:17:17.316','20260930110000_refund_return_link',NULL,NULL,'2026-09-29 06:17:17.167',1),('a0a8aaa2-9499-47ad-ac28-f685c52ff6cb','c67a3ca5beda706df84a0446f18da6f4cddc5d90d1f9d493f043dde8e54f5198','2026-09-25 15:04:38.531','20260918120000_add_attribute_value_image_url','',NULL,'2026-09-25 15:04:38.531',0),('a63b7e54-fd67-4c78-b16e-ef3bffeb08a7','a22e8761980985af90cb8833b3019ec650930b200fe6a67b477f9cd62dc339e4','2026-09-28 06:41:53.901','20260929100000_add_banner_hero_card_fields',NULL,NULL,'2026-09-28 06:41:53.804',1),('aac44b03-6cb2-48f5-af6a-a1c16252356b','c67a3ca5beda706df84a0446f18da6f4cddc5d90d1f9d493f043dde8e54f5198',NULL,'20260918120000_add_attribute_value_image_url','A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260918120000_add_attribute_value_image_url\n\nDatabase error code: 1060\n\nDatabase error:\nDuplicate column name \'image_url\'\n\nPlease check the query number 1 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"20260918120000_add_attribute_value_image_url\"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name=\"20260918120000_add_attribute_value_image_url\"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:255','2026-09-25 15:04:38.518','2026-09-24 11:11:28.085',0),('bc5bc50b-fe90-475d-bcb8-cd47c1efbea1','95ed94f9610ec426c20b139c76d6dd60f16103cf656c4144abaf80e3ecde992f','2026-09-25 15:05:24.091','20260918130000_add_attribute_multiple_selection','',NULL,'2026-09-25 15:05:24.091',0),('c82109ad-2cfa-4cd6-bc34-89ac1efe1ce4','a70f3dc00b586e6665c36f2b7725f71d1af05d6135679b716a0e2c47d2522170','2026-09-15 08:35:28.968','20260915083520_add_variant_attributes_offer_coupon_restrictions_inventory_reservations','',NULL,'2026-09-15 08:35:28.968',0),('cf8b809b-7350-47d9-8c77-e3fcb43ff07f','6a5593929d40e9e856e2c7c9427ed931cd9d9ce7d1c5b0c571f53e69be0f47d9','2026-09-30 07:52:38.415','20261003100000_purchase_idempotency_key',NULL,NULL,'2026-09-30 07:52:38.250',1),('d7a505da-d0e6-4ffb-876c-5aa1fd80f3a0','12e5472478707f7f93b303ae30c7892879391c1ddcf08309a505ee4d5b134663','2026-09-15 08:31:59.358','20260908000000_offer_management',NULL,NULL,'2026-09-15 08:31:59.160',1),('dc0c372e-c18b-486c-87b1-81e0cac60a15','95ed94f9610ec426c20b139c76d6dd60f16103cf656c4144abaf80e3ecde992f',NULL,'20260918130000_add_attribute_multiple_selection','A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260918130000_add_attribute_multiple_selection\n\nDatabase error code: 1060\n\nDatabase error:\nDuplicate column name \'multiple_selection\'\n\nPlease check the query number 1 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"20260918130000_add_attribute_multiple_selection\"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name=\"20260918130000_add_attribute_multiple_selection\"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:255','2026-09-25 15:05:24.083','2026-09-25 15:04:54.463',0),('e2dd7c13-19b3-479d-be1e-f3ac2d4ba6f3','6b9c68e021879d25f20fa01db6efeee7fd9f117f00f59993c426f6ab7036dfb5','2026-09-15 08:31:59.383','20260908120000_add_faq_indexes',NULL,NULL,'2026-09-15 08:31:59.359',1),('f5c49ed9-bd88-4e3c-a482-fd397a498768','c4377abd8eb33e05b07fc1913ce33f2a44150d4cde72a8b6e76d556c145a7a67','2026-09-29 06:08:08.990','20260930100000_order_cancel_return_replacement',NULL,NULL,'2026-09-29 06:08:07.989',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `product_brands` WRITE;
/*!40000 ALTER TABLE `product_brands` DISABLE KEYS */;
INSERT INTO `product_brands` (`id`, `uuid`, `name`, `slug`, `description`, `status`, `is_active`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`) VALUES (1,'8d8b44ce-87b1-4ef1-8a70-61bfbd6d828a','H&M','H_M','H&M',1,1,'2026-09-23 07:36:52','2026-09-23 07:36:52',NULL,1,1),(2,'27c40293-5a93-41e0-b3b6-8dfb80929fdc','Uniqlo','UNIQLO','Uniqlo',1,1,'2026-09-23 07:42:38','2026-09-23 07:42:38',NULL,1,1),(3,'47e3ace1-f33f-4fb3-b319-ee5ec70e40b0','Zudio','ZUDIO','Zudio',1,1,'2026-09-23 07:42:48','2026-09-23 07:42:48',NULL,1,1),(4,'5637279c-8cc9-41ce-9939-bf14471060a5','SK Silks','SK_SILKS',NULL,1,1,'2026-09-24 02:32:29','2026-09-24 02:32:29',NULL,1,1),(5,'4faaf409-adf4-490a-b3ec-f2a733e0b2a2','TIMEWEAR','TIMEWEAR',NULL,1,1,'2026-09-24 05:51:30','2026-09-24 05:51:30',NULL,1,1);
/*!40000 ALTER TABLE `product_brands` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `header_menu_items` WRITE;
/*!40000 ALTER TABLE `header_menu_items` DISABLE KEYS */;
INSERT INTO `header_menu_items` (`id`, `uuid`, `label`, `link`, `sort_order`, `is_active`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `gender`) VALUES (5,'4d5cfedf-0d67-469e-a563-c4c3bc2bae50','Men\'s Clothing',NULL,0,0,'2026-09-23 02:06:21','2026-09-23 04:21:25',NULL,NULL,1,NULL),(6,'50ae578d-3eff-49ff-8ef5-1511e774ea69','Footwear',NULL,0,0,'2026-09-23 02:06:21','2026-09-23 04:21:26',NULL,NULL,1,NULL),(7,'b6a45a32-7a3c-4f7f-8b89-592fd5fee4df','Sale','/products?sortBy=discount',2,1,'2026-09-23 02:06:21','2026-09-23 02:06:21',NULL,NULL,NULL,NULL),(9,'02b02f2d-fbff-4ca0-8fdd-87a68dca5e09','Women',NULL,1,0,'2026-09-23 04:17:01','2026-09-23 07:24:14','2026-09-23 07:24:14',1,1,NULL),(10,'2321361d-68a8-4e55-a9ea-e8d636ff5aad','Women',NULL,0,1,'2026-09-23 06:45:54','2026-09-23 08:51:52',NULL,1,1,'women'),(11,'3f653fda-d6b5-49f8-836d-ba1cc5f14979','Mens',NULL,0,1,'2026-09-23 07:31:06','2026-09-23 08:51:52',NULL,1,1,'men'),(12,'89c163f0-a1e3-4b32-a99c-27db4e063390','Accessories',NULL,3,1,'2026-09-24 05:45:32','2026-09-24 05:45:32',NULL,1,1,'unisex'),(13,'a03d9474-96d6-4e2c-babc-03f4162ba29c','Electronics',NULL,0,1,'2026-09-29 05:44:32','2026-09-29 05:45:37',NULL,1,1,'unisex');
/*!40000 ALTER TABLE `header_menu_items` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `uuid`, `role_id`, `cust_id`, `name`, `email`, `phone`, `password_hash`, `avatar`, `status`, `email_verified_at`, `phone_verified_at`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`, `is_active`, `created_by`, `updated_by`, `is_blocked`, `blocked_at`, `referral_code`, `referred_at`) VALUES (1,'52f828fc-6601-43f7-b50a-0c10361394e5',1,NULL,'Admin','admin@zellora.com',NULL,'$2b$12$fqqzQpGDV5LAqG.GSkE4x.80VqBXvsMT9Jrg/iMbQCeL8sjWCImbu',NULL,'active','2026-09-15 03:25:14',NULL,'2026-09-17 08:23:41','2026-09-15 03:25:14','2026-09-17 08:23:41',NULL,1,NULL,NULL,NULL,'2026-09-15 03:25:14',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `product_categories` WRITE;
/*!40000 ALTER TABLE `product_categories` DISABLE KEYS */;
INSERT INTO `product_categories` (`id`, `uuid`, `parent_id`, `name`, `slug`, `description`, `icon`, `status`, `is_active`, `sort_order`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`) VALUES (16,'533b8ca3-4088-4da5-9ed7-d1f2437bdc1c',NULL,'Men\'s Clothing','MENS_CLOTHING-deleted-16','','/document/categories/7b20e2e2-f752-4b56-a9e6-a015b6131aed.jpg',1,0,0,'2026-09-16 03:00:38','2026-09-23 06:35:45','2026-09-23 06:35:45',NULL,1),(17,'cdc6498e-a91d-4f04-a7e4-8d63cf206071',NULL,'Footwear','FOOTWEAR-deleted-17','','/document/categories/1c81616b-41e8-44e5-8115-d19aad757743.jpg',1,0,0,'2026-09-19 05:51:33','2026-09-23 06:35:52','2026-09-23 06:35:52',1,1),(18,'227be2ae-2cbf-4585-910d-6a86960a3ee7',NULL,'Dress','DRESS','fashion and clothing','/document/categories/0fb6e221-c7d8-4759-bc5b-2b411b7bfaed.jpg',1,1,1,'2026-09-23 06:33:27','2026-09-23 06:33:42',NULL,1,1),(19,'92ed6bbd-c107-490f-a3fb-51b6d8e736a9',NULL,'Footwear','FOOTWEAR','Shoes, sandals and slippers','/document/categories/23f5c1fa-b69f-448d-af6d-ea6b1961770e.webp',1,1,2,'2026-09-23 06:38:05','2026-09-23 06:42:23',NULL,1,1),(20,'cc2b8757-6757-4516-9f6e-1d865be4421c',NULL,'Bags','BAGS','Handbags, backpacks and wallets','/document/categories/823eb8d8-ab13-4cb7-9e5b-b1e2f8cccc20.jpg',1,1,3,'2026-09-23 06:40:13','2026-09-23 06:40:13',NULL,1,1),(21,'8f5cb3a3-0df7-4230-a03b-1790fde80b08',NULL,'Accessories','ACCESSORIES','Belts, watches, sunglasses and other accessories','/document/categories/8a252669-a3ef-49af-8d0d-85f3429bb195.jpg',1,1,4,'2026-09-23 06:41:53','2026-09-23 06:42:03',NULL,1,1),(22,'b98f4aa5-6833-4ccd-b008-30ba56138b76',NULL,'Jewellery','JEWELLERY','Earrings, necklaces, bracelets and rings','/document/categories/aab96ae0-ffab-4319-8109-ec43b98d8e64.webp',1,1,5,'2026-09-23 06:44:20','2026-09-23 06:44:20',NULL,1,1),(23,'e84c5011-b092-4cba-b079-a76cdc710fa9',NULL,'Electronics','ELECTRONICS','','/document/categories/841425c3-57ac-42d1-b87e-5f890e5b581d.webp',1,1,0,'2026-09-29 05:32:14','2026-09-29 05:32:14',NULL,1,1);
/*!40000 ALTER TABLE `product_categories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `header_menu_item_categories` WRITE;
/*!40000 ALTER TABLE `header_menu_item_categories` DISABLE KEYS */;
INSERT INTO `header_menu_item_categories` (`id`, `header_menu_item_id`, `category_id`, `sort_order`, `created_at`) VALUES (1,5,16,0,'2026-09-23 02:06:21'),(5,6,17,0,'2026-09-23 02:18:32'),(6,6,16,1,'2026-09-23 02:18:32'),(9,10,18,0,'2026-09-23 06:45:54'),(10,10,19,1,'2026-09-23 06:45:54'),(11,10,21,2,'2026-09-23 06:45:54'),(12,9,18,0,'2026-09-23 07:21:28'),(13,9,19,1,'2026-09-23 07:21:28'),(14,11,18,0,'2026-09-23 07:31:06'),(15,11,19,1,'2026-09-23 07:31:06'),(16,12,21,0,'2026-09-24 05:45:32'),(18,13,23,0,'2026-09-29 05:45:37');
/*!40000 ALTER TABLE `header_menu_item_categories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `product_attributes` WRITE;
/*!40000 ALTER TABLE `product_attributes` DISABLE KEYS */;
INSERT INTO `product_attributes` (`id`, `name`, `slug`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`, `uuid`, `type`, `multiple_selection`) VALUES (21,'Colour','COLOUR','2026-09-18 04:14:15','2026-09-18 04:14:15',1,1,1,'b251e2e2-607b-4da9-9620-3a625ab053b3','color',1),(22,'Slipper Sizes','SLIPPER_SIZES','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'471a268b-39ce-4807-9acf-9b6dc6e3dad2','text',1),(23,'Slipper Type','SLIPPER_TYPE','2026-09-23 04:30:13','2026-09-23 04:30:13',1,1,1,'055560a5-fdc2-41f0-9259-3b0d87dc6137','text',1),(24,'Neck','NECK_TYPE','2026-09-23 08:21:53','2026-09-23 08:21:53',1,1,1,'d18bc27b-a1c2-40c1-9f93-7b1789588211','text',0),(25,'Storage','STORAGE_SIZE','2026-09-29 05:39:46','2026-09-29 05:39:46',1,1,1,'e53b0b33-af4c-425f-8cae-a448743ae401','text',0);
/*!40000 ALTER TABLE `product_attributes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `attribute_values` WRITE;
/*!40000 ALTER TABLE `attribute_values` DISABLE KEYS */;
INSERT INTO `attribute_values` (`id`, `attribute_id`, `value`, `created_at`, `updated_at`, `is_active`, `created_by`, `updated_by`, `uuid`, `price_adjustment`, `color_hex`, `image_url`) VALUES (33,21,'Black','2026-09-18 04:14:15','2026-09-18 04:14:15',1,1,1,'40eefdbf-f502-48a1-a7bb-993e72ba633f',0.00,'#000000',NULL),(34,21,'White','2026-09-18 04:14:15','2026-09-18 04:14:15',1,1,1,'eabe7576-0544-4c95-94f1-26aa9ef1bf65',0.00,'#ffffff',NULL),(35,21,'red','2026-09-18 04:14:15','2026-09-18 04:14:15',1,1,1,'63779e51-7b7b-4035-a7e0-046bc8dcb2bc',0.00,'#ff0000',NULL),(36,22,'7','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'add732c4-b1e9-4beb-9604-1bf02ad3db1e',0.00,NULL,NULL),(37,22,'8','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'65abb8a7-5ee9-4e09-9eed-3dad99446b26',0.00,NULL,NULL),(38,22,'9','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'24b05055-80f5-4cb6-9141-52ed22d1650e',0.00,NULL,NULL),(39,22,'2','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'d8e26919-858d-40bf-8222-685629866db9',0.00,NULL,NULL),(40,22,'3','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'9b29ce3c-7768-4698-86f9-c1e5a2cc0c01',0.00,NULL,NULL),(41,22,'4','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'25ea6ba5-6e52-438c-9b56-ffbf78807093',0.00,NULL,NULL),(42,22,'5','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'2d97bee7-f362-4198-b552-205f77b74c09',0.00,NULL,NULL),(43,22,'6','2026-09-19 05:58:23','2026-09-19 05:58:23',1,1,1,'9e20c34e-8e76-4bc2-9800-773ed779ed72',0.00,NULL,NULL),(44,21,'blue','2026-09-21 06:26:05','2026-09-21 06:26:05',1,1,1,'926d3174-1055-492b-925c-63be07d294eb',0.00,'#0008ff',NULL),(45,21,'Green','2026-09-22 01:40:51','2026-09-22 01:40:51',1,1,1,'3256b91a-8a15-40a9-9272-2e3d9de067c7',0.00,'#2F5960',NULL),(46,23,'V Shape','2026-09-23 04:30:13','2026-09-23 04:30:13',1,1,1,'52d24e6c-9fb6-4ac4-8d64-1a49802b5075',0.00,NULL,NULL),(47,23,'Regular','2026-09-23 04:30:13','2026-09-23 04:30:13',1,1,1,'1a62be5c-fbd2-4e93-ab2b-b0fabad519a2',0.00,NULL,NULL),(48,24,'Polo Collar','2026-09-23 08:21:53','2026-09-23 08:21:53',1,1,1,'d7a2c197-bde4-41db-b112-32afa75f4068',0.00,NULL,NULL),(49,24,'Round Neck','2026-09-23 08:21:53','2026-09-23 08:21:53',1,1,1,'7f62479f-53cf-40bc-83ae-67b5820b357e',0.00,NULL,NULL),(50,21,'Gold','2026-09-29 04:25:07','2026-09-29 04:25:07',1,1,1,'78cc41ed-94ca-4c22-a42e-5c143f8d2c91',0.00,'#ffd747',NULL),(51,25,'64GB','2026-09-29 05:39:46','2026-09-29 05:39:46',1,1,1,'7959b7a3-46af-4616-9a58-0abaa44c4f5c',0.00,NULL,NULL),(52,25,'128GB','2026-09-29 05:41:44','2026-09-29 05:41:44',1,1,1,'55b7eb94-cb84-4f29-80ef-53961f933f7a',0.00,NULL,NULL);
/*!40000 ALTER TABLE `attribute_values` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

