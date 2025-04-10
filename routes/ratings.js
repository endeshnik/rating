const express = require('express');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Rate teacher page
router.get('/rate', requireLogin, (req, res) => {
    // Fetch only teachers for the dropdown
    db.all('SELECT id, full_name, subject FROM teachers ORDER BY full_name', [], (err, teachers) => {
        if (err) {
            console.error('Error fetching teachers:', err.message);
            return res.render('rate-teacher', { 
                teachers: [], 
                selectedTeacher: null,
                error: 'Помилка при отриманні списку вчителів',
                user: req.session.user
            });
        }
        
        res.render('rate-teacher', { 
            teachers: teachers, 
            selectedTeacher: null,
            error: null,
            user: req.session.user
        });
    });
});

// Rate specific teacher
router.get('/rate/:teacherId', requireLogin, (req, res) => {
    const teacherId = req.params.teacherId;
    
    db.get('SELECT id, full_name, subject FROM teachers WHERE id = ?', [teacherId], (err, teacher) => {
        if (err || !teacher) {
            return res.redirect('/teachers');
        }
        
        // Check if student has already rated this teacher
        db.get('SELECT * FROM teacher_ratings WHERE teacher_id = ? AND student_id = ?', 
            [teacherId, req.session.user.id], 
            (err, rating) => {
                let error = null;
                
                // Removed error message to allow rating updates
                
                db.all('SELECT id, full_name, subject FROM teachers', [], (err, teachers) => {
                    if (err) {
                        teachers = [];
                    }
                    
                    res.render('rate-teacher', { 
                        teachers: teachers, 
                        selectedTeacher: teacher,
                        existingRating: rating,
                        error: error,
                        user: req.session.user
                    });
                });
            }
        );
    });
});

// Submit comment for teacher
router.post('/submit-comment/:teacherId', requireLogin, (req, res) => {
    const teacherId = req.params.teacherId;
    const studentId = req.session.user.id;
    const { comment } = req.body;
    
    if (!comment || comment.trim().length === 0) {
        return res.redirect('/teachers/' + teacherId);
    }

    // Add comment without rating
    db.run(
        'INSERT INTO teacher_ratings (teacher_id, student_id, comment) VALUES (?, ?, ?)',
        [teacherId, studentId, comment],
        function(err) {
            if (err) {
                console.error('Error adding comment:', err.message);
            }
            res.redirect('/teachers/' + teacherId);
        }
    );
});

// Submit rating for teacher
router.post('/submit-rating', requireLogin, (req, res) => {
    const teacherId = req.body.teacherId;
    const studentId = req.session.user.id;
    const { rating, comment } = req.body;
    
    // Validate rating
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 10) {
        return res.redirect('/rate');
    }
    
    // Debug log
    console.log('Updating rating for teacher:', teacherId, 'by student:', studentId, 'with rating:', ratingValue);
    
    // Check if student has already rated this teacher
    db.get('SELECT * FROM teacher_ratings WHERE teacher_id = ? AND student_id = ?', 
        [teacherId, studentId], 
        (err, existingRating) => {
            if (existingRating) {
                // Update existing rating
                db.run(
                    'UPDATE teacher_ratings SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE teacher_id = ? AND student_id = ?',
                    [ratingValue, comment, teacherId, studentId],
                    function(err) {
                        if (err) {
                            console.error('Error updating rating:', err.message);
                        }
                        res.redirect('/teachers/' + teacherId);
                    }
                );
            } else {
                // Create new rating
                db.run(
                    'INSERT INTO teacher_ratings (teacher_id, student_id, rating, comment) VALUES (?, ?, ?, ?)',
                    [teacherId, studentId, ratingValue, comment],
                    function(err) {
                        if (err) {
                            console.error('Error saving rating:', err.message);
                        }
                        res.redirect('/teachers/' + teacherId);
                    }
                );
            }
        }
    );
});

// Select teacher for rating
router.post('/select-teacher', requireLogin, (req, res) => {
    const teacherId = req.body.teacherId;
    
    if (!teacherId) {
        return res.redirect('/rate');
    }
    
    res.redirect('/rate/' + teacherId);
});

module.exports = router;