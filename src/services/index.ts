import { conversationService } from './conversationService';
import { contextService } from './ContextService';
import { createStreamHandler, createSyncHandler } from './streamService';

export const serviceFactory = {
  conversation: conversationService,
  context: contextService,

  stream: {
    createHandler: createStreamHandler,
    createSyncHandler,
  },

  utils: {
    getUserId: () => 'user_d4y6df',
    generateId: () =>
      `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  },
};

export default serviceFactory;
