import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const AiMessageCountSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    totalMessages: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
  },
  { collection: 'aiMessageCounts' }
)

export const AiMessageCount = mongoose.model(
  'AiMessageCount',
  AiMessageCountSchema
)

