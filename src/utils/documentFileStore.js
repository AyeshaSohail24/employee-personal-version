// The actual FILE of a document added on a Former record, kept in this browser's IndexedDB (built
// for binary data and far larger than localStorage), keyed by the document's id. The document's
// details (title, file name, description…) stay where they already are (formerService /
// storageEngine) — this only holds the bytes so the document can be opened later. Per browser, like
// those details. Every function fails soft: a browser without IndexedDB just can't open files.
const DB_NAME = 'rizurf_hr_documents';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot store files.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Saves a File/Blob under the document id. */
export const saveDocumentFile = (documentId, file) => run('readwrite', (store) => store.put(file, documentId));

/** The stored File/Blob for a document id, or null. */
export const getDocumentFile = async (documentId) => (await run('readonly', (store) => store.get(documentId))) ?? null;

/** Removes a document's stored file (no-op if there isn't one). */
export const deleteDocumentFile = (documentId) => run('readwrite', (store) => store.delete(documentId));
