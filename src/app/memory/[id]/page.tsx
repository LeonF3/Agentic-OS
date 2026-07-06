"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Pin, Save, Trash2, X as XIcon } from "lucide-react";
import Markdown from "@/components/Markdown";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { NOTE_TYPES, type Note, type NoteMeta } from "@/lib/schemas";
import { useRouter } from "next/navigation";

export default function NoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { data: note, error, mutate } = useApi<Note>(`/api/memory/${id}`);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [noteType, setNoteType] = useState("Research");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) return <ErrorState message={error.message} retry={() => mutate()} />;
  if (!note) return <Spinner label="Opening note…" />;

  const startEdit = () => {
    setTitle(note.title);
    setMarkdown(note.markdown);
    setNoteType(note.type);
    setTags(note.tags.join(", "));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/memory/${id}`, {
        method: "PATCH",
        body: { title, markdown, type: noteType, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) },
      });
      setEditing(false);
      mutate();
      refresh("/api/memory", "/api/audit");
      toast("success", "Note updated");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async () => {
    try {
      await api(`/api/memory/${id}`, { method: "PATCH", body: { pinned: !note.pinned } });
      mutate();
      toast("info", note.pinned ? "Unpinned" : "Pinned — will be attached as agent context");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/api/memory/${id}`, { method: "DELETE" });
      toast("success", "Note deleted");
      refresh("/api/memory");
      router.push("/memory");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/memory" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mist-500 hover:text-mist-100">
        <ArrowLeft size={13} /> The Vault
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold text-mist-100">{note.title}</h1>
            <Badge status="idle">{note.type}</Badge>
            {note.pinned && <Pin size={14} className="text-gold" />}
          </div>
          <p className="mt-1 font-mono text-[11px] text-mist-500">
            vault/{note.path} · updated {timeAgo(note.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" icon={Pin} onClick={togglePin}>
            {note.pinned ? "Unpin" : "Pin"}
          </Button>
          {!editing && (
            <Button size="sm" icon={Pencil} onClick={startEdit}>
              Edit
            </Button>
          )}
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </Field>
              <Field label="Type">
                <Select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Markdown">
              <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={16} className="font-mono text-[13px]" />
            </Field>
            <Field label="Tags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" icon={XIcon} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" icon={Save} onClick={save} loading={saving}>
                Save note
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          {note.markdown ? <Markdown>{note.markdown}</Markdown> : <p className="text-sm text-mist-500">This note is empty — hit Edit to write.</p>}
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card title="Tags">
          {note.tags.length === 0 ? (
            <p className="text-xs text-mist-500">No tags yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map((t) => (
                <span key={t} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-indigo-soft">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </Card>
        <Card title={`Backlinks (${note.backlinks.length})`}>
          {note.backlinks.length === 0 ? (
            <p className="text-xs text-mist-500">
              No backlinks yet — reference this note from another with <span className="font-mono">[[{note.title}]]</span>.
            </p>
          ) : (
            <BacklinkList ids={note.backlinks} />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        loading={deleting}
        title="Delete note?"
        body={`"${note.title}" will be removed from the Vault and its markdown file deleted from disk.`}
      />
    </div>
  );
}

function BacklinkList({ ids }: { ids: string[] }) {
  return (
    <ul className="space-y-1.5">
      {ids.map((id) => (
        <BacklinkRow key={id} id={id} />
      ))}
    </ul>
  );
}

function BacklinkRow({ id }: { id: string }) {
  const { data } = useApi<NoteMeta & { markdown: string }>(`/api/memory/${id}`);
  return (
    <li>
      <Link href={`/memory/${id}`} className="text-[13px] text-indigo-soft hover:underline">
        {data?.title ?? id}
      </Link>
    </li>
  );
}
