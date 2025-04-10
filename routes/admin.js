const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Admin dashboard
router.get('/', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    // Get counts for dashboard
    db.get('SELECT COUNT(*) as teacherCount FROM teachers', [], (err, teacherResult) => {
        const teacherCount = err ? 0 : teacherResult.teacherCount;
        
        db.get('SELECT COUNT(*) as studentCount FROM students WHERE is_admin = 0', [], (err, studentResult) => {
            const studentCount = err ? 0 : studentResult.studentCount;
            
            db.get('SELECT COUNT(*) as ratingCount FROM teacher_ratings', [], (err, ratingResult) => {
                const ratingCount = err ? 0 : ratingResult.ratingCount;
                
                // Get all users for the admin dashboard
                db.all('SELECT * FROM students ORDER BY username', [], (err, users) => {
                    if (err) {
                        console.error("Error fetching users:", err.message);
                        users = [];
                    }
                    
                    res.render('admin', { 
                        user: req.session.user,
                        stats: {
                            teachers: teacherCount,
                            students: studentCount,
                            ratings: ratingCount
                        },
                        users: users, // Pass the users to the template
                        error: null
                    });
                });
            });
        });
    });
});

// Manage teachers
router.get('/teachers', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    db.all(`
        SELECT t.*, 
            COALESCE(AVG(r.rating), 0) as avgRating,
            COUNT(r.id) as ratingCount
        FROM teachers t
        LEFT JOIN teacher_ratings r ON t.id = r.teacher_id
        GROUP BY t.id
        ORDER BY t.full_name
    `, [], (err, teachers) => {
        if (err) {
            console.error("Error fetching teachers:", err.message);
            teachers = [];
        }
        
        res.render('admin-teachers', { 
            user: req.session.user,
            teachers: teachers,
            error: null
        });
    });
});

// Маршрут для оновлення середньої оцінки вчителя
router.post('/teachers/:id/rating', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }

    const teacherId = req.params.id;
    const newRating = parseFloat(req.body.rating);

    if (isNaN(newRating) || newRating < 0 || newRating > 10) {
        return res.redirect('/admin/teachers?error=Некоректне значення оцінки');
    }

    // Видаляємо всі існуючі оцінки
    db.run('DELETE FROM teacher_ratings WHERE teacher_id = ?', [teacherId], (err) => {
        if (err) {
            console.error("Error deleting ratings:", err.message);
            return res.redirect('/admin/teachers?error=Помилка при оновленні оцінки');
        }

        // Додаємо нову оцінку від адміністратора
        db.run(
            'INSERT INTO teacher_ratings (teacher_id, student_id, rating, comment) VALUES (?, ?, ?, ?)',
            [teacherId, req.session.user.id, newRating, 'Оцінка встановлена адміністратором'],
            (err) => {
                if (err) {
                    console.error("Error updating rating:", err.message);
                    return res.redirect('/admin/teachers?error=Помилка при оновленні оцінки');
                }
                res.redirect('/admin/teachers');
            }
        );
    });

});

// Add teacher form
router.get('/teachers/add', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    res.render('admin-teacher-form', {
        user: req.session.user,
        teacher: null,
        error: null
    });
});

// Add teacher process
router.post('/teachers/add', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const { full_name, subject, description } = req.body;
    
    if (!full_name || !subject) {
        return res.render('admin-teacher-form', {
            user: req.session.user,
            teacher: req.body,
            error: 'Ім\'я та предмет є обов\'язковими полями'
        });
    }
    
    db.run(
        'INSERT INTO teachers (full_name, subject, description) VALUES (?, ?, ?)',
        [full_name, subject, description],
        function(err) {
            if (err) {
                console.error("Error adding teacher:", err.message);
                return res.render('admin-teacher-form', {
                    user: req.session.user,
                    teacher: req.body,
                    error: 'Помилка при додаванні вчителя'
                });
            }
            
            res.redirect('/admin/teachers');
        }
    );
});

// Edit teacher form
router.get('/teachers/edit/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const teacherId = req.params.id;
    
    db.get('SELECT * FROM teachers WHERE id = ?', [teacherId], (err, teacher) => {
        if (err || !teacher) {
            return res.redirect('/admin/teachers');
        }
        
        res.render('admin-teacher-form', {
            user: req.session.user,
            teacher: teacher,
            error: null
        });
    });
});

