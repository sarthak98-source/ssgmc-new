const express = require('express')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/userController')

const router = express.Router()

router.get('/stats/admin', authenticate, authorize('admin'), ctrl.getAdminStats)
router.get('/', authenticate, authorize('admin'), ctrl.getUsers)
router.get('/:id', authenticate, ctrl.getUserById)
router.put('/:id/status', authenticate, authorize('admin'), ctrl.updateUserStatus)
router.delete('/:id', authenticate, authorize('admin'), ctrl.deleteUser)

module.exports = router
