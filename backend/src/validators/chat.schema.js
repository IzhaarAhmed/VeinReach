import { z } from 'zod';

export const startConversationSchema = z.object({
  peerId: z.string().min(1),
  requestId: z.string().min(1).optional(),
});

const attachment = z.object({
  key: z.string().min(3).max(300),
  url: z.string().max(1000).optional(),
  contentType: z.string().max(100).optional(),
  name: z.string().max(200).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export const sendMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4000).optional(),
    attachment: attachment.optional(),
  })
  .refine((v) => v.text || v.attachment, { message: 'Message needs text or an attachment' });

export const listMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.coerce.date().optional(),
});
