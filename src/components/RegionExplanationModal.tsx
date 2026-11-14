import React from 'react';
import { MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';

interface RegionExplanationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const RegionExplanationModal: React.FC<RegionExplanationModalProps> = ({
  isOpen,
  onConfirm,
  isLoading = false
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onConfirm}
      title="Region Availability Check"
      icon={
        <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] border border-[var(--info-border)] flex items-center justify-center text-[var(--info)] shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
      }
      maxWidth="confirmation"
      isConfirmation={true}
      showCloseButton={false}
      closeOnOverlayClick={false}
      footer={
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
        >
          <span>{isLoading ? 'Verifying region...' : 'Continue'}</span>
          {!isLoading && <ArrowRight className="w-4 h-4" />}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          StudyBridge checks your region to apply availability rules. Your exact location is not saved.
        </p>

        <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] text-xs text-[var(--muted)]">
          <ShieldCheck className="w-4 h-4 text-[var(--success)] shrink-0" />
          <span>Point-in-polygon verification is executed locally on your device.</span>
        </div>
      </div>
    </Modal>
  );
};
