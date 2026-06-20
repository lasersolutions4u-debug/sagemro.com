import { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, Image, Video, Trash2, Upload, Loader2, FileText, X } from 'lucide-react';
import {
  getWorkOrderAttachments,
  uploadWorkOrderAttachment,
  deleteWorkOrderAttachment,
} from '../../services/api';
import { toastSuccess, toastError, confirmDialog } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
];
const MAX_SIZE = 50 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type) { return type?.startsWith('image/'); }
function isVideo(type) { return type?.startsWith('video/'); }

export function AttachmentsPanel({ workOrderId, userType, userId, readOnly }) {
  const isCn = isCnLocale();
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadAttachments = useCallback(async () => {
    try {
      const data = await getWorkOrderAttachments(workOrderId);
      setAttachments(data.attachments || []);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toastError(isCn ? `不支持的文件类型：${file.type || '未知'}` : `Unsupported file type: ${file.type || 'unknown'}`);
      return false;
    }
    if (file.size > MAX_SIZE) {
      toastError(isCn ? `文件过大（单个文件最大 50MB）：${file.name}` : `File too large (max 50MB): ${file.name}`);
      return false;
    }
    return true;
  };

  const uploadFiles = async (files) => {
    const validFiles = [...files].filter(validateFile);
    if (validFiles.length === 0) return;

    setUploading(true);
    let done = 0;
    for (const file of validFiles) {
      setUploadProgress({ current: done + 1, total: validFiles.length, name: file.name });
      try {
        await uploadWorkOrderAttachment(workOrderId, file);
        done++;
      } catch (e) {
        toastError(isCn ? `${file.name} 上传失败：${e.message}` : `Failed to upload ${file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    setUploadProgress(null);
    if (done > 0) {
      toastSuccess(isCn ? `已上传 ${done} 个文件` : `${done} file(s) uploaded`);
      loadAttachments();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    uploadFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDelete = async (att) => {
    if (!(await confirmDialog(
      isCn ? `删除附件“${att.file_name}”？此操作不可恢复。` : `Delete attachment "${att.file_name}"? This action cannot be undone.`
    ))) return;
    try {
      await deleteWorkOrderAttachment(workOrderId, att.id);
      toastSuccess(isCn ? '附件已删除' : 'Attachment deleted');
      loadAttachments();
    } catch (e) {
      toastError((isCn ? '删除失败：' : 'Delete failed: ') + e.message);
    }
  };

  const canDelete = (att) => {
    if (readOnly) return false;
    return att.uploader_id === userId || userType === 'admin';
  };

  return (
    <div className="space-y-3">
      {/* 上传区域 */}
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
              : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
              {uploadProgress && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {isCn ? `上传中（${uploadProgress.current}/${uploadProgress.total}）...` : `Uploading (${uploadProgress.current}/${uploadProgress.total})...`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {isCn ? '拖拽文件到这里，或点击选择文件' : 'Drag and drop files here, or click to select'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {isCn ? '支持 JPG/PNG/GIF/WebP/MP4/WebM，单个文件最大 50MB' : 'Supports JPG/PNG/GIF/WebP/MP4/WebM, max 50MB per file'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 附件列表 */}
      {loading ? (
        <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">{isCn ? '加载中...' : 'Loading...'}</div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
          <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {isCn ? '暂无附件' : 'No attachments yet'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]"
            >
              {/* 缩略图 */}
              {isImage(att.file_type) ? (
                <div
                  className="h-32 cursor-pointer"
                  onClick={() => setPreviewFile(att)}
                >
                  <img
                    src={att.r2_url}
                    alt={att.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : isVideo(att.file_type) ? (
                <div className="h-32 flex items-center justify-center bg-black/50 cursor-pointer" onClick={() => setPreviewFile(att)}>
                  <Video className="w-10 h-10 text-white/70" />
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-[var(--color-text-muted)]" />
                </div>
              )}

              {/* 文件名 & 大小 */}
              <div className="p-2">
                <p className="text-xs text-[var(--color-text-primary)] truncate" title={att.file_name}>
                  {att.file_name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatSize(att.file_size)}</p>
              </div>

              {/* 删除按钮 */}
              {canDelete(att) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(att); }}
                  className="absolute top-1 right-1 p-1 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 全屏预览 */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewFile(null)}
        >
          <button
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          {isImage(previewFile.file_type) ? (
            <img
              src={previewFile.r2_url}
              alt={previewFile.file_name}
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : isVideo(previewFile.file_type) ? (
            <video
              src={previewFile.r2_url}
              controls
              className="max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
