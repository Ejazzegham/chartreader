// Support chat when the license server is off: the message is kept on the phone and sent by itself as soon as the server answers.
// Text only (a photo or video needs the server to receive it). Pure helpers + AsyncStorage; tested in tests/chatoutbox.test.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supportSend, ChatMsg } from './license';

export type Queued = { qid: string; text: string; at: number };
const KEY = 'chat_outbox', MAX = 20, MAX_LEN = 2000; // same text limit as the server (server/support.js)

export async function loadOutbox(): Promise<Queued[]> {
  try { const v = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x.text === 'string' && typeof x.qid === 'string') : []; } catch { return []; }
}
const save = (l: Queued[]) => AsyncStorage.setItem(KEY, JSON.stringify(l)).catch(() => {});

export async function enqueue(text: string, now = Date.now()): Promise<Queued[]> {
  const x = String(text || '').trim().slice(0, MAX_LEN); const cur = await loadOutbox();
  if (!x) return cur;
  const next = [...cur, { qid: now + '-' + Math.random().toString(36).slice(2, 8), text: x, at: now }].slice(-MAX);
  await save(next); return next;
}

// Sends the waiting messages in order. Stops at the first one that cannot be sent (the order of a conversation matters) and keeps the rest.
// A message the server REFUSES (for example "too many messages") stays queued too, so nothing is lost; the next try may work.
let busy = false;
export async function flushOutbox(token: string, send: (token: string, text: string) => Promise<{ message: ChatMsg }> = supportSend): Promise<ChatMsg[]> {
  if (!token || busy) return [];
  busy = true; const done: ChatMsg[] = [];
  try {
    let list = await loadOutbox();
    while (list.length) {
      try { const r = await send(token, list[0].text); done.push(r.message); list = list.slice(1); await save(list); }
      catch { break; }
    }
  } finally { busy = false; }
  return done;
}
// Called from the store when the server answers. The Help screen shows the result the next time it loads the conversation.
export const flushChatOutbox = (token: string): void => { flushOutbox(token).catch(() => {}); };
