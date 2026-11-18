"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiBaseUrl } from "@/lib/api-url.mjs";

type StudentDocument = {
  id: string;
  documentType: string;
  contentType: string | null;
  createdAt: string;
};

const maxDocumentBytes = 5 * 1024 * 1024;

function getApiOrigin() {
  return apiBaseUrl;
}

function isStudentDocument(value: unknown): value is StudentDocument {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.documentType === "string" &&
    (record.contentType === null || typeof record.contentType === "string") &&
    typeof record.createdAt === "string" && !Number.isNaN(Date.parse(record.createdAt));
}

export function DocumentPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [photoPreview, setPhotoPreview] = useState<{ id: string; url: string } | null>(null);
  const photoPreviewUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => {
    if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
  }, []);

  async function loadDocuments() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId)}/documents`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("Student documents are no longer available to this account.");
        return;
      }
      if (!response.ok) {
        setError("Student documents could not be loaded. Please try again.");
        return;
      }
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null ||
        !Array.isArray((payload as { documents?: unknown }).documents) ||
        !(payload as { documents: unknown[] }).documents.every(isStudentDocument)) {
        setError("The document response could not be read safely.");
        return;
      }
      setDocuments((payload as { documents: StudentDocument[] }).documents);
      setLoaded(true);
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePanel() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!loaded && !loading) await loadDocuments();
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || uploading || downloadingId || deletingId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const documentType = String(values.get("documentType") ?? "").trim();
    const file = values.get("file");
    if (!documentType || documentType.length > 80) {
      setError("Enter a document type using no more than 80 characters.");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF, JPEG, or PNG file to upload.");
      return;
    }
    if (file.size > maxDocumentBytes) {
      setError("The file must be 5 MiB or smaller.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Choose a PDF, JPEG, or PNG file.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId)}/documents`, {
        method: "POST",
        credentials: "include",
        body: values,
      });
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("You no longer have permission to add documents for this student.");
        return;
      }
      if (response.status === 400) {
        setError("The file content or document type is invalid. Choose a valid PDF, JPEG, or PNG file.");
        return;
      }
      if (response.status === 413) {
        setError("The file must be 5 MiB or smaller.");
        return;
      }
      if (response.status === 429) {
        setError("Too many uploads were attempted. Please wait a minute and try again.");
        return;
      }
      if (!response.ok) {
        setError("The document could not be uploaded. Please try again.");
        return;
      }
      const uploaded: unknown = await response.json();
      if (!isStudentDocument(uploaded)) {
        setError("The saved document response could not be read safely.");
        return;
      }
      setDocuments((current) => [uploaded, ...current].sort((left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id)));
      setLoaded(true);
      form.reset();
      setMessage("Document uploaded successfully.");
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(document: StudentDocument) {
    if (loading || uploading || downloadingId || deletingId) return;
    setDownloadingId(document.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(document.id)}/file`,
        { credentials: "include", cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This document is no longer available to your account.");
        return;
      }
      if (!response.ok) {
        setError("The document could not be downloaded. Please try again.");
        return;
      }
      const extension = document.contentType === "application/pdf" ? "pdf"
        : document.contentType === "image/jpeg" ? "jpg"
          : document.contentType === "image/png" ? "png" : null;
      if (!extension || response.headers.get("Content-Type")?.split(";")[0] !== document.contentType) {
        setError("The downloaded file type could not be verified.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `student-document-${document.id}.${extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Document downloaded.");
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function previewStudentPhoto(document: StudentDocument) {
    if (photoPreview?.id === document.id) {
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
      photoPreviewUrl.current = null;
      setPhotoPreview(null);
      return;
    }
    if (loading || uploading || downloadingId || deletingId) return;
    setDownloadingId(document.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(document.id)}/file`,
        { credentials: "include", cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This photograph is no longer available to your account.");
        return;
      }
      if (!response.ok || !["image/jpeg", "image/png"].includes(response.headers.get("Content-Type")?.split(";")[0] ?? "")) {
        setError("The photograph could not be verified.");
        return;
      }
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
      const url = URL.createObjectURL(await response.blob());
      photoPreviewUrl.current = url;
      setPhotoPreview({ id: document.id, url });
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteDocument(document: StudentDocument) {
    if (loading || uploading || downloadingId || deletingId) return;
    if (!window.confirm(`Delete the ${document.documentType} document for ${studentName}? This permanently removes the file.`)) return;
    setDeletingId(document.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `${getApiOrigin()}/api/v1/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(document.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setError("This document is no longer available to delete.");
        return;
      }
      if (response.status === 429) {
        setError("Too many document changes were attempted. Please wait a minute and try again.");
        return;
      }
      if (!response.ok) {
        setError("The document could not be deleted. Please try again.");
        return;
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (photoPreview?.id === document.id) {
        if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
        photoPreviewUrl.current = null;
        setPhotoPreview(null);
      }
      setMessage("Document deleted.");
    } catch {
      setError("The student service is unavailable. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="student-document-panel" aria-label={`Documents for ${studentName}`}>
      <Button variant="secondary" size="sm" onClick={togglePanel} aria-expanded={open}>
        {open ? "Hide documents" : "View documents"}
      </Button>
      {open ? (
        <div className="student-document-panel__content" aria-busy={loading}>
          <h3>Student document records</h3>
          {loading ? <p role="status">Loading document recordsâ€¦</p> : null}
          {!loading && loaded && documents.length === 0 ? <p>No document records have been added.</p> : null}
          {documents.length > 0 ? (
            <ul className="student-document-list">
              {documents.map((document) => (
                <li key={document.id}>
                  <strong>{document.documentType}</strong>
                  <span>{document.contentType ?? "File type not recorded"}</span>
                  <span>Added {new Date(document.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}</span>
                  {document.documentType.trim().toLowerCase() === "student photograph" &&
                    ["image/jpeg", "image/png"].includes(document.contentType ?? "") ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => previewStudentPhoto(document)} loading={downloadingId === document.id} loadingLabel="Loading photograph" disabled={loading || uploading || deletingId !== null || (downloadingId !== null && downloadingId !== document.id)}>
                        {photoPreview?.id === document.id ? "Hide photograph" : "Preview photograph"}
                      </Button>
                      {photoPreview?.id === document.id ? (
                        // This short-lived blob URL was fetched with the user's session; it must not pass through the image optimizer.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="student-document-photo" src={photoPreview.url} alt={`${studentName} photograph`} />
                      ) : null}
                    </>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => downloadDocument(document)} loading={downloadingId === document.id} loadingLabel="Downloading document" disabled={loading || uploading || deletingId !== null || (downloadingId !== null && downloadingId !== document.id)}>
                    Download file
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteDocument(document)} loading={deletingId === document.id} loadingLabel="Deleting document" disabled={loading || uploading || downloadingId !== null || (deletingId !== null && deletingId !== document.id)}>
                    Delete document
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="student-document-panel__error" role="alert">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <form className="student-document-form" onSubmit={uploadDocument}>
            <TextField label="Document type" name="documentType" maxLength={80} hint="Enter Student photograph for a profile photo; photographs must be JPEG or PNG." required />
            <TextField label="File" name="file" type="file" accept="application/pdf,image/jpeg,image/png" hint="PDF, JPEG, or PNG; maximum 5 MiB." required />
            <Button type="submit" variant="secondary" loading={uploading} loadingLabel="Uploading document" disabled={loading || downloadingId !== null || deletingId !== null}>Upload document</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
