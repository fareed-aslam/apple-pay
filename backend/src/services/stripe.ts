import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

if (!process.env.STRIPE_PUBLIC_KEY) {
  throw new Error('STRIPE_PUBLIC_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Get or create a price for $39.99/month subscription
async function getOrCreatePrice(): Promise<string> {
  try {
    // Try to find existing price
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    // Look for a $39.99/month recurring price
    const existingPrice = prices.data.find(
      (p) => p.unit_amount === 3999 && p.recurring?.interval === 'month'
    );

    if (existingPrice) {
      return existingPrice.id;
    }

    // Create product if it doesn't exist
    const products = await stripe.products.list({ limit: 100 });
    let product = products.data.find((p) => p.name === 'Monthly Subscription');

    if (!product) {
      product = await stripe.products.create({
        name: 'Monthly Subscription',
        description: 'Monthly subscription with 7-day free trial',
      });
    }

    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 3999, // $39.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    return price.id;
  } catch (error) {
    console.error('Error getting/creating price:', error);
    throw error;
  }
}

export const createStripeCustomer = async (email: string) => {
  return await stripe.customers.create({
    email,
  });
};

// Create deferred subscription with 7-day trial
export const createDeferredSubscription = async (
  customerId: string,
  paymentMethodId: string
) => {
  const priceId = await getOrCreatePrice();

  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Set as default payment method
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // Create subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    trial_period_days: 7,
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
};

export const cancelTrialSubscription = async (subscriptionId: string) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (subscription.status !== 'trialing' && subscription.status !== 'incomplete') {
    throw new Error('Subscription is not in trial period or is already canceled');
  }

  return await stripe.subscriptions.cancel(subscriptionId);
};

export const cancelActiveSubscription = async (subscriptionId: string) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (subscription.status === 'canceled') {
    throw new Error('Subscription is already canceled');
  }

  // Cancel at period end
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
};

export const getLatestCharge = async (customerId: string) => {
  const charges = await stripe.charges.list({
    customer: customerId,
    limit: 1,
  });

  if (charges.data.length === 0) {
    throw new Error('No charges found for this customer');
  }

  return charges.data[0];
};

export const issueRefund = async (chargeId: string) => {
  return await stripe.refunds.create({
    charge: chargeId,
  });
};

export const getSubscription = async (subscriptionId: string) => {
  return await stripe.subscriptions.retrieve(subscriptionId);
};

export const cancelSubscription = async (subscriptionId: string) => {
  return await stripe.subscriptions.cancel(subscriptionId);
};
