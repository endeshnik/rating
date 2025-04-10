const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Налаштування бази даних
const db = new sqlite3.Database('./school_ratings.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    }
    console.log('Підключено до бази даних SQLite. Path:', path.resolve('./school_ratings.db'));
});

// Створення таблиці учнів (користувачів)
db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    class TEXT,
    is_admin INTEGER DEFAULT 0
)`, (err) => {
    if (err) {
        console.error('Error creating students table:', err.message);
    }
});

// Створення таблиці вчителів
db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    photo_url TEXT,
    description TEXT
)`, (err) => {
    if (err) {
        console.error('Error creating teachers table:', err.message);
    }
});

// Створення таблиці рейтингів вчителів
db.run(`CREATE TABLE IF NOT EXISTS teacher_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers (id),
    FOREIGN KEY (student_id) REFERENCES students (id),
    UNIQUE(teacher_id, student_id)
)`, (err) => {
    if (err) {
        console.error('Error creating teacher_ratings table:', err.message);
    }
});

// Створення таблиці повідомлень чату
db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES students (id),
    FOREIGN KEY (receiver_id) REFERENCES students (id)
)`, (err) => {
    if (err) {
        console.error('Error creating chat_messages table:', err.message);
    }
});

// Створення таблиці відгуків про сайт
db.run(`CREATE TABLE IF NOT EXISTS site_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id)
)`, (err) => {
    if (err) {
        console.error('Error creating site_feedback table:', err.message);
    }
});

// Create an admin user if none exists
db.get("SELECT * FROM students WHERE is_admin = 1", [], (err, admin) => {
    if (err) {
        console.error("Error checking for admin:", err.message);
        return;
    }
    
    if (!admin) {
        // Create default admin user
        const adminUsername = "admin";
        const adminPassword = "admin123"; // You should change this in production
        
        bcrypt.hash(adminPassword, 10, (err, hash) => {
            if (err) {
                console.error("Error hashing admin password:", err.message);
                return;
            }
            
            db.run("INSERT INTO students (username, password_hash, full_name, class, is_admin) VALUES (?, ?, ?, ?, 1)", 
                [adminUsername, hash, "Адміністратор", "Адмін"], 
                function(err) {
                    if (err) {
                        console.error("Error creating admin user:", err.message);
                        return;
                    }
                    console.log("Admin user created with ID:", this.lastID);
                }
            );
        });
    }
});

// Add some sample teachers if none exist
db.get("SELECT COUNT(*) as count FROM teachers", [], (err, result) => {
    if (err) {
        console.error("Error checking for teachers:", err.message);
        return;
    }
    
    if (result.count === 0) {
        // Add sample teachers
        const sampleTeachers = [
            { name: "Іванова Марія Петрівна", subject: "Математика", description: "Викладає алгебру та геометрію" },
            { name: "Петренко Олександр Іванович", subject: "Фізика", description: "Викладає фізику та астрономію" },
            { name: "Сидоренко Наталія Василівна", subject: "Українська мова", description: "Викладає українську мову та літературу" },
            { name: "Коваленко Ігор Миколайович", subject: "Історія", description: "Викладає історію України та всесвітню історію" },
            { name: "Шевченко Ольга Андріївна", subject: "Англійська мова", description: "Викладає англійську мову" }
        ];
        
        const stmt = db.prepare("INSERT INTO teachers (full_name, subject, description) VALUES (?, ?, ?)");
        
        sampleTeachers.forEach(teacher => {
            stmt.run(teacher.name, teacher.subject, teacher.description, function(err) {
                if (err) {
                    console.error("Error adding sample teacher:", err.message);
                } else {
                    console.log(`Added teacher: ${teacher.name}`);
                }
            });
        });
        
        stmt.finalize();
    }
});

module.exports = db;