// Edit teacher process
router.post('/teachers/edit/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const teacherId = req.params.id;
    const { full_name, subject, description } = req.body;
    
    if (!full_name || !subject) {
        return res.render('admin-teacher-form', {
            user: req.session.user,
            teacher: { id: teacherId, ...req.body },
            error: 'Ім\'я та предмет є обов\'язковими полями'
        });
    }
    
    db.run(
        'UPDATE teachers SET full_name = ?, subject = ?, description = ? WHERE id = ?',
        [full_name, subject, description, teacherId],
        function(err) {
            if (err) {
                console.error("Error updating teacher:", err.message);
                return res.render('admin-teacher-form', {
                    user: req.session.user,
                    teacher: { id: teacherId, ...req.body },
                    error: 'Помилка при оновленні вчителя'
                });
            }
            
            res.redirect('/admin/teachers');
        }
    );
});

// Delete teacher
router.get('/teachers/delete/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const teacherId = req.params.id;
    
    db.run('DELETE FROM teachers WHERE id = ?', [teacherId], function(err) {
        if (err) {
            console.error("Error deleting teacher:", err.message);
        }
        
        // Also delete all ratings for this teacher
        db.run('DELETE FROM teacher_ratings WHERE teacher_id = ?', [teacherId], function(err) {
            if (err) {
                console.error("Error deleting teacher ratings:", err.message);
            }
            res.redirect('/admin/teachers');
        });
    });
});

// Manage students
router.get('/students', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    db.all('SELECT id, username, full_name, class, is_admin FROM students', [], (err, students) => {
        if (err) {
            console.error("Error fetching students:", err.message);
            students = [];
        }
        
        res.render('admin-students', { 
            user: req.session.user,
            students: students,
            error: null
        });
    });
});

// Delete student
router.get('/students/delete/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const studentId = req.params.id;
    
    // Don't allow deleting yourself
    if (studentId == req.session.user.id) {
        return res.redirect('/admin/students');
    }
    
    db.run('DELETE FROM students WHERE id = ?', [studentId], function(err) {
        if (err) {
            console.error("Error deleting student:", err.message);
        }
        
        // Also delete all ratings by this student
        db.run('DELETE FROM teacher_ratings WHERE student_id = ?', [studentId], function(err) {
            if (err) {
                console.error("Error deleting student ratings:", err.message);
            }
            res.redirect('/admin/students');
        });
    });
});

// Toggle admin status
router.get('/students/toggle-admin/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const studentId = req.params.id;
    
    // Get current admin status
    db.get('SELECT is_admin FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err || !student) {
            return res.redirect('/admin/students');
        }
        
        const newAdminStatus = student.is_admin === 1 ? 0 : 1;
        
        db.run('UPDATE students SET is_admin = ? WHERE id = ?', [newAdminStatus, studentId], function(err) {
            if (err) {
                console.error("Error updating admin status:", err.message);
            }
            res.redirect('/admin/students');
        });
    });
});

// Toggle admin status for users on admin page
router.get('/toggle-admin/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const studentId = req.params.id;
    
    // Get current admin status
    db.get('SELECT is_admin FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err || !student) {
            return res.redirect('/admin');
        }
        
        const newAdminStatus = student.is_admin === 1 ? 0 : 1;
        
        db.run('UPDATE students SET is_admin = ? WHERE id = ?', [newAdminStatus, studentId], function(err) {
            if (err) {
                console.error("Error updating admin status:", err.message);
            }
            res.redirect('/admin');
        });
    });
});

// Delete user from admin page
router.get('/delete-user/:id', (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    
    const studentId = req.params.id;
    
    // Don't allow deleting yourself
    if (studentId == req.session.user.id) {
        return res.redirect('/admin');
    }
    
    db.run('DELETE FROM students WHERE id = ?', [studentId], function(err) {
        if (err) {
            console.error("Error deleting student:", err.message);
        }
        
        // Also delete all ratings by this student
        db.run('DELETE FROM teacher_ratings WHERE student_id = ?', [studentId], function(err) {
            if (err) {
                console.error("Error deleting student ratings:", err.message);
            }
            res.redirect('/admin');
        });
    });
});

module.exports = router;