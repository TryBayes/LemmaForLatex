import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

const ToolResultSchema = new Schema({
  toolName: { type: String },
  result: Schema.Types.Mixed,
}, { _id: false })

const MessagePartSchema = new Schema({
  type: { type: String, enum: ['text', 'tool_results'], required: true },
  content: { type: String }, // For text parts
  results: [ToolResultSchema], // For tool_results parts
}, { _id: false })

const MessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  toolResults: [ToolResultSchema], // Keep for backwards compatibility
  parts: [MessagePartSchema], // Ordered parts array
})

export const AiConversationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, default: 'New Chat' },
    messages: [MessageSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'aiConversations' }
)

// Compound index for efficient lookups
AiConversationSchema.index({ userId: 1, projectId: 1, updatedAt: -1 })

export const AiConversation = mongoose.model(
  'AiConversation',
  AiConversationSchema
)
