const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Import routes
const userRoutes = require('./routes/users');
const teacherRoutes = require('./routes/teachers');
const ratingRoutes = require('./routes/ratings');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

const app = express();
const port = 3003;

// Налаштування Express
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'school_rating_secret',
    resave: false,
    saveUninitialized: true
}));

// Налаштування шаблонізатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Root route
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Use routes
app.use('/', userRoutes);
app.use('/teachers', teacherRoutes);
app.use('/', ratingRoutes);
app.use('/admin', adminRoutes);
app.use('/chat', chatRoutes);

// Запуск сервера
const server = app.listen(port, () => {
    console.log(`Шкільний рейтинг вчителів запущено на порту ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Порт ${port} зайнятий, спроба використати порт ${port + 1}`);
        server.close();
        app.listen(port + 1, () => {
            console.log(`Шкільний рейтинг вчителів запущено на порту ${port + 1}`);
        });
    } else {
        console.error('Помилка запуску сервера:', err);
    }
});