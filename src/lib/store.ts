import { customAlphabet } from 'nanoid';
import type { Match } from './types';

const shortId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);
const KEY = (id: string) => `crichub:match:${id}`;

// Vercel KV is active when KV_REST_API_URL + KV_REST_API_TOKEN are set
// (auto-injected by Vercel when a KV database is linked).
const hasKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

declare global {
  // eslint-disable-next-line no-var
  var __crichubStore: Map<string, Match> | undefined;
}
const memory: Map<string, Match> = globalThis.__crichubStore ?? new Map();
if (!globalThis.__crichubStore) globalThis.__crichubStore = memory;

type Store = {
  get(id: string): Promise<Match | null>;
  set(id: string, match: Match): Promise<void>;
  create(match: Omit<Match, 'id'> & { id?: string }): Promise<Match>;
};

async function kvStore(): Promise<Store> {
  const { kv } = await import('@vercel/kv');
  return {
    async get(id) {
      return (await kv.get<Match>(KEY(id))) ?? null;
    },
    async set(id, match) {
      await kv.set(KEY(id), match);
    },
    async create(match) {
      const id = match.id ?? shortId();
      const full: Match = { ...match, id } as Match;
      await kv.set(KEY(id), full);
      return full;
    },
  };
}

const memoryStore: Store = {
  async get(id) {
    return memory.get(id) ?? null;
  },
  async set(id, match) {
    memory.set(id, match);
  },
  async create(match) {
    const id = match.id ?? shortId();
    const full: Match = { ...match, id } as Match;
    memory.set(id, full);
    return full;
  },
};

let _store: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (_store) return _store;
  _store = hasKV ? kvStore() : Promise.resolve(memoryStore);
  return _store;
}

export const store: Store = {
  async get(id) {
    return (await getStore()).get(id);
  },
  async set(id, match) {
    return (await getStore()).set(id, match);
  },
  async create(match) {
    return (await getStore()).create(match);
  },
};
