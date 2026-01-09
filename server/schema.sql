CREATE DATABASE IF NOT EXISTS kasirpro_db;
USE kasirpro_db;

-- Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users / Staff Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'admin', 'staff') DEFAULT 'staff',
    pin VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    category_id INT,
    type VARCHAR(50) DEFAULT 'Default',
    buy_price DECIMAL(15, 2) DEFAULT 0,
    sell_price DECIMAL(15, 2) DEFAULT 0,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    stock_type ENUM('Barang', 'Jasa') DEFAULT 'Barang',
    weight INT DEFAULT 0,
    discount DECIMAL(5, 2) DEFAULT 0,
    shelf_location VARCHAR(50),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    user_id INT,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
