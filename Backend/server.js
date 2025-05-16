require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000; // Use PORT from .env or default to 3000
const ipAddress = process.env.HOST || '0.0.0.0'; // Use HOST from .env or default to all interfaces

// PostgreSQL connection configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'new_employee_db',
    password: process.env.DB_PASSWORD || 'Password@12345',
    port: process.env.DB_PORT || 5432,
});

// Multer configuration for file uploads (stores file in memory as a Buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG, TXT'));
        }
    },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon.ico to suppress 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database tables
async function initializeDatabase() {
    try {
        await pool.query(`
            drop table if exists tasks;
            drop table if exists task_history;
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
                upload_doc BYTEA, -- Stores the full file as binary data
                task_status VARCHAR(20) NOT NULL,
                allocated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err.stack);
        throw err;
    }
}

// API Routes
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tasks:', err.stack);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.post('/api/tasks', async (req, res) => {
    const { taskName, employeeName, employeeId, taskDescription, allocatedDate, deadline, status } = req.body;
    if (!taskName || !employeeName || !employeeId || !taskDescription || !allocatedDate || !deadline) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO tasks (id, task_name, employee_name, employee_id, task_description, allocated_date, deadline, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) RETURNING *`,
            [Date.now().toString(), taskName, employeeName, employeeId, taskDescription, allocatedDate, deadline, status || 'assigned']
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error saving task:', err.stack);
        res.status(500).json({ error: 'Failed to save task' });
    }
});

app.get('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching task:', err.stack);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

app.get('/api/task-history', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, task_name, employee_name, employee_id, task_status, allocated_time FROM task_history ORDER BY allocated_time DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching task history:', err.stack);
        res.status(500).json({ error: 'Failed to fetch task history' });
    }
});

app.post('/api/task-history', upload.single('uploadDoc'), async (req, res) => {
    const { taskName, employeeName, employeeId, taskStatus } = req.body;
    const fileBuffer = req.file ? req.file.buffer : null; // File content as Buffer
    if (!taskName || !employeeName || !employeeId || !taskStatus) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO task_history (task_name, employee_name, employee_id, upload_doc, task_status, allocated_time)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id, task_name, employee_name, employee_id, task_status, allocated_time`,
            [taskName, employeeName, employeeId, fileBuffer, taskStatus]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error saving task history:', err.stack);
        res.status(500).json({ error: 'Failed to save task history' });
    }
});

app.get('/api/task-history/:id/file', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT upload_doc, task_name FROM task_history WHERE id = $1', [id]);
        if (result.rows.length === 0 || !result.rows[0].upload_doc) {
            return res.status(404).json({ error: 'File not found' });
        }
        const fileBuffer = result.rows[0].upload_doc;
        const taskName = result.rows[0].task_name.replace(/\s+/g, '_');
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${taskName}_document"`,
        });
        res.send(fileBuffer);
    } catch (err) {
        console.error('Error retrieving file:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve file' });
    }
});

// Specific routes for HTML pages
app.get('/hr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/employee', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

// Catch-all route for unmatched requests
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        app.listen(port, ipAddress, () => {
            console.log(`Server running at http://${ipAddress}:${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err.stack);
        process.exit(1);
    }
}

startServer();