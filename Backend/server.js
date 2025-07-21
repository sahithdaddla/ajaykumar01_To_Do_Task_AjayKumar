require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3051;
const ipAddress = process.env.HOST || '0.0.0.0';

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'new_employee_db',
    password: process.env.DB_PASSWORD || 'admin123',
    port: process.env.DB_PORT || 5432,
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG, TXT'));
        }
    },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Employee endpoint
app.get('/api/employees/:empId', async (req, res) => {
    const { empId } = req.params;
    try {
        if (!/^[ATS]{3}0(?!000)[0-9]{3}$/.test(empId)) {
            return res.status(400).json({ error: 'Invalid employee ID format' });
        }

        const result = await pool.query('SELECT * FROM employees WHERE emp_id = $1', [empId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching employee:', err.stack);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
});

// Get tasks endpoint
app.get('/api/tasks', async (req, res) => {
    const { employeeId } = req.query;
    try {
        let query = 'SELECT * FROM tasks ORDER BY created_at DESC';
        let params = [];
        if (employeeId) {
            if (!/^ATS0\d{3}$/.test(employeeId)) {
                return res.status(400).json({ error: 'Invalid employee ID format' });
            }
            query = 'SELECT * FROM tasks WHERE employee_id = $1 ORDER BY created_at DESC';
            params = [employeeId];
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tasks:', err.stack);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Create task endpoint
app.post('/api/tasks', async (req, res) => {
    const { taskName, employeeName, employeeId, email, taskDescription, allocatedDate, deadline, status } = req.body;
    if (!taskName || !employeeName || !employeeId || !email || !taskDescription || !allocatedDate || !deadline) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!/^[a-zA-Z][a-zA-Z0-9._-]*[a-zA-Z0-9]@astrolitetech\.com$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format. Must be name@astrolitetech.com' });
    }

    if (!/^ATS0\d{3}$/.test(employeeId)) {
        return res.status(400).json({ error: 'Invalid employee ID format' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO tasks (id, task_name, employee_name, employee_id, email, task_description, allocated_date, deadline, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) RETURNING *`,
            [Date.now().toString(), taskName, employeeName, employeeId, email, taskDescription, allocatedDate, deadline, status || 'assigned']
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error saving task:', err.stack);
        res.status(500).json({ error: 'Failed to save task' });
    }
});

// Get single task endpoint
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

// Get task history endpoint
app.get('/api/task-history', async (req, res) => {
    const { employeeId } = req.query;
    try {
        let query = 'SELECT id, task_name, employee_name, employee_id, email, description, task_status, allocated_time, upload_doc IS NOT NULL AS has_file FROM task_history ORDER BY allocated_time DESC';
        let params = [];
        if (employeeId) {
            if (!/^ATS0\d{3}$/.test(employeeId)) {
                return res.status(400).json({ error: 'Invalid employee ID format' });
            }
            query = 'SELECT id, task_name, employee_name, employee_id, email, description, task_status, allocated_time, upload_doc IS NOT NULL AS has_file FROM task_history WHERE employee_id = $1 ORDER BY allocated_time DESC';
            params = [employeeId];
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching task history:', err.stack);
        res.status(500).json({ error: 'Failed to fetch task history' });
    }
});

// Create task history endpoint
app.post('/api/task-history', upload.single('uploadDoc'), async (req, res) => {
    try {
        const { taskName, employeeName, employeeId, email, description, taskStatus } = req.body;
        const fileBuffer = req.file ? req.file.buffer : null;

        // Validation
        if (!taskName || !employeeName || !employeeId || !email || !description || !taskStatus) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!/^[a-zA-Z][a-zA-Z0-9._-]*[a-zA-Z0-9]@astrolitetech\.com$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!/^ATS0\d{3}$/.test(employeeId)) {
            return res.status(400).json({ error: 'Invalid employee ID format' });
        }

        console.log('Uploading task history:', { taskName, employeeName, employeeId, email, taskStatus, hasFile: !!fileBuffer });

        const result = await pool.query(
            `INSERT INTO task_history (task_name, employee_name, employee_id, email, description, upload_doc, task_status, allocated_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING id, task_name, employee_name, employee_id, email, description, task_status, allocated_time, upload_doc IS NOT NULL AS has_file`,
            [taskName, employeeName, employeeId, email, description, fileBuffer, taskStatus]
        );

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Task history saved successfully'
        });
    } catch (err) {
        console.error('Error saving task history:', err.stack);
        res.status(500).json({ error: 'Failed to save task history' });
    }
});

// Get task history file endpoint
app.get('/api/task-history/:id/file', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT upload_doc, task_name FROM task_history WHERE id = $1', [id]);
        if (result.rows.length === 0 || !result.rows[0].upload_doc) {
            return res.status(404).json({ error: 'File not found' });
        }

        const fileBuffer = result.rows[0].upload_doc;

        let contentType = 'application/octet-stream';
        if (fileBuffer.length > 4) {
            if (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
                contentType = 'application/pdf';
            } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
                contentType = 'image/png';
            } else if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
                contentType = 'image/jpeg';
            } else if (fileBuffer.slice(0, 100).toString().match(/^[\x00-\x7F]*$/)) {
                contentType = 'text/plain';
            }
        }

        res.set({
            'Content-Type': contentType,
            'Content-Disposition': 'inline'
        });
        res.send(fileBuffer);
    } catch (err) {
        console.error('Error retrieving file:', err.stack);
        res.status(500).json({ error: 'Failed to retrieve file' });
    }
});

// Get single task history endpoint
app.get('/api/task-history/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, task_name, employee_name, employee_id, email, description, task_status, allocated_time, upload_doc IS NOT NULL AS has_file FROM task_history WHERE id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task history not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching task history:', err.stack);
        res.status(500).json({ error: 'Failed to fetch task history' });
    }
});

// Serve HR and Employee pages
app.get('/hr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hr.html'));
});

app.get('/employee', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Database initialization
async function initializeDatabase(retries = 5, delay = 5000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS employees (
                    emp_id VARCHAR(7) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL,
                    department VARCHAR(100) NOT NULL
                );

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
            `);
            console.log('✅ Database tables initialized successfully');
            return;
        } catch (err) {
            console.error(`❌ Attempt ${attempt} - Error initializing database:`, err.message);
            if (attempt < retries) {
                console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                throw new Error('Failed to connect to PostgreSQL after multiple attempts.');
            }
        }
    }
}

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        app.listen(port, ipAddress, () => {
            console.log(`🚀 Server running at http://${ipAddress}:${port}`);
        });
    } catch (err) {
        console.error('💥 Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();