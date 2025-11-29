import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const AiMessageCountSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    totalMessages: { type: Number, default: 0 },
    weeklyMessages: { type: Number, default: 0 },
    weekStartDate: { type: Date, default: () => getWeekStart() },
    lastMessageAt: { type: Date },
  },
  { collection: 'aiMessageCounts' }
)

// Helper to get the start of the current week (Monday 00:00:00 UTC)
function getWeekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0))
  return weekStart
}

// Static method to get user's weekly message count (resets if new week)
AiMessageCountSchema.statics.getWeeklyCount = async function (userId) {
  const currentWeekStart = getWeekStart()
  
  let record = await this.findOne({ userId })
  
  if (!record) {
    return { weeklyMessages: 0, weekStartDate: currentWeekStart }
  }
  
  // Check if we need to reset for a new week
  if (!record.weekStartDate || record.weekStartDate < currentWeekStart) {
    // New week - reset count
    record.weeklyMessages = 0
    record.weekStartDate = currentWeekStart
    await record.save()
  }
  
  return { weeklyMessages: record.weeklyMessages, weekStartDate: record.weekStartDate }
}

// Static method to increment weekly count
AiMessageCountSchema.statics.incrementWeeklyCount = async function (userId) {
  const currentWeekStart = getWeekStart()
  
  const result = await this.findOneAndUpdate(
    { userId },
    {
      $inc: { totalMessages: 1, weeklyMessages: 1 },
      $set: { lastMessageAt: new Date() },
      $setOnInsert: { weekStartDate: currentWeekStart },
    },
    { upsert: true, new: true }
  )
  
  // Check if week needs reset
  if (result.weekStartDate < currentWeekStart) {
    result.weeklyMessages = 1
    result.weekStartDate = currentWeekStart
    await result.save()
  }
  
  return result
}

export const AiMessageCount = mongoose.model(
  'AiMessageCount',
  AiMessageCountSchema
)

