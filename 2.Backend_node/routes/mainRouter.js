const express = require('express');
const router = express.Router();

const usersRouter = require('./usersRouter');
// const skinRouter = require('./skinRouter');
// const routineRouter = require('./routineRouter');
// const cosmeticsRouter = require('./cosmeticsRouter');
// const challengeRouter = require('./challengeRouter');
// const reportRouter = require('./reportRouter');

router.use('/usersRouter', usersRouter);
// router.use('/skinRouter', skinRouter);
// router.use('/routineRouter', routineRouter);
// router.use('/cosmeticsRouter', cosmeticsRouter);
// router.use('/challengeRouter', challengeRouter);
// router.use('/reportRouter', reportRouter);

module.exports = router;