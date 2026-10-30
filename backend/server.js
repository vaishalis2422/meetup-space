
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, DELETE, OPTIONS'
    );
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306)
});
// Keep your actual local MySQL password in the password field above.

const rooms = [
    'Conference Room A',
    'Conference Room B',
    'Meeting Room C',
    'Meeting Room D',
    'Training Room E',
    'Discussion Room F',
    'Interview Room G',
    'Board Room H',
    'Creative Room I',
    'Project Room J'
];

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.log('MySQL connection failed:', err.message);
        return;
    }

    console.log('MySQL Connected!');
});

// Home route
app.get('/', (req, res) => {
    res.send('MeetSpace Backend is Running!');
});

// CREATE BOOKING
app.post('/bookings', (req, res) => {
    const { name, room, date, startTime, endTime } = req.body;

    if (!rooms.includes(room)) {
        return res.status(400).send('Invalid meeting room!');
    }

    if (
        !name ||
        !date ||
        !startTime ||
        !endTime ||
        endTime <= startTime
    ) {
        return res.status(400).send(
            'Please enter valid booking details!'
        );
    }

    const checkSql = `
        SELECT id FROM bookings
        WHERE room = ?
        AND booking_date = ?
        AND start_time < ?
        AND end_time > ?
    `;

    db.query(
        checkSql,
        [room, date, endTime, startTime],
        (err, results) => {
            if (err) {
                console.error('Booking check error:', err.message);
                return res.status(500).send('Booking check failed!');
            }

            if (results.length > 0) {
                return res.status(409).send(
                    'This room is already booked for that time!'
                );
            }

            const sql = `
                INSERT INTO bookings
                (name, room, booking_date, start_time, end_time)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [name, room, date, startTime, endTime],
                (err) => {
                    if (err) {
                        console.error('Booking save error:', err.message);
                        return res.status(500).send(
                            'Booking could not be saved!'
                        );
                    }

                    return res.send('Booking saved successfully!');
                }
            );
        }
    );
});

// VIEW ALL BOOKINGS
app.get('/bookings', (req, res) => {
    db.query(
        'SELECT * FROM bookings ORDER BY booking_date, start_time',
        (err, results) => {
            if (err) {
                console.error('Fetch bookings error:', err.message);
                return res.status(500).send('Error fetching bookings');
            }

            res.json(results);
        }
    );
});

// DASHBOARD AND ROOM AVAILABILITY
app.get('/dashboard', (req, res) => {
    const countSql = `
        SELECT
            COUNT(*) AS totalBookings,
            COALESCE(
                SUM(booking_date = CURDATE()),
                0
            ) AS todayBookings
        FROM bookings
    `;

    db.query(countSql, (err, results) => {
        if (err) {
            console.error('Dashboard error:', err.message);
            return res.status(500).json({
                error: 'Dashboard error'
            });
        }

        const dashboard = {
            totalBookings: Number(results[0].totalBookings),
            todayBookings: Number(results[0].todayBookings),
            totalRooms: rooms.length,
            availableRooms: null
        };

        const { date, startTime, endTime } = req.query;

        if (
            !date ||
            !startTime ||
            !endTime ||
            endTime <= startTime
        ) {
            return res.json(dashboard);
        }

        const availabilitySql = `
            SELECT COUNT(DISTINCT room) AS bookedRooms
            FROM bookings
            WHERE booking_date = ?
            AND start_time < ?
            AND end_time > ?
            AND room IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            availabilitySql,
            [date, endTime, startTime, ...rooms],
            (err, result) => {
                if (err) {
                    console.error('Availability error:', err.message);
                    return res.status(500).json({
                        error: 'Availability check failed'
                    });
                }

                dashboard.availableRooms = Math.max(
                    0,
                    rooms.length - Number(result[0].bookedRooms)
                );

                res.json(dashboard);
            }
        );
    });
});

// CANCEL BOOKING
app.delete('/bookings/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).send('Invalid booking ID!');
    }

    db.query(
        'DELETE FROM bookings WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                console.error('Cancel error:', err.message);
                return res.status(500).send('Cancel failed!');
            }

            if (result.affectedRows === 0) {
                return res.status(404).send('Booking not found!');
            }

            res.send('Booking cancelled successfully!');
        }
    );
});

// START SERVER — keep this at the bottom
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
