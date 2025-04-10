const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Login process
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Find student
    db.get('SELECT * FROM students WHERE username = ?', [username], (err, student) => {
        if (err) {
            return res.render('login', { error: 'Помилка бази даних' });
        }
        if (!student) {
            return res.render('login', { error: 'Невірне ім\'я користувача або пароль' });
        }

        // Check password
        bcrypt.compare(password, student.password_hash, (err, result) => {
            if (err) {
                return res.render('login', { error: 'Помилка перевірки пароля' });
            }
            if (!result) {
                return res.render('login', { error: 'Невірне ім\'я користувача або пароль' });
            }

            // Create session
            req.session.user = {
                id: student.id,
                username: student.username,
                fullName: student.full_name,
                class: student.class,
                isAdmin: student.is_admin === 1
            };
            
            if (student.is_admin === 1) {
                res.redirect('/admin');
            } else {
                res.redirect('/dashboard');
            }
        });
    });
});

// Register page
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Register process
router.post('/register', (req, res) => {
    const { username, password, confirm_password, full_name, class_name } = req.body;
    
    // Check if passwords match
    if (password !== confirm_password) {
        return res.render('register', { error: 'Паролі не співпадають' });
    }

    // Check if username already exists
    db.get('SELECT * FROM students WHERE username = ?', [username], (err, row) => {
        if (err) {
            return res.render('register', { error: 'Помилка бази даних' });
        }
        if (row) {
            return res.render('register', { error: 'Користувач вже існує' });
        }

        // Hash password
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.render('register', { error: 'Помилка хешування пароля' });
            }

            // Save new student
            db.run('INSERT INTO students (username, password_hash, full_name, class) VALUES (?, ?, ?, ?)', 
                [username, hash, full_name, class_name], 
                function(err) {
                    if (err) {
                        return res.render('register', { error: 'Помилка при створенні користувача' });
                    }
                    res.redirect('/login');
                }
            );
        });
    });
});

// Dashboard
router.get('/dashboard', requireLogin, (req, res) => {
    // Get recently rated teachers
    db.all(`
        SELECT t.id, t.full_name, t.subject, r.rating, r.created_at
        FROM teacher_ratings r
        JOIN teachers t ON r.teacher_id = t.id
        WHERE r.student_id = ?
        ORDER BY r.created_at DESC
        LIMIT 5
    `, [req.session.user.id], (err, ratings) => {
        if (err) {
            console.error('Error fetching ratings:', err.message);
            ratings = [];
        }
        
        // Get top rated teachers
        db.all(`
            SELECT t.id, t.full_name, t.subject, AVG(r.rating) as avgRating, COUNT(r.id) as ratingCount
            FROM teachers t
            LEFT JOIN teacher_ratings r ON t.id = r.teacher_id
            GROUP BY t.id
            HAVING ratingCount > 0
            ORDER BY avgRating DESC
            LIMIT 5
        `, [], (err, topTeachers) => {
            if (err) {
                console.error('Error fetching top teachers:', err.message);
                topTeachers = [];
            }
            
            res.render('dashboard', { 
                user: req.session.user,
                ratings: ratings,
                topTeachers: topTeachers,
                currentPage: 'dashboard'
            });
        });
    });
});

// Student profile
router.get('/profile', requireLogin, (req, res) => {
    // Get all ratings by this student
    db.all(`
        SELECT r.rating, r.comment, r.created_at, t.full_name, t.subject
        FROM teacher_ratings r
        JOIN teachers t ON r.teacher_id = t.id
        WHERE r.student_id = ?
        ORDER BY r.created_at DESC
    `, [req.session.user.id], (err, ratings) => {
        if (err) {
            console.error('Error fetching ratings:', err.message);
            ratings = [];
        }
        
        res.render('profile', { 
            user: req.session.user,
            ratings: ratings
        });
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;