import Stripe from 'stripe'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.mjs'
import { Subscription } from '../../models/Subscription.mjs'
import { User } from '../../models/User.mjs'
import FeaturesUpdater from './FeaturesUpdater.mjs'

// Initialize Stripe
const stripe = Settings.stripe?.secretKey
  ? new Stripe(Settings.stripe.secretKey)
  : null

/**
 * Create a Stripe Checkout session for subscription
 */
async function createCheckoutSession(req, res) {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' })
  }

  const user = SessionManager.getSessionUser(req.session)
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  const priceId = Settings.stripe?.proPriceId
  if (!priceId) {
    return res.status(500).json({ error: 'Stripe price not configured' })
  }

  try {
    // Check if user already has a subscription
    const existingSubscription = await Subscription.findOne({
      admin_id: user._id,
    })

    if (
      existingSubscription &&
      existingSubscription.planCode &&
      existingSubscription.planCode !== 'free'
    ) {
      return res.status(400).json({ error: 'User already has an active subscription' })
    }

    // Get user from database for email
    const userDoc = await User.findById(user._id, 'email')
    
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${Settings.siteUrl}/user/subscription/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Settings.siteUrl}/user/subscription/plans`,
      client_reference_id: user._id.toString(),
      customer_email: userDoc?.email || user.email,
      metadata: {
        userId: user._id.toString(),
        planCode: 'pro',
      },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    res.json({ url: session.url })
  } catch (error) {
    logger.error({ err: error, userId: user._id }, 'Error creating Stripe checkout session')
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
async function createPortalSession(req, res) {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' })
  }

  const user = SessionManager.getSessionUser(req.session)
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    const subscription = await Subscription.findOne({ admin_id: user._id })

    if (!subscription?.paymentProvider?.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    // Get the Stripe subscription to find the customer ID
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.paymentProvider.subscriptionId
    )

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeSubscription.customer,
      return_url: `${Settings.siteUrl}/user/subscription`,
    })

    res.json({ url: session.url })
  } catch (error) {
    logger.error({ err: error, userId: user._id }, 'Error creating Stripe portal session')
    res.status(500).json({ error: 'Failed to create portal session' })
  }
}

/**
 * Handle Stripe webhook events
 */
async function handleWebhook(req, res) {
  if (!stripe) {
    logger.error('Stripe webhook called but Stripe is not configured')
    return res.status(500).json({ error: 'Stripe is not configured' })
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = Settings.stripe?.webhookSecret

  let event

  try {
    // req.body is a Buffer when using bodyParser.raw
    const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)
    
    if (webhookSecret && sig) {
      // Verify webhook signature (production mode)
      event = stripe.webhooks.constructEvent(bodyStr, sig, webhookSecret)
    } else {
      // For development/testing without webhook signature verification
      event = JSON.parse(bodyStr)
      logger.warn({ hasSignature: !!sig, hasSecret: !!webhookSecret }, 'Processing Stripe webhook without signature verification')
    }
    logger.info({ eventType: event.type, eventId: event.id }, 'Received Stripe webhook event')
  } catch (err) {
    logger.error({ err: err.message, sig: !!sig, webhookSecret: !!webhookSecret }, 'Stripe webhook processing failed')
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object)
        break

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe webhook event')
    }

    res.json({ received: true })
  } catch (error) {
    logger.error({ err: error, eventType: event.type }, 'Error processing Stripe webhook')
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId || session.client_reference_id
  const subscriptionId = session.subscription

  if (!userId || !subscriptionId) {
    logger.error({ session }, 'Missing userId or subscriptionId in checkout session')
    return
  }

  logger.info({ userId, subscriptionId }, 'Processing checkout completion')

  try {
    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    // Find or create user subscription
    let subscription = await Subscription.findOne({ admin_id: userId })

    if (!subscription) {
      subscription = new Subscription({
        admin_id: userId,
        manager_ids: [userId],
        member_ids: [],
      })
    }

    // Update subscription with Stripe details
    subscription.planCode = 'pro'
    subscription.paymentProvider = {
      service: 'stripe',
      subscriptionId: subscriptionId,
      state: stripeSubscription.status,
    }

    await subscription.save()

    // Update user features
    await FeaturesUpdater.promises.refreshFeatures(userId, 'stripe-checkout-completed')

    logger.info({ userId, subscriptionId }, 'Subscription activated successfully')
  } catch (error) {
    logger.error({ err: error, userId, subscriptionId }, 'Error processing checkout completion')
    throw error
  }
}

/**
 * Handle subscription updates (e.g., plan changes, renewals)
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  const subscriptionId = stripeSubscription.id

  try {
    const subscription = await Subscription.findOne({
      'paymentProvider.subscriptionId': subscriptionId,
    })

    if (!subscription) {
      logger.warn({ subscriptionId }, 'No subscription found for Stripe subscription update')
      return
    }

    // Update subscription state
    subscription.paymentProvider.state = stripeSubscription.status

    // Handle cancellation at period end
    if (stripeSubscription.cancel_at_period_end) {
      subscription.paymentProvider.state = 'canceled_pending'
    }

    await subscription.save()

    // Refresh user features
    await FeaturesUpdater.promises.refreshFeatures(
      subscription.admin_id,
      'stripe-subscription-updated'
    )

    logger.info({ subscriptionId, status: stripeSubscription.status }, 'Subscription updated')
  } catch (error) {
    logger.error({ err: error, subscriptionId }, 'Error processing subscription update')
    throw error
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(stripeSubscription) {
  const subscriptionId = stripeSubscription.id

  try {
    const subscription = await Subscription.findOne({
      'paymentProvider.subscriptionId': subscriptionId,
    })

    if (!subscription) {
      logger.warn({ subscriptionId }, 'No subscription found for Stripe subscription deletion')
      return
    }

    // Downgrade to free plan
    subscription.planCode = 'free'
    subscription.paymentProvider = {
      service: 'stripe',
      subscriptionId: null,
      state: 'canceled',
    }

    await subscription.save()

    // Refresh user features (will downgrade to free)
    await FeaturesUpdater.promises.refreshFeatures(
      subscription.admin_id,
      'stripe-subscription-deleted'
    )

    logger.info({ subscriptionId, userId: subscription.admin_id }, 'Subscription canceled')
  } catch (error) {
    logger.error({ err: error, subscriptionId }, 'Error processing subscription deletion')
    throw error
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription

  if (!subscriptionId) {
    return
  }

  try {
    const subscription = await Subscription.findOne({
      'paymentProvider.subscriptionId': subscriptionId,
    })

    if (!subscription) {
      return
    }

    logger.warn(
      { subscriptionId, userId: subscription.admin_id },
      'Payment failed for subscription'
    )

    // Could send notification to user here
  } catch (error) {
    logger.error({ err: error, subscriptionId }, 'Error processing payment failure')
  }
}

/**
 * Cancel subscription via Stripe
 */
async function cancelSubscription(req, res) {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' })
  }

  const user = SessionManager.getSessionUser(req.session)
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    const subscription = await Subscription.findOne({ admin_id: user._id })

    if (!subscription?.paymentProvider?.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    // Cancel at period end (user keeps access until billing period ends)
    await stripe.subscriptions.update(subscription.paymentProvider.subscriptionId, {
      cancel_at_period_end: true,
    })

    res.json({ success: true, message: 'Subscription will be canceled at the end of the billing period' })
  } catch (error) {
    logger.error({ err: error, userId: user._id }, 'Error canceling subscription')
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
}

export default {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  cancelSubscription,
}

