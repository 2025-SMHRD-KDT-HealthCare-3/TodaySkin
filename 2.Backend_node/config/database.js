const mysql = require('mysql2/promise'); // 처음부터 promise 버전으로 불러오기
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,    // 연결이 다 차면 대기함
    connectionLimit: 10,         // 최대 10개까지 통로를 유지함
    queueLimit: 0
});

module.exports = pool;