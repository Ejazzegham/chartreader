import { communityCall } from './license';

// Community: types and server calls (server/community.js). All calls need the logged-in session token.
export type CKind = 'analysis' | 'discussion' | 'question';
export type CAuthor = { name: string; cc: string; role: 'admin' | 'member'; joined: number };
export type CAnalysis = { side: 'buy' | 'sell'; entry: number; sl: number; tps: number[]; tf: string; dec: number; grade?: string; score?: number; source?: string };
export type CSymbol = { id: string; name: string };
export type CPost = {
  id: number; kind: CKind; title: string; body: string; symbol: CSymbol | null; analysis: CAnalysis | null;
  created: number; edited: number; pinned: boolean; hidden: boolean; reports: number;
  author: CAuthor; mine: boolean; likes: number; liked: boolean; comments: number;
};
export type CComment = { id: number; postId: number; body: string; created: number; hidden: boolean; reports: number; author: CAuthor; mine: boolean; likes: number; liked: boolean };
export type CFeed = {
  posts: CPost[]; more: boolean; me: CAuthor & { admin: boolean };
  stats?: { posts: number; today: number; comments: number };
  trending?: { id: string; name: string; n: number }[];
  top?: (CAuthor & { posts: number; likes: number })[];
};
export type FeedQuery = { kind?: CKind | ''; sort?: 'new' | 'top'; symbol?: string; q?: string; mine?: boolean; offset?: number; limit?: number };

export const commFeed = (tk: string, q: FeedQuery): Promise<CFeed> => communityCall(tk, 'feed', q);
export const commPost = (tk: string, b: { kind: CKind; title: string; body: string; symbol?: CSymbol | null; analysis?: Omit<CAnalysis, 'grade' | 'score' | 'source'> & Partial<CAnalysis> | null }): Promise<{ post: CPost }> => communityCall(tk, 'post', b);
export const commEdit = (tk: string, id: number, title: string, body: string): Promise<{ post: CPost }> => communityCall(tk, 'post/edit', { id, title, body });
export const commDelete = (tk: string, id: number) => communityCall(tk, 'post/delete', { id });
export const commLike = (tk: string, type: 'post' | 'comment', id: number): Promise<{ liked: boolean; likes: number }> => communityCall(tk, 'like', { type, id });
export const commComments = (tk: string, postId: number): Promise<{ comments: CComment[] }> => communityCall(tk, 'comments', { postId });
export const commComment = (tk: string, postId: number, body: string): Promise<{ comment: CComment; comments: number }> => communityCall(tk, 'comment', { postId, body });
export const commCommentDelete = (tk: string, id: number): Promise<{ ok: boolean; comments: number }> => communityCall(tk, 'comment/delete', { id });
export const commReport = (tk: string, type: 'post' | 'comment', id: number) => communityCall(tk, 'report', { type, id });
export const commPin = (tk: string, id: number, pinned: boolean): Promise<{ post: CPost }> => communityCall(tk, 'admin/pin', { id, pinned });
export const commHide = (tk: string, type: 'post' | 'comment', id: number, hidden: boolean) => communityCall(tk, 'admin/hide', { type, id, hidden });

export const KIND_LABEL: Record<CKind, string> = { analysis: 'Analysis', discussion: 'Discussion', question: 'Question' };
export const KIND_ICON: Record<CKind, string> = { analysis: 'stats-chart', discussion: 'chatbubbles', question: 'help-circle' };
export const KIND_COLOR: Record<CKind, string> = { analysis: '#2F6FED', discussion: '#7C4DDB', question: '#D98A00' };

export const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000)); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
  const mo = Math.round(d / 30); return mo < 12 ? mo + 'mo ago' : Math.round(mo / 12) + 'y ago';
};
export const fmtLevel = (n: number, dec: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: Math.max(dec, 0) });
// Reward to risk of a take profit: how many times the stop distance the target is.
export const rr = (a: Pick<CAnalysis, 'entry' | 'sl'>, tp: number) => { const risk = Math.abs(a.entry - a.sl); return risk > 0 ? Math.abs(tp - a.entry) / risk : 0; };
// A colour for a member's initial, the same for the same name everywhere.
const AV = ['#2F6FED', '#7C4DDB', '#D98A00', '#12A150', '#D9418C', '#0E9AA7', '#E0592A', '#5B6577'];
export const avatarColor = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
export const initialOf = (name: string) => (Array.from(name.trim())[0] || '?').toUpperCase();
