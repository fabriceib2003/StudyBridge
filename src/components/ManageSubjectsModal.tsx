import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Trash2,
  Lock,
  Edit2,
  Check,
  AlertTriangle,
  Palette,
  Plus,
  X
} from 'lucide-react';
import { Subject, Material } from '../types';
import { Modal } from './Modal';
import { useActiveSubject } from '../contexts/SubjectContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../services/firebaseService';
import { getPreferences, updatePreferences } from '../services/firestoreService';
import {
  SUBJECT_COLOR_PRESETS,
  DEFAULT_SUBJECT_COLOR,
  getSubjectColorTheme,
  normalizeHexColor,
  isValidHexColor,
  isPresetSubjectColor,
  resolveSubjectHex
} from '../utils/subjectColors';

interface ManageSubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  materials: Material[];
  onAddSubject: (subject: Omit<Subject, 'id'>) => Promise<any>;
  onUpdateSubject: (id: string, updates: Partial<Subject>) => Promise<any>;
  onDeleteSubjectWithOptions: (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => Promise<any>;
  isDeviceAiAvailable?: boolean;
}

const MAX_RECENT_CUSTOM_COLORS = 5;

function getRecentColorsStorageKey(uid?: string): string {
  return `studybridge_recent_custom_colors_${uid || 'guest'}`;
}

function sanitizeRecentColors(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeHexColor(item);
    if (!normalized || isPresetSubjectColor(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_RECENT_CUSTOM_COLORS) break;
  }
  return out;
}

interface SubjectColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  subjectName: string;
  recentColors: string[];
  isDark: boolean;
  isCustomOpen: boolean;
  onToggleCustom: (open: boolean) => void;
  hasInvalidDraft?: boolean;
  onInvalidDraftChange?: (hasInvalid: boolean) => void;
  compact?: boolean;
}

