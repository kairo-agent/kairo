'use client';

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTranslations } from 'next-intl';

// ============================================
// Types
// ============================================

export interface ChatAttachment {
  type: 'image' | 'video' | 'file';
  file: File;
  name: string;
}

interface ChatInputProps {
  onSendMessage: (message: string, attachment?: ChatAttachment | null) => void;
  onEmojiClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isSending?: boolean;
}

export interface ChatInputRef {
  insertEmoji: (emoji: string) => void;
}

// ============================================
// Icons (Inline SVG)
// ============================================

const EmojiIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const ImageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const VideoIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const FileIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SendingDotsIcon = () => (
  <div className="flex items-center justify-center gap-1">
    <span
      className="w-1.5 h-1.5 rounded-full animate-wave-bounce"
      style={{
        backgroundColor: 'currentColor',
        animationDelay: '0ms',
      }}
    />
    <span
      className="w-1.5 h-1.5 rounded-full animate-wave-bounce"
      style={{
        backgroundColor: 'currentColor',
        animationDelay: '150ms',
      }}
    />
    <span
      className="w-1.5 h-1.5 rounded-full animate-wave-bounce"
      style={{
        backgroundColor: 'currentColor',
        animationDelay: '300ms',
      }}
    />
  </div>
);

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================
// Tooltip Component (CSS-only, modern style)
// ============================================

interface TooltipButtonProps {
  children: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const TooltipButton = ({
  children,
  tooltip,
  onClick,
  disabled = false,
  ariaLabel,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: TooltipButtonProps) => (
  <div className="group relative inline-flex">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={ariaLabel}
    >
      {children}
    </button>
    <div
      className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid var(--border-primary)',
      }}
    >
      {tooltip}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 -mt-px"
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid var(--border-primary)',
        }}
      />
    </div>
  </div>
);

// ============================================
// Helper functions
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type: ChatAttachment['type']): React.ReactNode {
  switch (type) {
    case 'image':
      return <ImageIcon />;
    case 'video':
      return <VideoIcon />;
    case 'file':
    default:
      return <FileIcon />;
  }
}

function getMaxSizeForType(type: ChatAttachment['type']): number {
  switch (type) {
    case 'image':
      return 3; // 3MB
    case 'video':
    case 'file':
    default:
      return 16; // 16MB
  }
}

// ============================================
// ChatInput Component
// ============================================

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
  { onSendMessage, onEmojiClick, disabled = false, placeholder, isSending = false },
  ref
) {
  const t = useTranslations('leads.chat');

  // State
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose insertEmoji method via ref
  useImperativeHandle(ref, () => ({
    insertEmoji: (emoji: string) => {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newMessage = message.slice(0, start) + emoji + message.slice(end);
        setMessage(newMessage);
        // Set cursor position after emoji
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
        }, 0);
      } else {
        setMessage((prev) => prev + emoji);
      }
    },
  }));
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 24; // approx line height in pixels
      const minHeight = lineHeight * 3; // 3 lines
      const maxHeight = lineHeight * 8; // 8 lines
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Handlers
  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !attachment) return;
    if (disabled) return;

    onSendMessage(trimmedMessage, attachment);
    setMessage('');
    setAttachment(null);
    setImagePreview(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'file'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous image preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }

    const newAttachment: ChatAttachment = {
      type,
      file,
      name: file.name,
    };

    // Generate preview for images
    if (type === 'image') {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }

    setAttachment(newAttachment);

    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    setAttachment(null);
  };

  const hasContent = message.trim().length > 0 || attachment !== null;

  return (
    <div
      className="relative flex flex-col rounded-xl border transition-colors"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Attachment Preview */}
      {attachment && (
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {/* Image Preview Thumbnail */}
          {attachment.type === 'image' && imagePreview && (
            <div
              className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <img
                src={imagePreview}
                alt={attachment.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* File/Video/Link Icon */}
          {(attachment.type !== 'image' || !imagePreview) && (
            <div
              className="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0"
              style={{
                backgroundColor: 'var(--accent-primary-light)',
                color: 'var(--accent-primary)',
              }}
            >
              {getFileIcon(attachment.type)}
            </div>
          )}

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {attachment.name}
            </p>
            {attachment.file && (
              <p
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {formatFileSize(attachment.file.size)} / {getMaxSizeForType(attachment.type)} MB {t('maxSize')}
              </p>
            )}
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={handleRemoveAttachment}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
            aria-label={t('removeAttachment')}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Textarea */}
      <div className="px-4 pt-3 pb-1">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('placeholder')}
          disabled={disabled}
          className="w-full resize-none bg-transparent outline-none text-sm leading-6"
          style={{
            color: 'var(--text-primary)',
            minHeight: '72px', // 3 lines
            maxHeight: '192px', // 8 lines
            overflowY: 'auto',
            overflowX: 'hidden',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            boxSizing: 'border-box',
          }}
          rows={3}
        />
      </div>

      {/* Bottom Bar: Attachments + Send */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {/* Attachment Buttons */}
        <div className="flex items-center gap-1">
          {/* Emoji Button */}
          <button
            type="button"
            onClick={onEmojiClick}
            disabled={disabled}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={t('emoji')}
            aria-label={t('emoji')}
          >
            <EmojiIcon />
          </button>

          {/* Image Button */}
          <TooltipButton
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || attachment !== null}
            tooltip={`${t('attachImage')} (${t('max')} 3MB)`}
            ariaLabel={t('attachImage')}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !attachment) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ImageIcon />
          </TooltipButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e, 'image')}
            className="hidden"
          />

          {/* Video Button */}
          <TooltipButton
            onClick={() => videoInputRef.current?.click()}
            disabled={disabled || attachment !== null}
            tooltip={`${t('attachVideo')} (${t('max')} 16MB)`}
            ariaLabel={t('attachVideo')}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !attachment) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <VideoIcon />
          </TooltipButton>
          {/* WhatsApp only supports MP4 (H.264 + AAC) - WebM is NOT supported */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4"
            onChange={(e) => handleFileSelect(e, 'video')}
            className="hidden"
          />

          {/* File/Document Button */}
          <TooltipButton
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attachment !== null}
            tooltip={`${t('attachFile')} (${t('max')} 16MB)`}
            ariaLabel={t('attachFile')}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !attachment) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FileIcon />
          </TooltipButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => handleFileSelect(e, 'file')}
            className="hidden"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !hasContent || isSending}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all disabled:opacity-50"
          style={{
            backgroundColor: hasContent || isSending
              ? 'var(--accent-primary)'
              : 'var(--bg-tertiary)',
            color: hasContent || isSending
              ? 'var(--kairo-midnight)'
              : 'var(--text-tertiary)',
          }}
          aria-label={isSending ? t('sending') : t('send')}
        >
          {isSending ? <SendingDotsIcon /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
