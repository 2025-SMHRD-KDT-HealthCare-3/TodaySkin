const express = require('express');
const router = express.Router();

// 라우터
const usersRouter = require('./usersRouter');
const skinRouter = require('./skinRouter');
const cosmeticsRouter = require('./cosmeticsRouter');
const routineRouter = require('./routineRouter');
const challengeRouter = require('./challengeRouter');
const reportRouter = require('./reportRouter');
const chatbotRouter = require('./chatbotRouter');

// 미들웨어
const { errorHandler } = require('../middleware/errorHandler');


// 라우터 등록 (순서 중요!)

router.use('/users', usersRouter);
router.use('/skin', skinRouter);
router.use('/cosmetics', cosmeticsRouter);
router.use('/routine', routineRouter);
router.use('/challenge', challengeRouter);
router.use('/reports', reportRouter);
router.use('/chatbot', chatbotRouter);


// 에러 핸들러 
router.use(errorHandler);

module.exports = router;