const express = require('express')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/orderController')

const router = express.Router()

router.post('/', authenticate, authorize('buyer'), ctrl.createOrder)
router.get('/', authenticate, ctrl.getOrders)
router.get('/:id', authenticate, ctrl.getOrderById)
router.put('/:id/status', authenticate, authorize('seller', 'admin'), ctrl.updateOrderStatus)

module.exports = router
