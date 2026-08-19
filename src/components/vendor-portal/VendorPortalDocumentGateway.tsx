"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  Loader2,
  ShieldAlert,
  Calendar,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface RequiredDocConfig {
  type: string;
  mandatory: boolean;
  description?: string;
}

interface UploadedDocument {
  id: number;
  documentType: string;
  documentName: string;
  fileUrl: string;
  expiryDate?: string | null;
  uploadedAt: string;
  reviewStatus?: string;
}

interface VendorPortalDocumentGatewayProps {
  requiredDocumentTypes: RequiredDocConfig[];
  documents: UploadedDocument[];
  isReadOnly: boolean;
  onDocumentAdded: (doc: UploadedDocument) => void;
  onDocumentRemoved: (docId: number) => void;
}

export function VendorPortalDocumentGateway({
  requiredDocumentTypes,
  documents,
  isReadOnly,
  onDocumentAdded,
  onDocumentRemoved,
}: VendorPortalDocumentGatewayProps) {
  const [selectedType, setSelectedType] = useState<string>(
    requiredDocumentTypes[0]?.type || "Commercial Registration"
  );
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check upload compliance
  const mandatoryMissing = requiredDocumentTypes
    .filter((req) => req.mandatory)
    .filter((req) => !documents.some((d) => d.documentType.toLowerCase().trim() === req.type.toLowerCase().trim()));

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side format check
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      setErrorMessage(`File format .${ext} is blocked for security. Please upload a PDF, JPG, or PNG document.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Size check (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(`File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the maximum 10 MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(15);

      // Step 1: Initiate upload intent
      const initRes = await fetch("/api/vendor-onboarding/documents/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || "Failed to initiate upload");
      }

      setUploadProgress(45);

      // Step 2: Direct-to-R2 upload (Bypassing Vercel 4.5MB payload limit)
      const uploadRes = await fetch(initData.data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Direct storage upload failed. Please verify your connection and retry.");
      }

      setUploadProgress(80);

      // Step 3: Complete & verify intent (magic bytes + size verification)
      const completeRes = await fetch("/api/vendor-onboarding/documents/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: initData.data.intentId,
          expiryDate: expiryDate || null,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || "Upload verification failed");
      }

      setUploadProgress(100);
      setSuccessMessage(`Document "${file.name}" uploaded and verified successfully.`);
      onDocumentAdded(completeData.data);

      // Reset form
      if (fileInputRef.current) fileInputRef.current.value = "";
      setExpiryDate("");
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during document upload.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (docId: number) => {
    if (isReadOnly) return;
    if (!window.confirm("Are you sure you want to remove this uploaded document?")) return;

    try {
      setDeletingId(docId);
      setErrorMessage(null);

      const res = await fetch(`/api/vendor-onboarding/documents/${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove document");
      }

      onDocumentRemoved(docId);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove document.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (docId: number, fileName: string) => {
    try {
      const res = await fetch(`/api/vendor-onboarding/documents/${docId}/preview`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");

      // Trigger download
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(err.message || "Could not download document.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Requirements Checklist */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
          <span>Required Compliance Documents</span>
          <span className="text-xs font-normal text-slate-400">
            {documents.length} of {requiredDocumentTypes.length} types uploaded
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {requiredDocumentTypes.map((req) => {
            const isUploaded = documents.some(
              (d) => d.documentType.toLowerCase().trim() === req.type.toLowerCase().trim()
            );

            return (
              <div
                key={req.type}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                  isUploaded
                    ? "bg-emerald-950/20 border-emerald-800/40 text-slate-200"
                    : req.mandatory
                    ? "bg-slate-800/40 border-amber-800/40 text-slate-300"
                    : "bg-slate-800/20 border-slate-800 text-slate-400"
                }`}
              >
                <div className="mt-0.5">
                  {isUploaded ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : req.mandatory ? (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">{req.type}</span>
                    {req.mandatory ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-400">
                        Optional
                      </span>
                    )}
                  </div>
                  {req.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{req.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Box */}
      {!isReadOnly && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
          <h4 className="text-sm font-semibold text-white mb-4">Upload New Document</h4>

          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Document Type*</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                disabled={isUploading}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
              >
                {requiredDocumentTypes.map((r) => (
                  <option key={r.type} value={r.type}>
                    {r.type} {r.mandatory ? "(Required)" : "(Optional)"}
                  </option>
                ))}
                <option value="Other Certification">Other Certification</option>
                <option value="Bank Authorization Letter">Bank Authorization Letter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Document Expiry Date (if applicable)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={isUploading}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition-colors min-h-[44px]"
              />
            </div>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isUploading
                ? "border-primary/50 bg-primary/5"
                : "border-slate-700 hover:border-primary hover:bg-slate-800/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              disabled={isUploading}
            />

            {isUploading ? (
              <div className="space-y-3 py-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-xs font-medium text-white">Uploading & Verifying Document...</p>
                <div className="w-full max-w-xs mx-auto bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-10 h-10 text-primary mx-auto opacity-80" />
                <p className="text-xs font-semibold text-white">
                  Click to select file or drag and drop
                </p>
                <p className="text-[11px] text-slate-400">
                  Accepted: PDF, JPG, PNG (Max 10 MB). Safe direct-to-cloud upload.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uploaded Documents List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Uploaded Documents ({documents.length})
        </h4>

        {documents.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-white truncate">{doc.documentName}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                        {doc.documentType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      {doc.expiryDate && (
                        <span className="text-amber-400/90 font-mono">
                          Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc.id, doc.documentName)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Download Document"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                      title="Remove Document"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
