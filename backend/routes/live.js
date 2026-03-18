const express = require('express')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/liveController')

const router = express.Router()

router.get('/sessions', ctrl.getSessions)
router.post('/start', authenticate, authorize('seller'), ctrl.startSession)
router.post('/end/:sessionId', authenticate, authorize('seller'), ctrl.endSession)
router.put('/:sessionId/viewers', ctrl.updateViewers)

module.exports = router
