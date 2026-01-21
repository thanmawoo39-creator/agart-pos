import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/delivery/orders
 * Get all delivery orders for a business unit
 * Protected: Cashier/Manager/Owner only
 */
router.get('/orders', isAuthenticated, requireRole('cashier', 'manager', 'owner'), async (req, res) => {
  try {
    const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    if (!businessUnitId) {
      return res.status(400).json({ error: 'businessUnitId is required' });
    }

    // Validate business unit access
    const userRole = (req.user as any)?.role;
    const userBusinessUnitId = req.user?.businessUnitId;

    if (userRole !== 'owner' && userBusinessUnitId !== businessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const deliveryOrders = await storage.getDeliveryOrders(businessUnitId, date);

    res.json(deliveryOrders);
  } catch (error) {
    console.error('Error fetching delivery orders:', error);
    res.status(500).json({ error: 'Failed to fetch delivery orders' });
  }
});

/**
 * GET /api/delivery/summary
 * Get kitchen prep summary (total quantities per product)
 * Protected: Cashier/Manager/Owner only
 */
router.get('/summary', isAuthenticated, requireRole('cashier', 'manager', 'owner'), async (req, res) => {
  try {
    const businessUnitId = typeof req.query.businessUnitId === 'string' ? req.query.businessUnitId : null;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    if (!businessUnitId) {
      return res.status(400).json({ error: 'businessUnitId is required' });
    }

    // Validate business unit access
    const userRole = (req.user as any)?.role;
    const userBusinessUnitId = req.user?.businessUnitId;

    if (userRole !== 'owner' && userBusinessUnitId !== businessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const summary = await storage.getDeliverySummary(businessUnitId, date);
    const orders = await storage.getDeliveryOrders(businessUnitId, date);

    res.json({
      summary,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
    });
  } catch (error) {
    console.error('Error fetching delivery summary:', error);
    res.status(500).json({ error: 'Failed to fetch delivery summary' });
  }
});

/**
 * GET /api/delivery/order/:id
 * Get a specific delivery order
 * Protected: Cashier/Manager/Owner only
 */
router.get('/order/:id', isAuthenticated, requireRole('cashier', 'manager', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await storage.getSale(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.orderType !== 'delivery') {
      return res.status(400).json({ error: 'Not a delivery order' });
    }

    // Validate business unit access
    const userRole = (req.user as any)?.role;
    const userBusinessUnitId = req.user?.businessUnitId;

    if (userRole !== 'owner' && userBusinessUnitId !== order.businessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching delivery order:', error);
    res.status(500).json({ error: 'Failed to fetch delivery order' });
  }
});

/**
 * POST /api/delivery/orders/:id/status
 * Update delivery order status
 * Protected: Cashier/Manager/Owner only
 */
router.post('/orders/:id/status', isAuthenticated, requireRole('cashier', 'manager', 'owner', 'kitchen'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Kitchen workflow statuses: preparing, ready_for_pickup
    // Delivery workflow statuses: pending, completed, delivered, cancelled
    if (!['pending', 'preparing', 'ready_for_pickup', 'completed', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify ownership
    const order = await storage.getSale(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validate business unit access
    const userRole = (req.user as any)?.role;
    const userBusinessUnitId = req.user?.businessUnitId;

    if (userRole !== 'owner' && userBusinessUnitId !== order.businessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    const updatedOrder = await storage.updateSaleStatus(id, status);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * POST /api/delivery/orders/:id/verify-payment
 * Manually verify payment after checking against SMS logs
 * Protected: Cashier/Manager/Owner only
 */
router.post('/orders/:id/verify-payment', isAuthenticated, requireRole('cashier', 'manager', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify order exists
    const order = await storage.getSale(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validate business unit access
    const userRole = (req.user as any)?.role;
    const userBusinessUnitId = req.user?.businessUnitId;

    if (userRole !== 'owner' && userBusinessUnitId !== order.businessUnitId) {
      return res.status(403).json({ error: 'Business unit access denied' });
    }

    // Update payment status to 'paid'
    const updatedOrder = await storage.updatePaymentStatus(id, 'paid');

    console.log(`[PAYMENT-VERIFY] Order ${id} marked as PAID by ${req.user?.name || 'Cashier'}`);

    res.json({
      success: true,
      orderId: id,
      paymentStatus: 'paid',
      verifiedBy: req.user?.name || 'Cashier',
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;
