import express from 'express';
import {
  stripe,
  createStripeCustomer,
  createDeferredSubscription,
  cancelTrialSubscription,
  cancelActiveSubscription,
  getLatestCharge,
  issueRefund,
  getSubscription,
} from '../services/stripe.js';

const router = express.Router();

// Get config endpoint - returns public key
router.get('/config', async (req, res) => {
  try {
    const publishableKey = process.env.STRIPE_PUBLIC_KEY;
    
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe public key not configured' });
    }

    res.json({ publishableKey });
  } catch (error: any) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: error.message || 'Failed to get config' });
  }
});

// Start free trial - creates deferred subscription with 7-day trial
router.post('/start-trial', async (req, res) => {
  try {
    const { paymentMethodId, email } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'paymentMethodId is required' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Create or get customer
    let customer;
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customer = customers.data.length > 0 ? customers.data[0] : await createStripeCustomer(email);
    } catch (error) {
      customer = await createStripeCustomer(email);
    }

    // Create deferred subscription with trial
    const subscription = await createDeferredSubscription(customer.id, paymentMethodId);

    res.json({
      customerId: customer.id,
      subscriptionId: subscription.id,
      status: subscription.status,
      trialEnd: subscription.trial_end,
    });
  } catch (error: any) {
    console.error('Error starting trial:', error);
    res.status(500).json({
      error: error.message || 'Failed to start trial',
    });
  }
});

// Cancel free trial - cancels before conversion
router.post('/cancel-trial', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }

    const subscription = await cancelTrialSubscription(subscriptionId);

    res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      message: 'Trial cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error canceling trial:', error);
    
    if (error.message?.includes('not in trial')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({
      error: error.message || 'Failed to cancel trial',
    });
  }
});

// Cancel subscription - cancels at period end
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }

    const subscription = await cancelActiveSubscription(subscriptionId);

    res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end,
      message: 'Subscription will be cancelled at period end',
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    
    if (error.message?.includes('already canceled')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({
      error: error.message || 'Failed to cancel subscription',
    });
  }
});

// Refund - issues refund for latest charge
router.post('/refund', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Get latest charge
    const charge = await getLatestCharge(customerId);

    // Issue refund
    const refund = await issueRefund(charge.id);

    res.json({
      refundId: refund.id,
      amountRefunded: refund.amount,
      status: refund.status,
      message: 'Refund issued successfully',
    });
  } catch (error: any) {
    console.error('Error issuing refund:', error);
    
    if (error.message?.includes('No charges found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({
      error: error.message || 'Failed to issue refund',
    });
  }
});

export default router;
