// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Tiny IndexedDB store for uploaded asset blobs. Uploads are held as blob: URLs
// which the browser revokes on unload, so they can't be persisted as strings —
// the bytes go here (keyed by the asset id) and a fresh object URL is rebuilt on
// the next load. All calls reject softly; callers treat failures as non-fatal
// (a missed blob just means that one upload doesn't restore).

const DB_NAME = 'motion-assets';
const STORE = 'blobs';
let pending=0;
export function pendingAssetTransactions(){return pending;}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  pending++;
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        let result: T;
        req.onsuccess = () => { result = req.result as T; };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Falha ao salvar no armazenamento local.')); };
      }),
  ).finally(()=>{pending--;});
}

export const idbPut = (id: string, blob: Blob) => run<void>('readwrite', (s) => s.put(blob, id));
export const idbGet = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const idbDelete = (id: string) => run<void>('readwrite', (s) => s.delete(id));
export const idbKeys = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
