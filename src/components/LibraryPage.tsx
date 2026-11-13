import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Trash2, BookOpen, RefreshCw, Copy, Check } from 'lucide-react';
import { SavedResult, Subject, Material } from '../types';
import { deleteResultFirestore } from '../services/firestoreService';
import { auth } from '../services/firebaseService';

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
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
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
      <h2 className="text-2xl font-bold tracking-tight">Library</h2>
      
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'summarize', 'explain'].map(t => (
          <button key={t} onClick={() => setFilterType(t as any)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {t === 'summarize' ? 'Summary' : t === 'explain' ? 'Explanation' : t}
          </button>
        ))}
        <select onChange={e => setFilterSubject(e.target.value)} className="bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 text-xs">
          <option value="all">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredResults.map(r => (
          <div key={r.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate">{r.title}</h4>
              <p className="text-xs text-slate-500 truncate">{r.content.substring(0, 100)}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => navigate(`/results/${r.id}`)} className="text-blue-600 text-xs font-medium">Open</button>
              <button onClick={() => handleDelete(r.id)} className="text-rose-600 text-xs font-medium">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
