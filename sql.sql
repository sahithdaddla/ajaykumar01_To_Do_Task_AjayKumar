CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    task_name VARCHAR(25) NOT NULL,
    employee_name VARCHAR(30) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    task_description VARCHAR(60) NOT NULL,
    allocated_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_history (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    upload_doc BYTEA,
    task_status VARCHAR(20) NOT NULL,
    allocated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);