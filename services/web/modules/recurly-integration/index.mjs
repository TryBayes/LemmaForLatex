/** @import { WebModule } from "../../types/web-module" */

import RecurlyClient from '../../app/src/Features/Subscription/RecurlyClient.mjs'
import SubscriptionHelper from '../../app/src/Features/Subscription/SubscriptionHelper.mjs'
import { PaymentProviderAccount } from '../../app/src/Features/Subscription/PaymentProviderEntities.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

/**
 * Get payment information from Recurly for a subscription
 * @param {Object} subscription - The subscription document from MongoDB
 * @returns {Promise<Object|null>} Payment record or null
 */
async function getPaymentFromRecordImpl(subscription) {
  // Skip if Recurly is not configured
  if (!Settings.apis?.recurly?.apiKey) {
    logger.debug('Recurly API key not configured, skipping payment fetch')
    return null
  }

  if (!subscription) {
    return null
  }

  // Get the payment provider subscription ID (works for both Recurly and Stripe)
  const subscriptionId =
    SubscriptionHelper.getPaymentProviderSubscriptionId(subscription)

  if (!subscriptionId) {
    logger.debug(
      { subscriptionId: subscription._id },
      'No payment provider subscription ID found'
    )
    return null
  }

  // Only handle Recurly subscriptions
  // Check if it's a Recurly subscription by looking at the field used
  if (!subscription.recurlySubscription_id) {
    logger.debug(
      { subscriptionId: subscription._id },
      'Not a Recurly subscription, skipping'
    )
    return null
  }

  try {
    // Fetch subscription from Recurly
    const recurlySubscription =
      await RecurlyClient.promises.getSubscription(subscriptionId)

    if (!recurlySubscription) {
      logger.warn({ subscriptionId }, 'Could not find Recurly subscription')
      return null
    }

    // Get the user ID from the subscription
    const userId =
      subscription.admin_id?.toString() || recurlySubscription.userId

    // Fetch account info and coupons
    let account = null
    let coupons = []

    if (userId) {
      try {
        account = await RecurlyClient.promises.getAccountForUserId(userId)
      } catch (err) {
        logger.debug(
          { err, userId },
          'Could not fetch Recurly account, using default'
        )
      }

      try {
        coupons = await RecurlyClient.promises.getActiveCouponsForUserId(userId)
      } catch (err) {
        logger.debug({ err, userId }, 'Could not fetch Recurly coupons')
        coupons = []
      }
    }

    // Return the payment record in the expected format
    return {
      subscription: recurlySubscription,
      account:
        account ||
        new PaymentProviderAccount({
          code: userId || 'unknown',
          email: subscription.admin_id?.email || '',
          hasPastDueInvoice: false,
        }),
      coupons: coupons || [],
    }
  } catch (error) {
    logger.error(
      { err: error, subscriptionId },
      'Error fetching payment record from Recurly'
    )
    return null
  }
}

/** @type {WebModule} */
const RecurlyIntegrationModule = {
  hooks: {
    // Promise-based hooks (used by Modules.promises.hooks.fire)
    promises: {
      getPaymentFromRecord: getPaymentFromRecordImpl,
      getPaymentFromRecordPromise: getPaymentFromRecordImpl,
    },
  },
}

export default RecurlyIntegrationModule
