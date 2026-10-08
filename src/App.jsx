import React, { useState, useEffect, useMemo } from 'react';

import { 
  CheckCircle2, Circle, Trash2, Plus, Clock, Settings, RefreshCw, 
  AlertCircle, Sparkles, Server, Check, X, Search, Edit2, 
  ArrowUpDown, LogOut, User as UserIcon, Lock, Mail, ArrowRight,
  Sun, Moon
} from 'lucide-react';


const getInitialApiUrl = () => {
  // Check for Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback for Create React App or Node environments
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Default fallback for local development
  return 'http://localhost:5000';
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('taskflow_theme') || 'dark');

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('taskflow_token') || null);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('taskflow_user') || null);
  const [isAuthMode, setIsAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Todo State
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [filter, setFilter] = useState('all'); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Settings & Network State
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingApiUrl, setPendingApiUrl] = useState(getInitialApiUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('taskflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    const endpoint = isAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setCurrentUser(data.email);
      localStorage.setItem('taskflow_token', data.token);
      localStorage.setItem('taskflow_user', data.email);
      setAuthPassword('');
      setAuthEmail('');
      setIsConnected(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setTodos([]);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  };

  const fetchTodos = async (targetUrl = apiUrl) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTodos(data);
      setIsConnected(true);
    } catch (err) {
      console.warn('Backend issue:', err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTodos(apiUrl);
  }, [apiUrl, token]);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    const trimmed = newTodoText.trim();
    if (!trimmed) return;

    const tempId = `local-${Date.now()}`;
    const newTodo = { _id: tempId, text: trimmed, completed: false, createdAt: new Date().toISOString() };
    setTodos((prev) => [newTodo, ...prev]);
    setNewTodoText('');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to create on server');
      
      const savedTodo = await response.json();
      setTodos((prev) => prev.map((t) => (t._id === tempId ? savedTodo : t)));
    } catch (err) {
      console.error('Error saving todo:', err);
      // Remove temp item on failure
      setTodos((prev) => prev.filter((t) => t._id !== tempId));
    }
  };

  const handleToggleTodo = async (todo) => {
    const updatedStatus = !todo.completed;
    setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: updatedStatus } : t)));

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${todo._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ completed: updatedStatus }),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: todo.completed } : t)));
    }
  };

  const handleStartEdit = (todo) => {
    setEditingId(todo._id);
    setEditingText(todo.text);
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    const previousTodos = [...todos];
    setTodos((prev) => prev.map((t) => t._id === id ? { ...t, text: trimmed, updatedAt: new Date().toISOString() } : t));
    setEditingId(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });
      if (response.status === 401) handleLogout();
      if (!response.ok) throw new Error('Update failed');
    } catch (err) {
      setTodos(previousTodos);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const targetId = deleteCandidate._id;
    setTodos((prev) => prev.filter((t) => t._id !== targetId));
    setDeleteCandidate(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${targetId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const formatDateTime = (isoDate) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  const filteredTodos = useMemo(() => {
    const result = todos.filter((todo) => {
      const matchesFilter = filter === 'all' ? true : filter === 'active' ? !todo.completed : todo.completed;
      const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sortBy === 'az') return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'za') return b.text.localeCompare(a.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'status') return Number(a.completed) - Number(b.completed);
      return 0;
    });
  }, [todos, filter, searchQuery, sortBy]);

  if (!token) {
    return (
      <div data-theme={theme} className="app-shell min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
        
        <div className="absolute top-6 right-6 flex gap-2">
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="API Configuration"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-white mb-2">
            TaskFlow
          </h1>
          <p className="text-center text-slate-400 text-sm mb-2">
            {isAuthMode === 'login' ? 'Sign in to sync your tasks securely.' : 'Create an account to get started.'}
          </p>
          <p className="text-center text-indigo-400 text-[10px] tracking-[0.2em] uppercase mb-7">Cosmic Cliffs · Carina Nebula</p>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/70"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/70"
              />
            </div>
            <button
              type="submit"
              disabled={isAuthLoading}
              className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthLoading ? 'Please wait...' : (isAuthMode === 'login' ? 'Sign In' : 'Create Account')}
              {!isAuthLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">
              {isAuthMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              onClick={() => setIsAuthMode(isAuthMode === 'login' ? 'register' : 'login')}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              {isAuthMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>

        {/* Re-use Settings Modal Logic */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" /> API Environment Settings
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-300">Backend URL</label>
                <input
                  type="text"
                  value={pendingApiUrl}
                  onChange={(e) => setPendingApiUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800">Cancel</button>
                <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-theme={theme} className="app-shell min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">TaskFlow</h1>
                <p className="text-xs text-slate-400">COSMIC CLIFFS · CARINA NEBULA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => fetchTodos(apiUrl)} title="Refresh" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} title="Settings" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-lg border bg-slate-900/60 backdrop-blur border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-300">
              <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Signed in as <strong className="font-medium">{currentUser}</strong></span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <form onSubmit={handleAddTodo} className="relative group">
          <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl shadow-black/40 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="What needs to be done today?..."
              className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
            />
            <button type="submit" disabled={!newTodoText.trim()} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-indigo-600/30 transition disabled:opacity-40 active:scale-95">
              <Plus className="w-4 h-4" /> <span>Add</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            {['all', 'active', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg transition font-medium capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none cursor-pointer">
                <option value="newest" className="bg-slate-900">Newest first</option>
                <option value="oldest" className="bg-slate-900">Oldest first</option>
                <option value="az" className="bg-slate-900">A &rarr; Z</option>
                <option value="za" className="bg-slate-900">Z &rarr; A</option>
                <option value="status" className="bg-slate-900">Pending first</option>
              </select>
            </div>
            <div className="relative flex-1 max-w-[210px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/30 text-center">
              <CheckCircle2 className="w-7 h-7 text-slate-500 mb-3" />
              <h3 className="text-sm font-medium text-slate-300">No tasks found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Nothing to see here right now.</p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const formattedDate = formatDateTime(todo.createdAt || todo.timestamp);
              const isEditing = editingId === todo._id;

              return (
                <div key={todo._id} className={`group flex items-start gap-3 p-3.5 rounded-xl border transition-all ${todo.completed ? 'bg-slate-900/40 border-slate-800/50' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button onClick={() => handleToggleTodo(todo)} disabled={isEditing} className="mt-0.5 text-slate-500 hover:text-indigo-400">
                      {todo.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div className="flex flex-col gap-1 flex-1">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text" autoFocus value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(todo._id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-slate-950 border border-indigo-500/70 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <p onDoubleClick={() => !todo.completed && handleStartEdit(todo)} className={`text-sm break-words ${todo.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {todo.text}
                        </p>
                      )}
                      {formattedDate && !isEditing && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" /> {formattedDate} {todo.updatedAt && '(edited)'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(todo._id)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(todo)} className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteCandidate(todo)} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Server className="w-5 h-5 text-indigo-400" /> API Settings</h2>
            <div className="mt-4"><input type="text" value={pendingApiUrl} onChange={(e) => setPendingApiUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono" /></div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800">Cancel</button>
              <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-white mb-2">Delete Task?</h3>
            <p className="text-xs text-slate-400 mb-5">Remove "{deleteCandidate.text}"?</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteCandidate(null)} className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}