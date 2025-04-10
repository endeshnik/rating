const express = require('express');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// List all teachers
router.get('/', requireLogin, (req, res) => {
    db.all(`
        SELECT t.id, t.full_name, t.subject, t.photo_url, t.description,
               COALESCE(AVG(r.rating), 0) as avgRating,
               COUNT(r.id) as ratingCount
        FROM teachers t
        LEFT JOIN teacher_ratings r ON t.id = r.teacher_id
        GROUP BY t.id
        ORDER BY t.full_name ASC
    `, [], (err, teachers) => {
        if (err) {
            console.error('Error fetching teachers with ratings:', err.message);
            return res.render('teachers', { 
                teachers: [],
                user: req.session.user,
                error: 'Помилка при отриманні списку вчителів'
            });
        }
        
        res.render('teachers', { 
            teachers: teachers,
            user: req.session.user,
            error: null
        });
    });
});

// View teacher profile
router.get('/:teacherId', requireLogin, (req, res) => {
    const teacherId = req.params.teacherId;
    
    // Get teacher info
    db.get('SELECT * FROM teachers WHERE id = ?', [teacherId], (err, teacher) => {
        if (err || !teacher) {
            return res.redirect('/teachers');
        }
        
        // Get all ratings for this teacher
        db.all(`
            SELECT r.rating, r.comment, r.created_at, s.username, s.full_name
            FROM teacher_ratings r
            JOIN students s ON r.student_id = s.id
            WHERE r.teacher_id = ?
            ORDER BY r.created_at DESC
        `, [teacherId], (err, ratings) => {
            if (err) {
                console.error('Error fetching ratings:', err.message);
                ratings = [];
            }
            
            // Calculate average rating
            let avgRating = 0;
            if (ratings.length > 0) {
                const sum = ratings.reduce((total, r) => total + r.rating, 0);
                avgRating = (sum / ratings.length).toFixed(1);
            }
            
            // Check if current student has already rated this teacher
            db.get('SELECT * FROM teacher_ratings WHERE teacher_id = ? AND student_id = ?', 
                [teacherId, req.session.user.id], 
                (err, existingRating) => {
                    res.render('teacher-profile', { 
                        teacher: teacher,
                        ratings: ratings,
                        avgRating: avgRating,
                        hasRated: !!existingRating,
                        userRating: existingRating,
                        user: req.session.user
                    });
                }
            );
        });
    });
});

module.exports = router;