const express = require('express');
const router = express.Router();

const usersRouter = require('./usersRouter');
const skinRouter = require('./skinRouter');
// const routineRouter = require('./routineRouter');
// const cosmeticsRouter = require('./cosmeticsRouter');
// const challengeRouter = require('./challengeRouter');
// const reportRouter = require('./reportRouter');

router.use('/users', usersRouter);
router.use('/skin', skinRouter);
// router.use('/routine', routineRouter);
// router.use('/cosmetics', cosmeticsRouter);
// router.use('/challenge', challengeRouter);
// router.use('/report', reportRouter);

module.exports = router;