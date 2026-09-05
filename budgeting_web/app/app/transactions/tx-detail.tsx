"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, formatMoney, formatDateKey, ApiClientError } from "@/lib/api";

type Tx = {
  id: number;
  type: string;
  amountCents: number;
  date: string;
  description: string;
  notes: string | null;
  merchant: string | null;
  paymentMethod: string | null;
  category?: { name: string; color: string } | null;
};

type Attachment = {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

const input =
  "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

export function TxDetailModal({
  id,
  currency,
  onClose,
}: {
  id: number;
  currency: string;
  onClose: () => void;
}) {
  const [tx, setTx] = useState<Tx | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Tx>(`/transactions/${id}`);
      setTx(data);
      setNotes(data.notes ?? "");
      setFiles(await api.get<Attachment[]>(`/transactions/${id}/attachments`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.patch(`/transactions/${id}`, { notes });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("File is too large (max 2MB)");
      return;
    }
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    try {
      await api.post(`/transactions/${id}/attachments`, {
        filename: file.name,
        mimeType: file.type,
        dataBase64: btoa(binary),
      });
      setError(null);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    }
  }

  async function removeFile(attachmentId: number) {
    if (!confirm("Delete this attachment?")) return;
    await api.delete(`/attachments/${attachmentId}`);
    load();
  }

  async function removeTx() {
    if (!confirm("Delete this transaction?")) return;
    await api.delete(`/transactions/${id}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[92dvh] overflow-y-auto">
        {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2 mb-3">{error}</p>}
        {!tx ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{tx.type.replace("_", " ")}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatMoney(tx.amountCents, currency)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {formatDateKey(tx.date)}
                  {tx.category ? ` · ${tx.category.name}` : ""}
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl" aria-label="Close">
                ✕
              </button>
            </div>

            {tx.description && (
              <p className="text-sm text-slate-700 dark:text-slate-200 mb-1">{tx.description}</p>
            )}
            {tx.merchant && <p className="text-xs text-slate-400 mb-1">Merchant: {tx.merchant}</p>}
            {tx.paymentMethod && <p className="text-xs text-slate-400 mb-3">Paid via {tx.paymentMethod}</p>}

            <label htmlFor="tx-notes" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mt-4 mb-1">
              Notes
            </label>
            <textarea
              id="tx-notes"
              rows={2}
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              className={input}
              placeholder="Add a note…"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </button>

            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-2">
              Receipts ({files.length})
            </h3>
            <ul className="space-y-2 mb-3">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                  <a
                    href={`/api/attachments/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                  >
                    {f.mimeType === "application/pdf" ? "📄" : "🖼️"} {f.filename}
                  </a>
                  <button onClick={() => removeFile(f.id)} className="text-xs text-rose-500 shrink-0" aria-label={`Delete ${f.filename}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="w-full border border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-3 text-sm text-slate-500 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-600"
            >
              📷 Attach receipt (photo, image, or PDF · max 2MB)
            </button>

            <button
              onClick={removeTx}
              className="w-full mt-4 text-sm text-rose-600 border border-rose-200 dark:border-rose-800 rounded-lg py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/30"
            >
              Delete transaction
            </button>
          </>
        )}
      </div>
    </div>
  );
}
