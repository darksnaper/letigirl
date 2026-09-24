'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCcw,
  Sparkles,
  Users,
  Swords,
  Upload,
  Check,
  AlertCircle,
  KeyRound,
  Lock,
  Camera,
  X,
  Trophy,
  ListOrdered,
  Search,
} from 'lucide-react';
import { Contestant } from '@prisma/client';
import { Navbar } from '@/components/Navbar';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authInput, setAuthInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Tabs: 'contestants' | 'leaderboard'
  const [activeTab, setActiveTab] = useState<'contestants' | 'leaderboard'>('contestants');

  // Contestants list & stats
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [stats, setStats] = useState({
    totalContestants: 0,
    activeContestants: 0,
    totalMatches: 0,
    totalSessions: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add contestant form
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [course, setCourse] = useState(1);
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo replacement modal state
  const [photoModalContestant, setPhotoModalContestant] = useState<Contestant | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [newPreviewUrl, setNewPreviewUrl] = useState<string>('');
  const [isSavingPhoto, setIsSavingPhoto] = useState<boolean>(false);
  const [photoModalError, setPhotoModalError] = useState<string | null>(null);

  // Leaderboard filters in admin
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardFaculty, setLeaderboardFaculty] = useState('all');

  // Check saved session
  useEffect(() => {
    const savedKey = sessionStorage.getItem('univote_admin_key');
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = authInput.trim();
    if (!key) return;

    try {
      setLoading(true);
      setAuthError('');
      const res = await fetch('/api/admin/contestants', {
        headers: { 'x-admin-key': key },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAdminKey(key);
        sessionStorage.setItem('univote_admin_key', key);
        setIsAuthenticated(true);
        setContestants(data.data.contestants);
        setStats(data.data.stats);
      } else {
        setAuthError('Неверный пароль администратора');
      }
    } catch (err) {
      console.error(err);
      setAuthError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('univote_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
  };

  const fetchContestants = useCallback(async () => {
    if (!adminKey) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/contestants', {
        headers: { 'x-admin-key': adminKey },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContestants(data.data.contestants);
        setStats(data.data.stats);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        setAuthError('Сессия администратора истекла. Введите пароль.');
        sessionStorage.removeItem('univote_admin_key');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchContestants();
    }
  }, [isAuthenticated, fetchContestants]);

  // Handle Photo selection for new contestant
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPhotoUrl('');
    }
  };

  // Handle Photo selection for replacement modal
  const handleNewPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPhotoFile(file);
      setNewPreviewUrl(URL.createObjectURL(file));
      setNewPhotoUrl('');
    }
  };

  // Submit new contestant
  const handleAddContestant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !faculty || (!photoFile && !photoUrl)) {
      setActionMessage({ type: 'error', text: 'Пожалуйста, заполните имя, факультет и добавьте фото' });
      return;
    }

    try {
      setIsSubmitting(true);
      setActionMessage(null);

      let res: Response;
      if (photoFile) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('faculty', faculty);
        formData.append('course', course.toString());
        formData.append('bio', bio);
        formData.append('photo', photoFile);

        res = await fetch('/api/admin/contestants', {
          method: 'POST',
          headers: { 'x-admin-key': adminKey },
          body: formData,
        });
      } else {
        res = await fetch('/api/admin/contestants', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey,
          },
          body: JSON.stringify({ name, faculty, course, bio, photoUrl }),
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: `Участница «${name}» успешно добавлена!` });
        setName('');
        setFaculty('');
        setCourse(1);
        setBio('');
        setPhotoUrl('');
        setPhotoFile(null);
        setPreviewUrl('');
        fetchContestants();
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('univote_admin_key');
        setAuthError('Неверный пароль администратора');
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Ошибка при добавлении' });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: 'Сетевая ошибка при отправке' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open photo replacement modal
  const openPhotoModal = (c: Contestant) => {
    setPhotoModalContestant(c);
    setNewPhotoFile(null);
    setNewPhotoUrl('');
    setNewPreviewUrl('');
    setPhotoModalError(null);
  };

  // Save replaced photo
  const handleSaveReplacedPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoModalContestant || (!newPhotoFile && !newPhotoUrl)) {
      return;
    }

    try {
      setIsSavingPhoto(true);
      setPhotoModalError(null);
      let res: Response;

      if (newPhotoFile) {
        const formData = new FormData();
        formData.append('id', photoModalContestant.id);
        formData.append('photo', newPhotoFile);

        res = await fetch('/api/admin/contestants', {
          method: 'PATCH',
          headers: { 'x-admin-key': adminKey },
          body: formData,
        });
      } else {
        res = await fetch('/api/admin/contestants', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey,
          },
          body: JSON.stringify({
            id: photoModalContestant.id,
            photoUrl: newPhotoUrl,
          }),
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({
          type: 'success',
          text: `Фотография участницы «${photoModalContestant.name}» успешно обновлена!`,
        });
        setPhotoModalContestant(null);
        setNewPhotoFile(null);
        setNewPhotoUrl('');
        setNewPreviewUrl('');
        fetchContestants();
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('univote_admin_key');
        setAuthError('Неверный пароль администратора или сессия истекла. Войдите заново.');
        setPhotoModalContestant(null);
      } else {
        setPhotoModalError(data.error || 'Ошибка при замене фото');
      }
    } catch (err) {
      console.error(err);
      setPhotoModalError('Ошибка сети при сохранении фото');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/contestants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchContestants();
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('univote_admin_key');
        setAuthError('Неверный пароль администратора');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete contestant
  const handleDelete = async (id: string, contestantName: string) => {
    if (!confirm(`Вы действительно хотите удалить «${contestantName}»?`)) return;

    try {
      const res = await fetch(`/api/admin/contestants?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: `Участница «${contestantName}» удалена` });
        fetchContestants();
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('univote_admin_key');
        setAuthError('Неверный пароль администратора');
      }
    } catch (err) {
      console.error(err);
    }
  };


  // Reset ratings
  const handleResetRatings = async () => {
    if (!confirm('Вы уверены, что хотите сбросить все рейтинги Elo до 1500 и очистить историю дуэлей?')) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ action: 'reset_stats' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: data.message });
        fetchContestants();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Leaderboard items sorted by winrate
  const fullLeaderboardList = [...contestants]
    .map((c) => {
      const winrate = c.matchesCount > 0 ? Math.round((c.wins / c.matchesCount) * 100) : 0;
      return { ...c, winrate };
    })
    .sort((a, b) => b.winrate - a.winrate || b.elo - a.elo)
    .filter((c) => {
      if (leaderboardFaculty !== 'all' && c.faculty !== leaderboardFaculty) return false;
      if (leaderboardSearch && !c.name.toLowerCase().includes(leaderboardSearch.toLowerCase())) return false;
      return true;
    });

  const uniqueFaculties = Array.from(new Set(contestants.map((c) => c.faculty))).sort();

  // Login view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-center text-white mb-2">
              Вход для организаторов
            </h2>
            <p className="text-xs text-slate-400 text-center mb-6">
              Панель администратора LetiGirl
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Пароль администратора
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={authInput}
                    onChange={(e) => setAuthInput(e.target.value)}
                    placeholder="Введите пароль администратора"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-600/25 transition"
              >
                Войти в систему
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-purple-400" />
              Панель администратора
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Управление участницами, замена фотографий и полный лидерборд
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('contestants')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'contestants'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Участницы</span>
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'leaderboard'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Полный рейтинг</span>
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {actionMessage && (
          <div
            className={`my-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <Check className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{stats.totalContestants}</div>
              <div className="text-xs text-slate-400">Всего участниц ({stats.activeContestants} акт.)</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{stats.totalMatches}</div>
              <div className="text-xs text-slate-400">Сыграно дуэлей</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{stats.totalSessions}</div>
              <div className="text-xs text-slate-400">Сессий студентов</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-center">
            <button
              onClick={handleResetRatings}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition"
              title="Сбросить все рейтинги Elo до 1500 и очистить турниры"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Сбросить рейтинг</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CONTESTANTS MANAGEMENT */}
        {activeTab === 'contestants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Form */}
            <div className="lg:col-span-1 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Добавить участницу
              </h3>

              <form onSubmit={handleAddContestant} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Имя и фамилия *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Анна Смирнова"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Факультет *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Напр. ФКТИ"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Курс
                    </label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
                    >
                      {[1, 2, 3, 4, 5, 6].map((c) => (
                        <option key={c} value={c}>
                          {c} курс
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Краткое описание / хобби
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Увлечения или интересы..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition resize-none"
                  />
                </div>

                {/* Photo Upload or URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Фотография *
                  </label>

                  {/* File picker */}
                  <div className="mb-2">
                    <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed border-slate-700 hover:border-purple-500 rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-950 text-slate-300 text-xs font-medium transition">
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span>{photoFile ? photoFile.name : 'Загрузить файл с устройства'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="text-center text-[10px] text-slate-500 mb-2">или укажите прямую ссылку</div>

                  <input
                    type="url"
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      setPreviewUrl(e.target.value);
                      setPhotoFile(null);
                    }}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                  />

                  {/* Preview */}
                  {previewUrl && (
                    <div className="mt-3 relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Предпросмотр"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Сохранение...' : 'Зарегистрировать участницу'}
                </button>
              </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span>Список участниц ({contestants.length})</span>
                <span className="text-xs font-normal text-slate-400">
                  Кликните на иконку камеры, чтобы сменить фото
                </span>
              </h3>

              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="text-center py-12 text-slate-500 text-sm flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-spin" />
                    <span>Загрузка данных...</span>
                  </div>
                ) : contestants.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Список участниц пуст. Добавьте первую участницу через форму слева.
                  </div>
                ) : (
                  contestants.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        c.isActive
                          ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative group/photo">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={c.photoUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* Quick change button on hover */}
                          <button
                            type="button"
                            onClick={() => openPhotoModal(c)}
                            className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity"
                            title="Сменить фото"
                          >
                            <Camera className="w-4 h-4 text-white" />
                          </button>
                        </div>

                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{c.name}</span>
                            {!c.isActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Отключена
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {c.faculty} • {c.course} курс
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Рейтинг: <span className="text-rose-400 font-bold">{Math.round(c.elo)} Elo</span> •{' '}
                            Матчей: {c.matchesCount} ({c.wins} В / {c.losses} П)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Кнопка смены фотографии */}
                        <button
                          type="button"
                          onClick={() => openPhotoModal(c)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 text-xs font-medium transition"
                          title="Заменить фотографию участницы"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Сменить фото</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(c.id, c.isActive)}
                          className={`p-2 rounded-xl border text-xs font-semibold transition ${
                            c.isActive
                              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}
                          title={c.isActive ? 'Отключить из показа' : 'Включить в голосование'}
                        >
                          {c.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition"
                          title="Удалить участницу"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FULL LEADERBOARD IN ADMIN */}
        {activeTab === 'leaderboard' && (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Полный рейтинг участниц
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Все участницы университета, отсортированные по результатам дуэлей
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Поиск по имени..."
                    value={leaderboardSearch}
                    onChange={(e) => setLeaderboardSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <select
                  value={leaderboardFaculty}
                  onChange={(e) => setLeaderboardFaculty(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">Все факультеты</option>
                  {uniqueFaculties.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Full Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Ранг</th>
                    <th className="py-3 px-4">Участница</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Факультет</th>
                    <th className="py-3 px-4 text-center">Процент побед</th>
                    <th className="py-3 px-4 text-center">Дуэли (В/П)</th>
                    <th className="py-3 px-4 text-center">Elo</th>
                    <th className="py-3 px-4 text-center">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fullLeaderboardList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    fullLeaderboardList.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-xs text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-semibold text-white">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-xs text-slate-400">
                          {c.faculty} ({c.course} курс)
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {c.winrate}%
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-slate-400">
                          <span className="text-emerald-400">{c.wins}</span>
                          {' / '}
                          <span className="text-rose-400">{c.losses}</span>
                          <span className="text-slate-500 block text-[10px]">из {c.matchesCount}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                          {Math.round(c.elo)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => openPhotoModal(c)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Сменить фото"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* PHOTO REPLACEMENT MODAL */}
      {photoModalContestant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPhotoModalContestant(null)}
        >
          <div
            className="relative w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPhotoModalContestant(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-400" />
              Заменить фотографию
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Участница: <strong className="text-white">{photoModalContestant.name}</strong>
            </p>

            <form onSubmit={handleSaveReplacedPhoto} className="space-y-4">
              {/* Current photo preview */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={newPreviewUrl || photoModalContestant.photoUrl}
                    alt={photoModalContestant.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  {newPreviewUrl ? (
                    <span className="text-emerald-400 font-medium">Новое фото выбрано</span>
                  ) : (
                    <span>Текущая фотография</span>
                  )}
                </div>
              </div>

              {/* Upload file */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Загрузить новое фото с устройства
                </label>
                <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed border-slate-700 hover:border-purple-500 rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-950 text-slate-300 text-xs font-medium transition">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span>{newPhotoFile ? newPhotoFile.name : 'Выбрать файл (JPG, PNG, WebP)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewPhotoFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-center text-[10px] text-slate-500">или укажите прямую ссылку</div>

              {/* URL */}
              <div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newPhotoUrl}
                  onChange={(e) => {
                    setNewPhotoUrl(e.target.value);
                    setNewPreviewUrl(e.target.value);
                    setNewPhotoFile(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {photoModalError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                  {photoModalError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPhotoModalContestant(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingPhoto || (!newPhotoFile && !newPhotoUrl)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {isSavingPhoto ? 'Сохранение...' : 'Сохранить фото'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