const SubjectColorPicker: React.FC<SubjectColorPickerProps> = ({
  value,
  onChange,
  subjectName,
  recentColors,
  isDark,
  isCustomOpen,
  onToggleCustom,
  onInvalidDraftChange,
  compact = false
}) => {
  const resolvedHex = resolveSubjectHex(value);
  const [hexDraft, setHexDraft] = useState(resolvedHex);
  const [hexError, setHexError] = useState<string | null>(null);

  useEffect(() => {
    setHexDraft(resolvedHex);
    setHexError(null);
    onInvalidDraftChange?.(false);
  }, [resolvedHex]);

  const isCustomSelected = !isPresetSubjectColor(resolvedHex);
  const isSelectedInRecent = isCustomSelected && recentColors.includes(resolvedHex);
  const previewTheme = getSubjectColorTheme(resolvedHex, isDark);
  const swatchSize = compact ? 'w-6 h-6 min-h-[24px] min-w-[24px]' : 'w-7 h-7 min-h-[28px] min-w-[28px]';
  const showActiveCustomSwatch = isCustomSelected && !isSelectedInRecent;

  const handleSelectHex = (hex: string) => {
    const normalized = normalizeHexColor(hex) || DEFAULT_SUBJECT_COLOR;
    setHexDraft(normalized);
    setHexError(null);
    onInvalidDraftChange?.(false);
    onChange(normalized);
  };

  const handleHexTextChange = (raw: string) => {
    const formatted = raw.startsWith('#') ? raw : raw ? `#${raw}` : '';
    setHexDraft(formatted);

    if (isValidHexColor(formatted)) {
      const normalized = normalizeHexColor(formatted)!;
      setHexError(null);
      onInvalidDraftChange?.(false);
      onChange(normalized);
    } else {
      setHexError('Enter a valid #RRGGBB hex color');
      onInvalidDraftChange?.(true);
    }
  };

  const handleHexTextBlur = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (normalized) {
      setHexDraft(normalized);
      setHexError(null);
      onInvalidDraftChange?.(false);
      onChange(normalized);
    } else {
      // Reject invalid value and fall back to palette default
      setHexDraft(DEFAULT_SUBJECT_COLOR);
      setHexError(null);
      onInvalidDraftChange?.(false);
      onChange(DEFAULT_SUBJECT_COLOR);
    }
  };

  return (
    <div className="space-y-2.5 w-full min-w-0">
      {/* Swatches Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)] shrink-0 mr-0.5">
          <Palette className="w-3.5 h-3.5 shrink-0" />
          Color:
        </span>

        {/* 6 Preset Swatches */}
        {SUBJECT_COLOR_PRESETS.map((preset) => {
          const isSelected = resolvedHex === preset.hex;
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => handleSelectHex(preset.hex)}
              className={`${swatchSize} rounded-full transition-transform cursor-pointer shrink-0 ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)] scale-110'
                  : 'opacity-85 hover:opacity-100 hover:scale-105'
              }`}
              style={{ backgroundColor: preset.hex }}
              title={preset.name}
              aria-label={`Select ${preset.name} color`}
              aria-pressed={isSelected}
            />
          );
        })}

        {/* 7th Custom Swatch (Rainbow + Plus) */}
        <button
          type="button"
          onClick={() => onToggleCustom(!isCustomOpen)}
          className={`${swatchSize} rounded-full flex items-center justify-center text-white shadow-xs transition-transform cursor-pointer shrink-0 border border-[var(--border-strong)] ${
            isCustomOpen || isCustomSelected
              ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)] scale-105'
              : 'opacity-90 hover:opacity-100 hover:scale-105'
          }`}
          style={{
            background:
              'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
          }}
          title="Custom color"
          aria-label="Choose custom color"
          aria-expanded={isCustomOpen}
        >
          <Plus className="w-3.5 h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] stroke-[2.75]" />
        </button>

        {/* Active custom color swatch (ringed) when not already in recents */}
        {showActiveCustomSwatch && (
          <button
            type="button"
            onClick={() => onToggleCustom(true)}
            className={`${swatchSize} rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)] scale-105 border border-[var(--border-strong)] shrink-0 cursor-pointer`}
            style={{ backgroundColor: resolvedHex }}
            title={`Selected custom color (${resolvedHex})`}
            aria-label={`Selected custom color ${resolvedHex}`}
          />
        )}

        {/* Up to 5 Recent Custom Color Swatches */}
        {recentColors.length > 0 && (
          <div className="flex items-center gap-1.5 pl-1 border-l border-[var(--border)] flex-wrap" aria-label="Recent custom colors">
            {recentColors.map((recentHex) => {
              const isSelected = resolvedHex === recentHex;
              return (
                <button
                  key={recentHex}
                  type="button"
                  onClick={() => handleSelectHex(recentHex)}
                  className={`w-5 h-5 min-w-[20px] min-h-[20px] rounded-full border border-[var(--border-strong)] transition-transform cursor-pointer shrink-0 ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)] scale-110'
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: recentHex }}
                  title={`Recent custom color ${recentHex}`}
                  aria-label={`Select recent custom color ${recentHex}`}
                  aria-pressed={isSelected}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Color Picker Popover / Inline Panel */}
      {isCustomOpen && (
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer shrink-0">
              <span className="font-medium">Picker:</span>
              <input
                type="color"
                value={resolvedHex}
                onChange={(e) => handleSelectHex(e.target.value)}
                aria-label="Native color picker"
                className="w-9 h-8 p-0.5 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] cursor-pointer"
              />
            </label>

            <div className="flex items-center gap-1.5 flex-1 min-w-[130px] max-w-[170px]">
              <label className="sr-only">Hex color</label>
              <input
                type="text"
                value={hexDraft}
                onChange={(e) => handleHexTextChange(e.target.value)}
                onBlur={handleHexTextBlur}
                placeholder="#2563eb"
                maxLength={7}
                aria-label="Hex color code"
                className={`w-full bg-[var(--input-bg)] border rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--text)] focus:outline-none ${
                  hexError
                    ? 'border-[var(--danger)] focus:border-[var(--danger)]'
                    : 'border-[var(--input-border)] focus:border-[var(--primary)]'
                }`}
              />
            </div>

            {/* Live Preview Chip */}
            <div className="flex items-center gap-1.5 min-w-0 max-w-full">
              <span className="text-[11px] text-[var(--muted)] shrink-0">Preview:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold max-w-[180px] min-w-0"
                style={previewTheme.badgeStyle}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={previewTheme.dotStyle} />
                <span className="truncate">{subjectName.trim() || 'Subject Preview'}</span>
              </span>
            </div>
          </div>

          {hexError && (
            <p className="text-[11px] text-[var(--danger)] font-medium">
              {hexError}
            </p>
          )}
        </div>
      )}

      {/* Live preview chip when a custom color is selected even if panel is collapsed */}
      {!isCustomOpen && isCustomSelected && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[var(--muted)]">Preview:</span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold max-w-[200px] min-w-0"
            style={previewTheme.badgeStyle}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={previewTheme.dotStyle} />
            <span className="truncate">{subjectName.trim() || 'Subject Preview'}</span>
          </span>
          <span className="text-[11px] font-mono text-[var(--muted)]">{resolvedHex}</span>
        </div>
      )}

      {/* Hard-to-see warning against active page/card background */}
      {previewTheme.hardToSee && (
        <p className="text-[11px] text-[var(--warning)] flex items-center gap-1 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>This color may be hard to see</span>
        </p>
      )}
    </div>
  );
};

export const ManageSubjectsModal: React.FC<ManageSubjectsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  materials,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubjectWithOptions,
  isDeviceAiAvailable = false
}) => {
  const { setActiveSubjectId, handleSubjectDeleted } = useActiveSubject();
  const { isDark } = useTheme();
  const uid = auth.currentUser?.uid;

  // Recent custom colors (max 5 per user, saved in user preferences)
  const [recentCustomColors, setRecentCustomColors] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(getRecentColorsStorageKey(uid));
      return cached ? sanitizeRecentColors(JSON.parse(cached)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    try {
      const cached = localStorage.getItem(getRecentColorsStorageKey(uid));
      if (cached) {
        setRecentCustomColors(sanitizeRecentColors(JSON.parse(cached)));
      }
    } catch {
      // ignore local cache parse error
    }

    if (uid) {
      getPreferences(uid).then((prefs: any) => {
        if (!active) return;
        const fromPrefs = sanitizeRecentColors(prefs?.recentCustomColors);
        if (fromPrefs.length > 0) {
          setRecentCustomColors(fromPrefs);
          try {
            localStorage.setItem(getRecentColorsStorageKey(uid), JSON.stringify(fromPrefs));
          } catch {
            // ignore storage quota errors
          }
        }
      });
    }

    return () => {
      active = false;
    };
  }, [isOpen, uid]);

  const recordRecentCustomColor = async (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized || isPresetSubjectColor(normalized)) return;

    const next = [normalized, ...recentCustomColors.filter((c) => c !== normalized)].slice(
      0,
      MAX_RECENT_CUSTOM_COLORS
    );
    setRecentCustomColors(next);
    try {
      localStorage.setItem(getRecentColorsStorageKey(uid), JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
    if (uid) {
      await updatePreferences(uid, { recentCustomColors: next });
    }
  };

  // New Subject State
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_SUBJECT_COLOR);
  const [isNewCustomOpen, setIsNewCustomOpen] = useState(false);
  const [newColorInvalidDraft, setNewColorInvalidDraft] = useState(false);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [newSwitchToIt, setNewSwitchToIt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>(DEFAULT_SUBJECT_COLOR);
  const [isEditCustomOpen, setIsEditCustomOpen] = useState(false);
  const [editColorInvalidDraft, setEditColorInvalidDraft] = useState(false);
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  // Delete State
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete-materials' | 'move'>('delete-materials');
  const [targetSubjectId, setTargetSubjectId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const validHex = newColorInvalidDraft
        ? DEFAULT_SUBJECT_COLOR
        : normalizeHexColor(newColor) || DEFAULT_SUBJECT_COLOR;

      const created = await onAddSubject({
        name: newName.trim(),
        color: validHex,
        icon: 'BookOpen',
        isPrivate: newIsPrivate
      });

      await recordRecentCustomColor(validHex);

      if (newSwitchToIt && created?.id) {
        setActiveSubjectId(created.id, true);
      }
      setNewName('');
      setNewColor(DEFAULT_SUBJECT_COLOR);
      setIsNewCustomOpen(false);
      setNewColorInvalidDraft(false);
      setNewIsPrivate(false);
      setNewSwitchToIt(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (sub: Subject) => {
    const resolved = resolveSubjectHex(sub.color);
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditColor(resolved);
    setIsEditCustomOpen(!isPresetSubjectColor(resolved));
    setEditColorInvalidDraft(false);
    setEditIsPrivate(!!sub.isPrivate);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const validHex = editColorInvalidDraft
        ? DEFAULT_SUBJECT_COLOR
        : normalizeHexColor(editColor) || DEFAULT_SUBJECT_COLOR;

      await onUpdateSubject(id, {
        name: editName.trim(),
        color: validHex,
        isPrivate: editIsPrivate
      });

      await recordRecentCustomColor(validHex);
      setEditingId(null);
      setIsEditCustomOpen(false);
      setEditColorInvalidDraft(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    setIsDeleting(true);
    try {
      const remaining = subjects.filter((s) => s.id !== subjectToDelete.id);
      handleSubjectDeleted(subjectToDelete.id, remaining);
      await onDeleteSubjectWithOptions(
        subjectToDelete.id,
        deleteAction,
        deleteAction === 'move' ? targetSubjectId : undefined
      );
      setSubjectToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const otherSubjects = subjects.filter((s) => s.id !== subjectToDelete?.id);
  const materialsInSubject = subjectToDelete
    ? materials.filter((m) => m.subjectId === subjectToDelete.id).length
    : 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Subjects"
        subtitle="Organize your subjects, privacy settings, and study materials"
        icon={
          <div className="w-9 h-9 rounded-xl bg-[var(--info-bg)] text-[var(--info)] flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
        }
        maxWidth="form"
        bodyClassName="space-y-6"
      >
        {/* Create New Subject Card — responsive from 320px to 1440px */}
        <form
          onSubmit={handleCreate}
          className="bg-[var(--surface-raised)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] space-y-3"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
            Create New Subject
          </span>

          {/* Row 1: Name input + Add button on one row */}
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Cognitive Psychology, Organic Chemistry"
              className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 sm:px-3.5 py-2.5 text-base sm:text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newName.trim()}
              className="px-3 sm:px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--primary-text)] rounded-xl text-xs sm:text-sm font-medium shadow shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Subject</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {/* Row 2: Color swatches wrapping cleanly on their own row */}
          <SubjectColorPicker
            value={newColor}
            onChange={setNewColor}
            subjectName={newName}
            recentColors={recentCustomColors}
            isDark={isDark}
            isCustomOpen={isNewCustomOpen}
            onToggleCustom={setIsNewCustomOpen}
            onInvalidDraftChange={setNewColorInvalidDraft}
          />

          {/* Row 3: Switch to it and Private options below */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-0.5">
            <label
              className="inline-flex items-center gap-2 text-xs select-none py-1.5 cursor-pointer"
              title="Switch active subject to this new subject"
            >
              <input
                type="checkbox"
                checked={newSwitchToIt}
                onChange={(e) => setNewSwitchToIt(e.target.checked)}
                className="rounded accent-[var(--primary)] w-4 h-4 cursor-pointer shrink-0"
              />
              <span className="text-[var(--text-secondary)] font-medium text-xs whitespace-nowrap">
                Switch to it
              </span>
            </label>

            <label
              className={`inline-flex items-center gap-2 text-xs select-none py-1.5 ${
                !isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={
                !isDeviceAiAvailable
                  ? 'Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer.'
                  : 'Keep this subject private (runs only on-device)'
              }
            >
              <input
                type="checkbox"
                disabled={!isDeviceAiAvailable}
                checked={newIsPrivate}
                onChange={(e) => setNewIsPrivate(e.target.checked)}
                className="rounded accent-[var(--primary)] w-4 h-4 disabled:cursor-not-allowed shrink-0"
              />
              <span className="flex items-center gap-1 text-[var(--text-secondary)] font-medium text-xs">
                <Lock className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                <span>Private (On-Device Only) {!isDeviceAiAvailable && '(Unavailable)'}</span>
              </span>
            </label>
          </div>
        </form>

        {/* Existing Subjects List */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] block">
            Existing Subjects ({subjects.length})
          </span>

          {subjects.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted)]">
              No subjects yet. Create one above to get started.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)]">
              {subjects.map((sub) => {
                const matCount = materials.filter((m) => m.subjectId === sub.id).length;
                const isEditing = editingId === sub.id;
                const subTheme = getSubjectColorTheme(sub, isDark);

                if (isEditing) {
                  return (
                    <div key={sub.id} className="p-3.5 sm:p-4 bg-[var(--primary-soft-bg)] space-y-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-base sm:text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] min-h-[44px]"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(sub.id)}
                            className="p-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            title="Save changes"
                            aria-label="Save changes"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setIsEditCustomOpen(false);
                              setEditColorInvalidDraft(false);
                            }}
                            className="p-2.5 text-[var(--muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--hover)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            title="Cancel"
                            aria-label="Cancel editing"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Same Color Control (Presets + Custom + Native Picker + Hex + Preview + Recent) */}
                      <SubjectColorPicker
                        value={editColor}
                        onChange={setEditColor}
                        subjectName={editName || sub.name}
                        recentColors={recentCustomColors}
                        isDark={isDark}
                        isCustomOpen={isEditCustomOpen}
                        onToggleCustom={setIsEditCustomOpen}
                        onInvalidDraftChange={setEditColorInvalidDraft}
                        compact
                      />

                      {/* Private toggle */}
                      <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                        <label
                          className={`inline-flex items-center gap-2 text-xs select-none py-1.5 ${
                            !isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title={
                            !isDeviceAiAvailable
                              ? 'Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer.'
                              : 'Keep this subject private'
                          }
                        >
                          <input
                            type="checkbox"
                            disabled={!isDeviceAiAvailable}
                            checked={editIsPrivate}
                            onChange={(e) => setEditIsPrivate(e.target.checked)}
                            className="rounded accent-[var(--primary)] w-4 h-4 disabled:cursor-not-allowed shrink-0"
                          />
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                            <Lock className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                            <span>Private {!isDeviceAiAvailable && '(Unavailable)'}</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={subTheme.dotStyle}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text)] truncate">
                            {sub.name}
                          </span>
                          {sub.isPrivate && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)] px-1.5 py-0.5 rounded-full shrink-0">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--muted)] block truncate">
                          {matCount} material{matCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sub)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--hover-strong)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        title="Rename / Edit"
                        aria-label={`Edit ${sub.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectToDelete(sub);
                          setDeleteAction('delete-materials');
                          const nextOther = subjects.find((s) => s.id !== sub.id);
                          setTargetSubjectId(nextOther ? nextOther.id : '');
                        }}
                        className="p-2 text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        title="Delete subject"
                        aria-label={`Delete ${sub.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Nested Delete Subject Confirmation Modal */}
      {subjectToDelete && (
        <Modal
          isOpen={Boolean(subjectToDelete)}
          onClose={() => !isDeleting && setSubjectToDelete(null)}
          title={`Delete Subject: "${subjectToDelete.name}"?`}
          subtitle={`This subject contains ${materialsInSubject} study material${materialsInSubject === 1 ? '' : 's'}. Choose what should happen to them:`}
          icon={
            <div className="w-9 h-9 rounded-xl bg-[var(--danger-bg)] text-[var(--danger)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          }
          maxWidth="confirmation"
          isConfirmation={true}
          isDestructiveActionRunning={isDeleting}
          closeOnOverlayClick={!isDeleting}
          closeOnEsc={!isDeleting}
          showCloseButton={!isDeleting}
          footer={
            <>
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                disabled={isDeleting}
                className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || (deleteAction === 'move' && !targetSubjectId)}
                className="bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] disabled:opacity-50 text-[var(--primary-text)] font-semibold shadow transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </>
          }
        >
          <div className="space-y-3 pt-1 text-xs sm:text-sm">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                deleteAction === 'delete-materials'
                  ? 'border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              <input
                type="radio"
                name="deleteChoice"
                checked={deleteAction === 'delete-materials'}
                onChange={() => setDeleteAction('delete-materials')}
                className="mt-1 accent-[var(--danger-solid)] w-4 h-4"
              />
              <div>
                <span className="font-semibold block text-sm">Delete its materials</span>
                <span className="text-xs opacity-80">
                  Permanently remove all {materialsInSubject} materials in this subject
                </span>
              </div>
            </label>

            {otherSubjects.length > 0 && (
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  deleteAction === 'move'
                    ? 'border-[var(--primary)] bg-[var(--primary-soft-bg)] text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)]'
                }`}
              >
                <input
                  type="radio"
                  name="deleteChoice"
                  checked={deleteAction === 'move'}
                  onChange={() => setDeleteAction('move')}
                  className="mt-1 accent-[var(--primary)] w-4 h-4"
                />
                <div className="w-full min-w-0">
                  <span className="font-semibold block text-sm">Move them to another subject</span>
                  <span className="text-xs opacity-80 block mb-2.5">
                    Reassign materials before deleting this subject
                  </span>

                  {deleteAction === 'move' && (
                    <select
                      value={targetSubjectId}
                      onChange={(e) => setTargetSubjectId(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-2.5 text-base sm:text-sm text-[var(--text)] font-medium min-h-[44px]"
                    >
                      {otherSubjects.map((os) => (
                        <option key={os.id} value={os.id}>
                          Move to: {os.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
