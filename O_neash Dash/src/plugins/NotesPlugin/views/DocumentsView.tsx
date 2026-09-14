import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { useNotesStore } from '../store/useNotesStore';
import type { NoteRow } from '../lib/notesDb';
import FileSystemView from '../components/FileSystemView';
import TypewriterEditor from '../components/TypewriterEditor';

const transition: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

interface DocumentsViewProps {
  defaultOpenDoc?: NoteRow | null;
  onDefaultDocOpened?: () => void;
}

export default function DocumentsView({ defaultOpenDoc, onDefaultDocOpened }: DocumentsViewProps) {
  const { documents, loadDocuments, ensureDocument, flushDocument, createDocument, updateDocument, deleteNote } = useNotesStore();
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openDoc = documents.find(doc => doc.id === openDocId) ?? null;
  const dirRef = useRef<1 | -1>(1);

  useEffect(() => { void loadDocuments().catch(error => setError(String(error))); }, [loadDocuments]);

  // Auto-open a doc passed in from the promote flow
  useEffect(() => {
    if (!defaultOpenDoc) return;
    dirRef.current = 1;
    setOpenDocId(defaultOpenDoc.id);
    void ensureDocument(defaultOpenDoc.id).catch(error => setError(String(error)));
    onDefaultDocOpened?.();
  }, [defaultOpenDoc?.id]);

  const handleSave = useCallback(async (title: string, contentJson: string) => {
    if (!openDocId) return;
    await updateDocument(openDocId, title, contentJson);
  }, [openDocId, updateDocument]);

  const openEditor = useCallback((doc: NoteRow) => { dirRef.current = 1; setOpenDocId(doc.id); void ensureDocument(doc.id).catch(error => setError(String(error))); }, [ensureDocument]);
  const closeEditor = useCallback(() => {
    if (!openDocId) return;
    void flushDocument(openDocId).then(() => { dirRef.current = -1; setOpenDocId(null); }).catch(error => setError(String(error)));
  }, [openDocId, flushDocument]);

  const handleNavigate = useCallback(async (docId: string) => {
    if (openDocId) await flushDocument(openDocId);
    const target = await ensureDocument(docId);
    if (target) openEditor(target);
  }, [openEditor, openDocId, flushDocument, ensureDocument]);

  const handleDeleteDoc = useCallback(async (id: string) => {
    await deleteNote(id);
    // If the deleted doc is currently open, go back to the file system
    if (openDocId === id) { dirRef.current = -1; setOpenDocId(null); }
  }, [deleteNote, openDocId]);

  const handleCreateDoc = async (arcId: string | null, projectId: string | null) => {
    const id  = await createDocument('New Document', arcId, projectId);
    const doc = await ensureDocument(id);
    if (doc) openEditor(doc);
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {error && <div role="alert" style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, color: '#f87171' }}>{error}</div>}
      <AnimatePresence mode="popLayout" custom={dirRef.current}>
        {openDoc ? (
          <motion.div
            key={openDoc.id}
            initial={{ x: '6%', opacity: 0, scale: 0.98 }}
            animate={{ x: 0,    opacity: 1, scale: 1    }}
            exit={{    x: '6%', opacity: 0, scale: 0.98 }}
            transition={transition}
            style={{ position: 'absolute', inset: 0 }}
          >
            <TypewriterEditor
              doc={openDoc}
              onSave={handleSave}
              onBack={closeEditor}
              onDelete={() => { void handleDeleteDoc(openDoc.id).catch(error => setError(String(error))); }}
              onNavigate={id => { void handleNavigate(id).catch(error => setError(String(error))); }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="fs"
            initial={{ x: '-6%', opacity: 0 }}
            animate={{ x: 0,     opacity: 1 }}
            exit={{    x: '-6%', opacity: 0 }}
            transition={transition}
            style={{ position: 'absolute', inset: 0 }}
          >
            <FileSystemView onOpenDoc={openEditor} onCreateDoc={handleCreateDoc} onDeleteDoc={handleDeleteDoc} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
