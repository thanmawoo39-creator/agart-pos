
-- Data for app_settings (1 records)
-- Record 1
INSERT INTO app_settings (id, store_name, store_address, store_phone, store_logo_url, ai_image_recognition_enabled, enable_tax, tax_percentage, gemini_api_key, groq_api_key, enable_mobile_scanner, enable_photo_capture, currency_code, currency_symbol, currency_position, updated_at, enable_local_ai, local_ai_url, local_ai_model) VALUES (1, 'My Store', '', '', NULL, 1, 0, 0, 'AIzaSyANLmRwuIQVHWRST1rWpfZCYUUdqSctjKc', '', 1, 1, 'MMK', 'K', 'after', '2026-01-11T02:34:10.109Z', 1, '', NULL);


-- Data for attendance (1 records)
-- Record 1
INSERT INTO attendance (id, staff_id, staff_name, date, clock_in_time, clock_out_time, total_hours, opening_cash, total_sales, cash_sales, card_sales, credit_sales, mobile_sales) VALUES ('80c1c894-f7ac-44d3-83b6-61cb79ae293b', 'ff684a5f-9c34-4b06-87a5-7a5f35ea8445', 'Admin', '2026-01-09', '2026-01-09T08:21:01.239Z', '', 0, 0, 0, 0, 0, 0, 0);


-- Data for staff (1 records)
-- Record 1
INSERT INTO staff (id, name, pin, role, barcode, status, created_at, updated_at) VALUES ('ff684a5f-9c34-4b06-87a5-7a5f35ea8445', 'Admin', 'c0f5575f3b329d1893ffe7d4fc894ecd:baccffd6e30f1daa42d2b315c447646ede79e4addf83ec3cc912920bf5dea543945a650f26ed990519dab2624bda6fa9f552608a864a00efbf326983ec4af8bd', 'owner', NULL, 'active', '2024-01-01 00:00:00', '2024-01-01 00:00:00');

