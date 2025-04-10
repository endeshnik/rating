const express = require('express');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Сторінка чату
router.get('/', requireLogin, (req, res) => {
    // Отримати список всіх користувачів для вибору співрозмовника
    db.all('SELECT id, username, full_name FROM students WHERE id != ? ORDER BY full_name', [req.session.user.id], (err, users) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return res.render('chat', { 
                users: [], 
                selectedUser: null,
                messages: [],
                user: req.session.user,
                error: 'Помилка при отриманні списку користувачів'
            });
        }
        
        res.render('chat', { 
            users: users, 
            selectedUser: null,
            messages: [],
            user: req.session.user,
            error: null
        });
    });
});

// Сторінка чату з конкретним користувачем
router.get('/:userId', requireLogin, (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.session.user.id;
    
    // Отримати інформацію про вибраного користувача
    db.get('SELECT id, username, full_name FROM students WHERE id = ?', [userId], (err, selectedUser) => {
        if (err || !selectedUser) {
            return res.redirect('/chat');
        }
        
        // Отримати всі повідомлення між поточним користувачем і вибраним користувачем
        db.all(`
            SELECT * FROM chat_messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
        `, [currentUserId, userId, userId, currentUserId], (err, messages) => {
            if (err) {
                console.error('Error fetching messages:', err.message);
                messages = [];
            }
            
            // Позначити всі повідомлення від вибраного користувача як прочитані
            db.run('UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', 
                [userId, currentUserId], (err) => {
                    if (err) {
                        console.error('Error updating message status:', err.message);
                    }
                }
            );
            
            // Отримати список всіх користувачів для вибору співрозмовника
            db.all('SELECT id, username, full_name FROM students WHERE id != ? ORDER BY full_name', [currentUserId], (err, users) => {
                if (err) {
                    console.error('Error fetching users:', err.message);
                    users = [];
                }
                
                res.render('chat', { 
                    users: users, 
                    selectedUser: selectedUser,
                    messages: messages,
                    user: req.session.user,
                    error: null
                });
            });
        });
    });
});

// Відправити повідомлення
router.post('/send', requireLogin, (req, res) => {
    const senderId = req.session.user.id;
    const { receiverId, message } = req.body;
    
    if (!message || message.trim().length === 0) {
        return res.redirect('/chat/' + receiverId);
    }
    
    // Зберегти повідомлення в базі даних
    db.run(
        'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, message],
        function(err) {
            if (err) {
                console.error('Error sending message:', err.message);
            }
            res.redirect('/chat/' + receiverId);
        }
    );
});

// API для отримання нових повідомлень
router.get('/api/messages/:userId', requireLogin, (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.session.user.id;
    
    // Отримати всі повідомлення між поточним користувачем і вибраним користувачем
    db.all(`
        SELECT * FROM chat_messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    `, [currentUserId, userId, userId, currentUserId], (err, messages) => {
        if (err) {
            console.error('Error fetching messages:', err.message);
            return res.json({ success: false, error: err.message });
        }
        
        // Позначити всі повідомлення від вибраного користувача як прочитані
        db.run('UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', 
            [userId, currentUserId], (err) => {
                if (err) {
                    console.error('Error updating message status:', err.message);
                }
                
                res.json({ success: true, messages: messages });
            }
        );
    });
});

// API для отримання кількості непрочитаних повідомлень
router.get('/api/unread', requireLogin, (req, res) => {
    const currentUserId = req.session.user.id;
    
    // Отримати кількість непрочитаних повідомлень для поточного користувача
    db.get(`
        SELECT COUNT(*) as count FROM chat_messages 
        WHERE receiver_id = ? AND is_read = 0
    `, [currentUserId], (err, result) => {
        if (err) {
            console.error('Error fetching unread count:', err.message);
            return res.json({ success: false, error: err.message });
        }
        
        res.json({ success: true, count: result.count });
    });
});

module.exports = router;