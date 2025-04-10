const express = require('express');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Сторінка для відправки відгуку про сайт
router.get('/', requireLogin, (req, res) => {
    // Перевіряємо, чи користувач вже залишав відгук
    db.get('SELECT * FROM site_feedback WHERE student_id = ?', [req.session.user.id], (err, feedback) => {
        if (err) {
            console.error('Error checking for existing feedback:', err.message);
        }
        
        res.render('feedback', { 
            user: req.session.user,
            existingFeedback: feedback,
            error: null
        });
    });
});

// Обробка відправки відгуку
router.post('/submit', requireLogin, (req, res) => {
    const studentId = req.session.user.id;
    const { rating, comment } = req.body;
    
    // Валідація рейтингу
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.render('feedback', { 
            user: req.session.user,
            existingFeedback: null,
            error: 'Будь ласка, вкажіть рейтинг від 1 до 5'
        });
    }
    
    // Перевіряємо, чи користувач вже залишав відгук
    db.get('SELECT * FROM site_feedback WHERE student_id = ?', [studentId], (err, existingFeedback) => {
        if (existingFeedback) {
            // Оновлюємо існуючий відгук
            db.run(
                'UPDATE site_feedback SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE student_id = ?',
                [ratingValue, comment, studentId],
                function(err) {
                    if (err) {
                        console.error('Error updating feedback:', err.message);
                        return res.render('feedback', { 
                            user: req.session.user,
                            existingFeedback: existingFeedback,
                            error: 'Помилка при оновленні відгуку'
                        });
                    }
                    res.render('feedback-success', { 
                        user: req.session.user,
                        rating: ratingValue,
                        comment: comment,
                        isUpdate: true
                    });
                }
            );
        } else {
            // Створюємо новий відгук
            db.run(
                'INSERT INTO site_feedback (student_id, rating, comment) VALUES (?, ?, ?)',
                [studentId, ratingValue, comment],
                function(err) {
                    if (err) {
                        console.error('Error saving feedback:', err.message);
                        return res.render('feedback', { 
                            user: req.session.user,
                            existingFeedback: null,
                            error: 'Помилка при збереженні відгуку'
                        });
                    }
                    res.render('feedback-success', { 
                        user: req.session.user,
                        rating: ratingValue,
                        comment: comment,
                        isUpdate: false
                    });
                }
            );
        }
    });
});

// API для отримання статистики відгуків (для адміністратора)
router.get('/api/stats', requireLogin, (req, res) => {
    if (!req.session.user.isAdmin) {
        return res.json({ success: false, error: 'Доступ заборонено' });
    }
    
    db.get('SELECT AVG(rating) as avgRating, COUNT(*) as count FROM site_feedback', [], (err, result) => {
        if (err) {
            console.error('Error fetching feedback stats:', err.message);
            return res.json({ success: false, error: err.message });
        }
        
        res.json({ 
            success: true, 
            stats: {
                avgRating: result.avgRating ? parseFloat(result.avgRating).toFixed(1) : '0.0',
                count: result.count
            }
        });
    });
});

// Сторінка для адміністратора з усіма відгуками
router.get('/admin', requireLogin, (req, res) => {
    if (!req.session.user.isAdmin) {
        return res.redirect('/dashboard');
    }
    
    db.all(`
        SELECT f.*, s.username, s.full_name
        FROM site_feedback f
        JOIN students s ON f.student_id = s.id
        ORDER BY f.created_at DESC
    `, [], (err, feedbacks) => {
        if (err) {
            console.error('Error fetching feedbacks:', err.message);
            feedbacks = [];
        }
        
        // Розрахунок середнього рейтингу
        db.get('SELECT AVG(rating) as avgRating FROM site_feedback', [], (err, result) => {
            const avgRating = err || !result.avgRating ? '0.0' : parseFloat(result.avgRating).toFixed(1);
            
            res.render('admin-feedback', { 
                user: req.session.user,
                feedbacks: feedbacks,
                avgRating: avgRating,
                error: null
            });
        });
    });
});

module.exports = router;