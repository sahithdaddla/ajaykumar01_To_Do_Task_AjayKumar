
CREATE TABLE IF NOT EXISTS employees (
    emp_id VARCHAR(7) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    email VARCHAR(100) NOT NULL,
    task_description TEXT NOT NULL,
    allocated_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create task_history table
CREATE TABLE IF NOT EXISTS task_history (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    email VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    upload_doc BYTEA,
    task_status VARCHAR(20) NOT NULL,
    allocated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_history_employee_id ON task_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_status ON task_history(task_status);