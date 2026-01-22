CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"staff_id" text NOT NULL,
	"staff_name" text NOT NULL,
	"shift_id" text,
	"amount" real,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"store_name" text DEFAULT 'My Store' NOT NULL,
	"store_address" text,
	"store_phone" text,
	"store_logo_url" text,
	"mobile_payment_qr_url" text,
	"ai_image_recognition_enabled" boolean DEFAULT false NOT NULL,
	"enable_tax" boolean DEFAULT false NOT NULL,
	"tax_percentage" real DEFAULT 0 NOT NULL,
	"enable_local_ai" boolean DEFAULT false NOT NULL,
	"local_ai_url" text,
	"local_ai_model" text,
	"gemini_api_key" text,
	"groq_api_key" text,
	"enable_mobile_scanner" boolean DEFAULT true NOT NULL,
	"enable_photo_capture" boolean DEFAULT true NOT NULL,
	"currency_code" text DEFAULT 'THB' NOT NULL,
	"currency_symbol" text DEFAULT '฿' NOT NULL,
	"currency_position" text DEFAULT 'before' NOT NULL,
	"delivery_rider_pin" text DEFAULT '8888',
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"staff_name" text NOT NULL,
	"business_unit_id" text,
	"date" text NOT NULL,
	"clock_in_time" text NOT NULL,
	"clock_out_time" text,
	"total_hours" real,
	"opening_cash" real DEFAULT 0 NOT NULL,
	"total_sales" real DEFAULT 0 NOT NULL,
	"cash_sales" real DEFAULT 0 NOT NULL,
	"card_sales" real DEFAULT 0 NOT NULL,
	"credit_sales" real DEFAULT 0 NOT NULL,
	"mobile_sales" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"settings" text,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catering_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"catering_order_id" integer,
	"item_name" text,
	"quantity" integer NOT NULL,
	"unit_price" integer,
	"total_price" integer,
	"is_addon" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "catering_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_date" text NOT NULL,
	"delivery_address" text,
	"total_amount" integer,
	"deposit_paid" integer DEFAULT 0,
	"status" text DEFAULT 'confirmed',
	"created_by_user_id" integer,
	"created_at" text NOT NULL,
	"driver_lat" real,
	"driver_lng" real,
	"location_updated_at" text,
	"proof_image_url" text,
	"payment_slip_url" text
);
--> statement-breakpoint
CREATE TABLE "catering_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"price" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_shared" boolean DEFAULT false,
	CONSTRAINT "catering_products_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"type" text NOT NULL,
	"transaction_type" text,
	"amount" real NOT NULL,
	"balance_after" real NOT NULL,
	"description" text,
	"sale_id" text,
	"voucher_image_url" text,
	"timestamp" text NOT NULL,
	"created_at" text NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"barcode" text,
	"member_id" text,
	"image_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"credit_limit" real DEFAULT 0 NOT NULL,
	"current_balance" real DEFAULT 0 NOT NULL,
	"due_date" text,
	"credit_due_date" text,
	"monthly_closing_day" integer,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"risk_tag" text DEFAULT 'low' NOT NULL,
	"business_unit_id" text,
	"origin_unit" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "customers_barcode_unique" UNIQUE("barcode"),
	CONSTRAINT "customers_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"amount" real NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"receipt_image_url" text,
	"note" text,
	"timestamp" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"type" text NOT NULL,
	"quantity_changed" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"current_stock" integer NOT NULL,
	"staff_id" text,
	"staff_name" text,
	"reason" text,
	"timestamp" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"business_unit_id" text NOT NULL,
	"table_id" text,
	"table_number" text,
	"items" text,
	"status" text DEFAULT 'in_preparation' NOT NULL,
	"started_at" text,
	"ready_at" text,
	"served_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_buffers" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"transaction_id" text,
	"sender_name" text,
	"sms_content" text,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" text,
	"order_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"translated_name" text,
	"price" real NOT NULL,
	"cost" real DEFAULT 0,
	"barcode" text,
	"image_data" text,
	"image_url" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"special_stock" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"category" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_daily_special" boolean DEFAULT false NOT NULL,
	"is_standard_menu" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"business_unit_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"table_number" text NOT NULL,
	"table_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "restaurant_tables_table_number_unique" UNIQUE("table_number")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" real NOT NULL,
	"total" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" text PRIMARY KEY NOT NULL,
	"subtotal" real NOT NULL,
	"discount" real DEFAULT 0 NOT NULL,
	"tax" real NOT NULL,
	"total" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"order_source" text DEFAULT 'pos' NOT NULL,
	"order_type" text DEFAULT 'dine-in' NOT NULL,
	"table_number" text,
	"customer_id" text,
	"customer_name" text,
	"customer_phone" text,
	"delivery_address" text,
	"requested_delivery_time" text,
	"payment_proof_url" text,
	"store_id" text,
	"business_unit_id" text NOT NULL,
	"staff_id" text,
	"created_by" text,
	"payment_slip_url" text,
	"timestamp" text NOT NULL,
	"created_at" text NOT NULL,
	"driver_lat" real,
	"driver_lng" real,
	"location_updated_at" text,
	"phone_verified" boolean DEFAULT false,
	"guest_id" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"staff_name" text NOT NULL,
	"business_unit_id" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"opening_cash" real NOT NULL,
	"closing_cash" real,
	"status" text NOT NULL,
	"total_sales" real DEFAULT 0 NOT NULL,
	"cash_sales" real DEFAULT 0 NOT NULL,
	"card_sales" real DEFAULT 0 NOT NULL,
	"credit_sales" real DEFAULT 0 NOT NULL,
	"mobile_sales" real DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"sender" text,
	"message_content" text,
	"extracted_amount" real,
	"status" text DEFAULT 'received' NOT NULL,
	"matched_order_id" text,
	"buffer_record_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pin" text NOT NULL,
	"password" text,
	"role" text NOT NULL,
	"barcode" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_guest" boolean DEFAULT false NOT NULL,
	"business_unit_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "staff_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"current_order" text,
	"last_ordered" text,
	"service_status" text,
	"business_unit_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_items" ADD CONSTRAINT "catering_items_catering_order_id_catering_orders_id_fk" FOREIGN KEY ("catering_order_id") REFERENCES "public"."catering_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_origin_unit_business_units_id_fk" FOREIGN KEY ("origin_unit") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_order_id_sales_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;