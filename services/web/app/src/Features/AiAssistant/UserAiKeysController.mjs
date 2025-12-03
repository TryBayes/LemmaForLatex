import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'
import crypto from 'crypto'
import { db } from '../../infrastructure/mongodb.mjs'
import { ObjectId } from 'mongodb'

// Simple encryption for API keys (in production, use a proper secret management service)
const ENCRYPTION_KEY = process.env.AI_KEY_ENCRYPTION_SECRET || 'default-key-change-in-production-32'
const IV_LENGTH = 16

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(text) {
  const parts = text.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = parts[1]
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function maskKey(key) {
  if (key.length <= 8) return '****'
  return key.substring(0, 4) + '...' + key.substring(key.length - 4)
}

const UserAiKeysController = {
  async listKeys(req, res, next) {
    try {
      const userId = SessionManager.getLoggedInUserId(req.session)
      
      const keys = await db.userAiKeys.find({ userId: new ObjectId(userId) }).toArray()
      
      const safeKeys = keys.map(k => ({
        id: k._id.toString(),
        provider: k.provider,
        keyPreview: maskKey(decrypt(k.encryptedKey)),
        createdAt: k.createdAt,
      }))
      
      res.json({ keys: safeKeys })
    } catch (error) {
      logger.error({ error }, 'Failed to list AI keys')
      next(error)
    }
  },

  async addKey(req, res, next) {
    try {
      const userId = SessionManager.getLoggedInUserId(req.session)
      const { provider, apiKey } = req.body
      
      if (!provider || !apiKey) {
        return res.status(400).json({ error: 'Provider and API key are required' })
      }
      
      const validProviders = ['anthropic', 'openai', 'google']
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' })
      }
      
      // Check if user already has a key for this provider
      const existing = await db.userAiKeys.findOne({
        userId: new ObjectId(userId),
        provider,
      })
      
      if (existing) {
        // Update existing key
        await db.userAiKeys.updateOne(
          { _id: existing._id },
          {
            $set: {
              encryptedKey: encrypt(apiKey),
              updatedAt: new Date(),
            },
          }
        )
        return res.json({ success: true, message: 'API key updated' })
      }
      
      // Insert new key
      const result = await db.userAiKeys.insertOne({
        userId: new ObjectId(userId),
        provider,
        encryptedKey: encrypt(apiKey),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      res.json({ 
        success: true, 
        keyId: result.insertedId.toString(),
        message: 'API key saved' 
      })
    } catch (error) {
      logger.error({ error }, 'Failed to add AI key')
      next(error)
    }
  },

  async deleteKey(req, res, next) {
    try {
      const userId = SessionManager.getLoggedInUserId(req.session)
      const { keyId } = req.params
      
      const result = await db.userAiKeys.deleteOne({
        _id: new ObjectId(keyId),
        userId: new ObjectId(userId),
      })
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Key not found' })
      }
      
      res.json({ success: true })
    } catch (error) {
      logger.error({ error }, 'Failed to delete AI key')
      next(error)
    }
  },

  async getKeyStatus(req, res, next) {
    try {
      const userId = SessionManager.getLoggedInUserId(req.session)
      
      const keys = await db.userAiKeys.find({ userId: new ObjectId(userId) }).toArray()
      
      const hasKeys = keys.length > 0
      const providers = keys.map(k => k.provider)
      
      res.json({ hasKeys, providers })
    } catch (error) {
      logger.error({ error }, 'Failed to get AI key status')
      next(error)
    }
  },

  // Helper function to get decrypted key for a user (used by AI assistant)
  async getDecryptedKey(userId, provider) {
    const key = await db.userAiKeys.findOne({
      userId: new ObjectId(userId),
      provider,
    })
    
    if (!key) return null
    
    return decrypt(key.encryptedKey)
  },
}

export default UserAiKeysController
