const express = require('express');
const router = express.Router();

const usersRouter = require('./usersRouter');
const skinRouter = require('./skinRouter');
const cosmeticsRouter = require('./cosmeticsRouter');
const routineRouter = require('./routineRouter');
// const challengeRouter = require('./challengeRouter');
// const reportRouter = require('./reportRouter');
const chatbotRouter = require('./chatbotRouter');

router.use('/users', usersRouter);
router.use('/skin', skinRouter);
router.use('/cosmetics', cosmeticsRouter);
router.use('/routine', routineRouter);
// router.use('/challenge', challengeRouter);
// router.use('/reports', reportRouter);
router.use('/chatbot', chatbotRouter);

module.exports = router;