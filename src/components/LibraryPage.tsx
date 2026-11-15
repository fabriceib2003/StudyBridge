import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Trash2, BookOpen, RefreshCw, Copy, Check } from 'lucide-react';
import { SavedResult, Subject, Material } from '../types';
import { deleteResultFirestore } from '../services/firestoreService';
import { auth } from '../services/firebaseService';
import { computeTitle, computePreview, getDisplayTitle } from '../utils/resultUtils';

interface LibraryPageProps {
  subjects: Subject[];
  materials: Material[];
  savedResults: SavedResult[];
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ subjects, materials, savedResults }) => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'summarize' | 'explain'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResults = savedResults.filter(r => {
    const isSum = r.type === 'summarize' || r.type === 'summary';
    const isExp = r.type === 'explain' || r.type === 'explanation';
    const matchesType = filterType === 'all' 
      ? true 
      : filterType === 'summarize' 
      ? isSum 
      : isExp;
    const matchesSubject = filterSubject === 'all' || r.subjectId === filterSubject;
    const titleVal = getDisplayTitle(r, savedResults);
    const previewVal = computePreview(r);
    const matchesSearch = titleVal.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          previewVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSubject && matchesSearch;
  });


  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    if (confirm("Delete this result?")) {
      await deleteResultFirestore(auth.currentUser.uid, id);
    }
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Library</h2>
      
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'summarize', 'explain'].map(t => (
          <button key={t} onClick={() => setFilterType(t as any)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${filterType === t ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border)]'}`}>
            {t === 'summarize' ? 'Summary' : t === 'explain' ? 'Explanation' : t}
          </button>
        ))}
        <select onChange={e => setFilterSubject(e.target.value)} className="bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] rounded-full px-3 py-1 text-xs">
          <option value="all">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredResults.map(r => {
          const displayTitle = getDisplayTitle(r, savedResults);
          const displayPreview = computePreview(r);
          return (
            <div key={r.id} className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--text)] truncate">{displayTitle}</h4>
                <p className="text-xs text-[var(--muted)] line-clamp-2">{displayPreview}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => navigate(`/results/${r.id}`)} className="text-[var(--primary-accent)] text-xs font-medium">Open</button>
                <button onClick={() => handleDelete(r.id)} className="text-[var(--danger)] text-xs font-medium">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
