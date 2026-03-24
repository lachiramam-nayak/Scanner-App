#!/bin/bash

echo "Populating database with dummy data..."

docker exec -i ram_postgres psql -U ram -d ramdb << 'SQL'

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2),
  stock INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  product_id INT REFERENCES products(id),
  quantity INT,
  ordered_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (name, email) VALUES
  ('Ram', 'ram@example.com'),
  ('Sita', 'sita@example.com'),
  ('Krishna', 'krishna@example.com'),
  ('Arjun', 'arjun@example.com'),
  ('Lakshman', 'lakshman@example.com');

INSERT INTO products (name, price, stock) VALUES
  ('Widget Pro', 299.99, 50),
  ('Gadget Lite', 99.50, 200),
  ('Thingamajig', 19.99, 1000);

INSERT INTO orders (user_id, product_id, quantity) VALUES
  (1, 2, 3),
  (2, 1, 1),
  (3, 3, 10),
  (4, 2, 2);

SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;

SQL

echo "Done."
