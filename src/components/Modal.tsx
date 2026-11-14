import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  showHeader?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  maxWidth?: 'confirmation' | 'form' | 'wide';
  isConfirmation?: boolean;
  isDestructiveActionRunning?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
  containerClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  showHeader = true,
  showCloseButton = true,
  footer,
  maxWidth = 'form',
  isConfirmation = false,
  isDestructiveActionRunning = false,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
  ariaLabel,
  className = '',
  bodyClassName = '',
  containerClassName = ''
}) => {
  const generatedId = useId();
  const titleId = `modal-title-${generatedId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isConfirm = isConfirmation || maxWidth === 'confirmation';

  // Lock page scroll behind the modal while open and restore on close
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Accessibility: Focus management, focus trap, and Escape key
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          // If destructive confirmation, focus Cancel by default to avoid accidental deletion
          const cancelBtn = Array.from(focusables).find((el) => {
            const text = el.textContent?.trim().toLowerCase();
            return text === 'cancel' || el.getAttribute('aria-label')?.toLowerCase() === 'cancel';
          });
          if (cancelBtn) {
            cancelBtn.focus();
          } else {
            focusables[0].focus();
          }
        } else {
          dialogRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isDestructiveActionRunning && closeOnEsc) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === dialogRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, isDestructiveActionRunning, closeOnEsc, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isDestructiveActionRunning && closeOnOverlayClick) {
      onClose();
    }
  };

  // Determine sizing classes
  const widthClasses = isConfirm
    ? 'w-[calc(100%-32px)] sm:w-full max-w-[480px]'
    : maxWidth === 'wide'
    ? 'w-full sm:w-[calc(100%-32px)] sm:max-w-4xl'
    : 'w-full sm:w-[calc(100%-32px)] sm:max-w-[640px]';

  // Responsive container positioning
  // Confirmation is centered in viewport on all screens from 320px to 1440px
  // Forms become bottom sheets on screens below 640px
  const overlayPositionClasses = isConfirm
    ? 'items-center justify-center p-4'
    : 'items-end sm:items-center justify-center p-0 sm:p-4';

  const sheetShapeClasses = isConfirm
    ? 'rounded-2xl sm:rounded-3xl max-h-[calc(100dvh-32px)]'
    : 'rounded-t-3xl sm:rounded-3xl max-h-[90dvh] sm:max-h-[calc(100dvh-32px)]';

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className={`fixed inset-0 z-[100] flex ${overlayPositionClasses} bg-[var(--overlay)] backdrop-blur-sm select-none ${containerClassName}`}
      style={{
        paddingBottom: isConfirm ? 'max(1rem, env(safe-area-inset-bottom, 0px))' : undefined
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex flex-col bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] shadow-2xl focus:outline-none select-text ${widthClasses} ${sheetShapeClasses} ${className}`}
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* Fixed Header */}
        {showHeader && (title || showCloseButton) && (
          <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {icon && (
                <div className="shrink-0 flex items-center justify-center">
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <h3
                    id={titleId}
                    className="text-base sm:text-lg font-bold text-[var(--text)] truncate"
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDestructiveActionRunning}
                  aria-label="Close dialog"
                  className="p-2 -mr-2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)] rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className={`flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 ${bodyClassName}`}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div
            className="shrink-0 px-5 sm:px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] rounded-b-2xl sm:rounded-b-3xl"
            style={{
              paddingBottom: !isConfirm ? 'max(1rem, env(safe-area-inset-bottom, 0px))' : undefined
            }}
          >
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 [&>button]:w-full [&>button]:sm:w-auto [&>button]:min-h-[44px] [&>button]:px-4 [&>button]:py-2.5 [&>button]:rounded-xl [&>button]:font-medium [&>button]:text-sm">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

