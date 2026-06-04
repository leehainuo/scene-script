-- Create database
CREATE DATABASE IF NOT EXISTS scene_script_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE scene_script_db;

-- SysUser table
DROP TABLE IF EXISTS sys_user;
CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test data (optional)
INSERT INTO sys_user (username, email, password) VALUES 
('admin', 'admin@example.com', '$2a$10$OOlznA7saHLwg/W3vVX1gu1bwCRh53CRZbexjCiWTe.2UfvLlToIO'),
('test', 'test@example.com', '$2a$10$y8owDIYbIwHQUNPlrXwatO8sZhmCReUXVAB0DyQ8y3obnV6ToTDFS');
-- password is: admin\test