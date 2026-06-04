-- Create database
CREATE DATABASE IF NOT EXISTS scene_script_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE scene_script_db;

-- Drop script tables if they exist
DROP TABLE IF EXISTS ss_user;
DROP TABLE IF EXISTS ss_script_result;
DROP TABLE IF EXISTS ss_script_chapter;
DROP TABLE IF EXISTS ss_script_task;

-- User table
CREATE TABLE IF NOT EXISTS ss_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Script task table
CREATE TABLE ss_script_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NULL,
    title VARCHAR(255) NULL,
    genre VARCHAR(64) NULL,
    tone VARCHAR(64) NULL,
    pacing ENUM('fast','medium','slow') NOT NULL DEFAULT 'medium',
    source_chapters INT NOT NULL,
    status ENUM('pending','running','succeeded','failed') NOT NULL DEFAULT 'pending',
    err_msg TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_user (user_id),
    INDEX idx_task_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Script chapter table
CREATE TABLE ss_script_chapter (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    chapter_index INT NOT NULL,
    chapter_title VARCHAR(255) NULL,
    chapter_text LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_chapter_task (task_id),
    INDEX idx_chapter_order (task_id, chapter_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Script result table
CREATE TABLE ss_script_result (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL UNIQUE,
    yaml LONGTEXT NOT NULL,
    summary_json JSON NULL,
    consistency_json JSON NULL,
    generated_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_result_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test data (optional)
INSERT INTO ss_user (username, email, password) VALUES 
('admin', 'admin@example.com', '$2a$10$OOlznA7saHLwg/W3vVX1gu1bwCRh53CRZbexjCiWTe.2UfvLlToIO'),
('test', 'test@example.com', '$2a$10$y8owDIYbIwHQUNPlrXwatO8sZhmCReUXVAB0DyQ8y3obnV6ToTDFS');
-- password is: admin\test