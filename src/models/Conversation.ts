import mongoose from 'mongoose';

const todoItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    content: { type: String, required: true },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    estimated_time: { type: Number, required: true },
    category: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false },
);

const todoListDataSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['todo_list'],
      required: true,
    },
    title: { type: String, required: true },
    items: { type: [todoItemSchema], required: true },
  },
  { _id: false },
);

const searchResultItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    content: { type: String, required: true },
    score: { type: Number },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    content: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    timestamp: { type: Date, default: Date.now },
    thinking: { type: String },
    isStreaming: { type: Boolean, default: false },
    currentStreamText: { type: String },
    thinkingTime: { type: Number },
    searchInfo: { type: String },
    searchTime: { type: Number },
    searchResults: { type: [searchResultItemSchema], default: [] },
    todoData: { type: todoListDataSchema },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, default: '新对话' },
  messages: { type: [messageSchema], default: [] },
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

conversationSchema.index({ userId: 1, isArchived: 1, updatedAt: -1 });

export const ConversationModel =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', conversationSchema);
