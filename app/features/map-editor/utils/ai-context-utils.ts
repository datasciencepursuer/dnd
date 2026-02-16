import type { ChatMessageData } from "../store/chat-store";

/**
 * Filters chat messages for AI context by removing stale dice rolls.
 *
 * Keeps dice rolls from the last 60 seconds before the current turn started
 * (players often pre-roll) plus all rolls after the turn started.
 * Older dice rolls are stripped so the AI doesn't use stale rolls.
 * Non-dice messages are always kept for narrative context.
 */
export function filterMessagesForAI(
  messages: ChatMessageData[],
  turnStartedAt: string | undefined
): ChatMessageData[] {
  if (!turnStartedAt) return messages;

  // Allow rolls from 60s before turn start (pre-rolling window)
  const turnTime = new Date(turnStartedAt).getTime();
  const cutoff = new Date(turnTime - 60_000).toISOString();

  return messages.filter((msg) => {
    // Keep all non-dice-roll messages (chat, intents, AI responses)
    if (!msg.metadata?.diceRoll) return true;
    // Keep dice rolls from within the pre-roll window
    return msg.createdAt >= cutoff;
  });
}
