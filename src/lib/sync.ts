import Gun from 'gun';

// Initialize Gun with peers, but for now local
const gun = Gun();

const CHUNKS_KEY = 'social-portal-ethereal-chunks';

function loadChunks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHUNKS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveChunks(chunks: Record<string, string>): void {
  localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
}

export async function initIPFS() {
  // Go backend milestone: keep the chunk API stable while using a local fallback.
  // This avoids bundling Node-oriented IPFS dependencies in the browser build.
  return { type: 'local-fallback' };
}

// Function to store data in IPFS chunks
export async function storeChunk(data: string): Promise<string> {
  await initIPFS();
  const chunks = loadChunks();
  const cid = `chunk-${crypto.randomUUID()}`;
  chunks[cid] = data;
  saveChunks(chunks);
  return cid;
}

// Retrieve chunk
export async function retrieveChunk(cid: string): Promise<string> {
  await initIPFS();
  const chunks = loadChunks();
  if (cid in chunks) {
    return chunks[cid];
  }
  throw new Error(`Chunk not found: ${cid}`);
}

// For P2P sync using Gun
export const syncDB = gun.get('social-portal');

// Sync identities
export function syncIdentities(identities: any) {
  syncDB.get('identities').put(identities);
}

// Get synced identities
export function getSyncedIdentities(callback: (data: any) => void) {
  syncDB.get('identities').on(callback);
}

// Similarly for other data, like feeds, settings

// To preserve anti-tracking, use local relay or P2P without central server
// Gun can use peers, but for simplicity, keep local
