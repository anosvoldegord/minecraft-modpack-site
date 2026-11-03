"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { supabase } from "./supabase";

type ModInfo = { project_id: string; title: string; icon_url: string; description: string; downloads: number; categories: string[]; };
type FullModInfo = ModInfo & { body: string; gallery: { url: string; featured: boolean; title?: string }[]; };
type Artifact = { project_id: string; version_id: string; title: string; isLibrary: boolean; icon_url?: string; file_url?: string; file_name?: string; version_number?: string; };
type Modpack = { id: string; name: string; gameVersion: string; loader: string; artifacts: Record<string, Artifact>; };
type PublishedPack = { id: string; name: string; game_version: string; loader: string; artifacts: Record<string, Artifact>; downloads: number; profiles: { username: string; avatar_url: string; title: string } };

const CATEGORIES = [
  { id: "adventure", label: "Приключения", labelEn: "Adventure" },
  { id: "technology", label: "Технологии", labelEn: "Technology" },
  { id: "magic", label: "Магия", labelEn: "Magic" },
  { id: "mobs", label: "Животные и Мобы", labelEn: "Mobs" },
  { id: "worldgen", label: "Генерация мира", labelEn: "Worldgen" },
  { id: "equipment", label: "Снаряжение", labelEn: "Equipment" },
  { id: "decoration", label: "Декор", labelEn: "Decoration" },
  { id: "optimization", label: "Оптимизация", labelEn: "Optimization" },
  { id: "storage", label: "Хранение", labelEn: "Storage" },
  { id: "food", label: "Еда", labelEn: "Food" },
  { id: "library", label: "Библиотеки", labelEn: "Library" },
  { id: "utility", label: "Утилиты", labelEn: "Utility" },
  { id: "quests", label: "Квесты", labelEn: "Quests" },
  { id: "game-mechanics", label: "Механики", labelEn: "Game Mechanics" },
];

const ITEMS_PER_PAGE = 20;

const CustomSelect = ({ value, options, onChange, widthClass = "w-32" }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void, widthClass?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedOption = options.find(o => o.value === value);
  return (
    <div className={`relative z-50 ${widthClass}`} ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-black/30 backdrop-blur-md hover:bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-sm font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-green-500/50 text-white">
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 min-w-[120%] animate-in fade-in slide-in-from-top-2">
          {options.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${value === opt.value ? "bg-white/10 text-green-400 font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"}`}>
              {opt.label}
              {value === opt.value && <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [view, setView] = useState<"mods" | "catalog" | "profile">("mods");
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [activePackId, setActivePackId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [langRu, setLangRu] = useState(true);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  
  const [catalog, setCatalog] = useState<PublishedPack[]>([]);
  
  const [selectedMod, setSelectedMod] = useState<FullModInfo | null>(null);
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const activePack = modpacks.find(p => p.id === activePackId) || modpacks[0];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null); 
      setIsLoggingIn(false);
      if(session?.user) fetchProfile(session.user.id);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { 
      setUser(session?.user ?? null); 
      if (event === 'SIGNED_IN') { setIsLoggingIn(false); fetchProfile(session!.user.id); }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
    else {
      const newProfile = { id: userId, username: "Игрок", title: "Новичок" };
      await supabase.from('profiles').insert(newProfile);
      setProfile(newProfile);
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      setProfile({ ...profile, avatar_url: data.publicUrl });
    } catch (error) {
      alert("Ошибка загрузки. Проверьте, создано ли хранилище 'avatars'.");
    } finally {
      setIsUploading(false);
    }
  };

  const saveProfile = async (updates: any) => {
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile({ ...profile, ...updates });
  };

  useEffect(() => {
    if (user) fetchFromDB();
    else {
      const saved = localStorage.getItem("modbuilder_packs");
      if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) { setModpacks(parsed); setActivePackId(parsed[0].id); } } catch(e) {} }
      else { createNewPack(true, null); }
      setIsLoaded(true);
    }
    fetchCatalog();
  }, [user]);

  const fetchCatalog = async () => {
    const { data } = await supabase.from('published_packs').select(`*, profiles(username, avatar_url, title)`).order('created_at', { ascending: false });
    if (data) setCatalog(data as any);
  };

  const fetchFromDB = async () => {
    try {
      const { data } = await supabase.from('modpacks').select('*').order('created_at', { ascending: true });
      if (data && data.length > 0) { setModpacks(data.map(d => ({ id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {} }))); setActivePackId(data[0].id); }
      else { createNewPack(true, user); }
    } catch(e) {}
    setIsLoaded(true);
  };

  const saveToDB = async (newPacks: Modpack[], currentId: string) => {
    if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return; }
    const pack = newPacks.find(p => p.id === currentId); if (!pack) return;
    try { await supabase.from('modpacks').upsert({ id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: pack.artifacts }); } catch(e) {}
  };

  const createNewPack = async (isInitial = false, currentUser = user) => {
    const newId = crypto.randomUUID();
    const newPack = { id: newId, name: isInitial ? "Моя сборка" : "Новая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} };
    const newPacks = [...modpacks, newPack];
    setModpacks(newPacks);
    setActivePackId(newId);
    setIsSidebarOpen(true);
    
    if (currentUser) {
      try { await supabase.from('modpacks').insert({ id: newId, user_id: currentUser.id, name: newPack.name, game_version: newPack.gameVersion, loader: newPack.loader, artifacts: {} }); } catch(e) {}
    } else {
      localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks));
    }
  };

  const publishPack = async () => {
    if (!user || !activePack || Object.keys(activePack.artifacts).length === 0) return alert("Сначала добавьте моды в сборку.");
    try {
      await supabase.from('published_packs').insert({
        user_id: user.id,
        name: activePack.name,
        game_version: activePack.gameVersion,
        loader: activePack.loader,
        artifacts: activePack.artifacts
      });
      alert("Сборка опубликована в каталоге!");
      fetchCatalog();
    } catch(e) { alert("Ошибка публикации"); }
  };

  const importPack = (pack: PublishedPack) => {
    const newId = crypto.randomUUID();
    const newPack = { id: newId, name: `Копия: ${pack.name}`, gameVersion: pack.game_version, loader: pack.loader, artifacts: pack.artifacts };
    const newPacks = [...modpacks, newPack];
    setModpacks(newPacks);
    setActivePackId(newId);
    saveToDB(newPacks, newId);
    alert("Сборка добавлена в ваш личный кабинет!");
    setView("mods");
  };

  const deletePack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (modpacks.length === 1) return alert("Нельзя удалить последнюю сборку.");
    if (confirm("Удалить эту сборку?")) {
      const newPacks = modpacks.filter(p => p.id !== id);
      setModpacks(newPacks);
      if (activePackId === id) setActivePackId(newPacks[0].id);
      if (user) { await supabase.from('modpacks').delete().eq('id', id); } 
      else { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); }
    }
  };

  const startRenaming = (id: string, currentName: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPackId(id); setEditNameValue(currentName); };
  const saveRename = () => { if (editingPackId && editNameValue.trim()) { const newPacks = modpacks.map(p => p.id === editingPackId ? { ...p, name: editNameValue.trim() } : p); setModpacks(newPacks); saveToDB(newPacks, activePackId); } setEditingPackId(null); };

  const updateActivePack = (updates: Partial<Modpack>) => { const newPacks = modpacks.map(p => p.id === activePackId ? { ...p, ...updates } : p); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const toggleCategory = (catId: string) => { setSelectedCategories(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]); setCurrentPage(1); };

  const fetchMods = async (page: number) => {
    setIsLoading(true);
    try {
      const facets = [[`versions:${activePack?.gameVersion || "1.16.5"}`], [`categories:${activePack?.loader || "forge"}`], ["project_type:mod"]];
      if (selectedCategories.length > 0) facets.push(selectedCategories.map(c => `categories:${c}`));
      let url = `https://api.modrinth.com/v2/search?offset=${(page - 1) * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`;
      if (!query.trim() && selectedCategories.length === 0) url += `&query=&index=downloads`;
      else if (query.trim()) url += `&query=${encodeURIComponent(query)}`;
      url += `&facets=${encodeURIComponent(JSON.stringify(facets))}`;
      const res = await fetch(url); const data = await res.json();
      setResults(data.hits || []); setTotalHits(data.total_hits || 0);
    } catch(e) {}
    setIsLoading(false);
  };

  useEffect(() => { if (isLoaded && view === "mods") fetchMods(currentPage); }, [query, selectedCategories, activePack?.gameVersion, activePack?.loader, currentPage, view]);

  const openModModal = async (mod: ModInfo) => {
    setIsModalLoading(true); setSelectedMod({ ...mod, body: "", gallery: [] });
    try {
      const [projRes, verRes] = await Promise.all([ fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`), fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`) ]);
      const projData = await projRes.json(); const verData = await verRes.json();
      setSelectedMod({ ...mod, body: projData.body || "", gallery: projData.gallery || [] }); setModVersions(verData || []);
    } catch(e) {} finally { setIsModalLoading(false); }
  };

  const handleAddMod = async (mod: ModInfo, specificVersion?: any) => {
    setIsAdding(mod.project_id);
    try {
      let verRes: any = specificVersion;
      if (!verRes) {
        const versionsData = await (await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json();
        verRes = versionsData[0];
      }
      if (!verRes) return alert("Версия не найдена");
      
      const newArtifacts: Record<string, Artifact> = { [mod.project_id]: { project_id: mod.project_id, version_id: verRes.id, title: mod.title, isLibrary: false, icon_url: mod.icon_url, file_url: verRes.files[0]?.url, file_name: verRes.files[0]?.filename, version_number: verRes.version_number } };
      
      if (verRes.dependencies) {
        for (const dep of verRes.dependencies) {
          if (dep.dependency_type === "required" && dep.project_id) {
            const libProj = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`)).json();
            const libVersions = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json();
            const libVer = libVersions[0];
            if (libVer) newArtifacts[dep.project_id] = { project_id: dep.project_id, version_id: libVer.id, title: libProj.title, isLibrary: true, icon_url: libProj.icon_url, file_url: libVer.files[0]?.url, file_name: libVer.files[0]?.filename, version_number: libVer.version_number };
          }
        }
      }
      
      const newPacks = modpacks.map(p => { if (p.id !== activePackId) return p; return { ...p, artifacts: { ...p.artifacts, ...newArtifacts } }; });
      setModpacks(newPacks); saveToDB(newPacks, activePackId); setSelectedMod(null);
    } catch(e) {} finally { setIsAdding(null); }
  };

  const removeArtifact = (id: string) => { const newPacks = modpacks.map(p => { if (p.id !== activePackId) return p; const copy = { ...p.artifacts }; delete copy[id]; return { ...p, artifacts: copy }; }); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const downloadModpack = async (pack: Modpack) => { const list = Object.values(pack.artifacts); if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.zip`; a.click(); } catch(e) {} finally { setIsDownloading(false); } };

  const login = () => { setIsLoggingIn(true); supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } }); };
  const logout = () => supabase.auth.signOut();
  
  if (!isLoaded) return <div className="h-screen bg-[#09090b] text-white flex items-center justify-center">Загрузка...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter(a => !a.isLibrary);
  const libsList = artifactList.filter(a => a.isLibrary);
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);

  return (
    <div className="flex h-screen text-white font-sans overflow-hidden relative selection:bg-green-500/30">
      
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg.png')" }}></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {isLoggingIn && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Вход через GitHub...</h2>
        </div>
      )}

      <aside className={`bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 transition-all z-10 ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden opacity-0"}`}>
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-md">ModBuilder</h1>
        </div>
        
        <div className="px-4 space-y-1 mb-4">
          <button onClick={() => setView("mods")} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "mods" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Сборщик</button>
          <button onClick={() => setView("catalog")} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "catalog" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Каталог сборок</button>
          <button onClick={() => setView("profile")} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "profile" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Мой профиль</button>
        </div>

        {view === "mods" && (
          <>
            <div className="px-6 pb-2 flex justify-between items-center text-sm font-bold text-zinc-400">
              <span>Мои сборки</span>
              <button onClick={() => createNewPack()} className="text-white hover:text-green-400 text-lg" title="Создать">+</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-2">
              {modpacks.map(pack => (
                <div key={pack.id} onClick={() => setActivePackId(pack.id)} className={`relative group p-4 rounded-2xl cursor-pointer border border-transparent transition-all ${activePackId === pack.id ? "bg-white/20 border-white/20 shadow-lg" : "hover:bg-white/10"}`}>
                  {editingPackId === pack.id ? (
                    <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={saveRename} onKeyDown={(e) => e.key === "Enter" && saveRename()} className="bg-black/50 border border-green-500/50 rounded-lg px-2 py-1 text-sm w-full outline-none text-white" />
                  ) : (
                    <div className="font-bold text-sm truncate pr-14 text-white">{pack.name}</div>
                  )}
                  <div className="text-xs text-zinc-300 mt-1">{pack.gameVersion} • {pack.loader.toUpperCase()}</div>
                  <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => startRenaming(pack.id, pack.name, e)} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/20">✎</button>
                    <button onClick={(e) => deletePack(pack.id, e)} className="text-zinc-400 hover:text-red-500 p-1 rounded-md hover:bg-white/20">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="p-5 mt-auto">
           {user ? (
             <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-center">
               <div className="text-green-400 text-xs mb-1">Вы вошли:</div>
               <div className="truncate font-bold text-sm text-white">{profile?.username || user.email}</div>
               <button onClick={logout} className="mt-2 text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg w-full text-sm transition-colors">Выйти</button>
             </div>
           ) : (
             <button onClick={login} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/20 text-white px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Войти</button>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {view === "mods" && (
          <>
            <header className="p-6 border-b border-white/10 flex flex-col gap-4 bg-black/30 backdrop-blur-xl z-20">
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/10 hover:bg-white/20 border border-white/20 p-3 rounded-xl shrink-0 transition-colors text-white">Меню</button>
                <input type="text" placeholder="Поиск модов..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-black/30 border border-white/20 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-green-500/50 focus:bg-black/50 transition-all text-white placeholder-zinc-400" />
                <div className="flex gap-2 shrink-0">
                  <CustomSelect value={activePack?.gameVersion || "1.16.5"} onChange={(val) => updateActivePack({ gameVersion: val, artifacts: {} })} options={[{ value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} />
                  <CustomSelect value={activePack?.loader || "forge"} onChange={(val) => updateActivePack({ loader: val, artifacts: {} })} options={[{ value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} />
                  <button onClick={() => setIsPackOpen(true)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]">Сборка ({modsList.length})</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${selectedCategories.includes(cat.id) ? "bg-green-500/30 border-green-500/60 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{cat.label}</button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {results.map(mod => (
                    <div key={mod.project_id} onClick={() => openModModal(mod)} className="bg-black/50 backdrop-blur-md border border-white/10 p-5 rounded-3xl hover:border-green-500/50 hover:bg-black/60 cursor-pointer flex flex-col gap-4 shadow-xl hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all duration-300 hover:-translate-y-1 group">
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-lg group-hover:scale-105 transition-transform border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div>
                        <div className="min-w-0"><h3 className="font-bold text-lg truncate pr-2 text-white">{mod.title}</h3><div className="text-xs text-zinc-400 mt-1">⬇ {mod.downloads.toLocaleString()}</div></div>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-3 flex-1 relative z-10">{mod.description}</p>
                      <button onClick={(e) => { e.stopPropagation(); handleAddMod(mod); }} disabled={isAdding === mod.project_id || !!activePack?.artifacts[mod.project_id]} className="bg-white/10 hover:bg-green-500 hover:text-black py-2.5 rounded-xl font-bold text-sm transition-colors relative z-10 border border-white/10 hover:border-green-500">
                        {isAdding === mod.project_id ? "..." : activePack?.artifacts[mod.project_id] ? "Добавлено" : "+ В сборку"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "catalog" && (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">Каталог сборок</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {catalog.map(pack => (
                <div key={pack.id} className="bg-black/70 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col gap-4 shadow-xl text-white">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden relative">
                      {pack.profiles?.avatar_url ? <Image src={pack.profiles.avatar_url} alt="avatar" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-lg">👤</div>}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-green-400">{pack.profiles?.username || "Игрок"}</div>
                      <div className="text-xs text-zinc-400">{pack.profiles?.title || "Новичок"}</div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold">{pack.name}</h3>
                  <div className="text-sm text-zinc-400">{pack.game_version} • {pack.loader.toUpperCase()}</div>
                  <div className="text-sm text-zinc-300">Модов: {Object.keys(pack.artifacts).length}</div>
                  <button onClick={() => importPack(pack)} className="mt-auto w-full bg-white/10 hover:bg-green-500 hover:text-black py-3 rounded-xl font-bold transition-colors">Скачать себе</button>
                </div>
              ))}
              {catalog.length === 0 && <div className="text-zinc-500">Пока никто не опубликовал сборки. Будьте первым!</div>}
            </div>
          </div>
        )}

        {view === "profile" && user && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl">
              <h2 className="text-3xl font-black mb-8 text-center text-white">Мой профиль</h2>
              
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-4 border-green-500 overflow-hidden relative shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                   {profile?.avatar_url ? <Image src={profile.avatar_url} alt="avatar" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}
                </div>
                <div className="text-xl font-bold text-green-400">{profile?.title || "Новичок"}</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Никнейм</label>
                  <input type="text" value={profile?.username || ""} onChange={(e) => setProfile({...profile, username: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Аватарка (загрузить файл)</label>
                  <div className="flex items-center gap-4">
                    <input type="file" id="avatar-upload" accept="image/*" onChange={uploadAvatar} className="hidden" />
                    <label htmlFor="avatar-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20">
                      {isUploading ? "Загрузка..." : "Выбрать фото"}
                    </label>
                  </div>
                </div>
                <button onClick={() => saveProfile({ username: profile.username })} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl mt-4 transition-colors">Сохранить изменения</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className={`fixed inset-y-0 right-0 w-[28rem] bg-black/80 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Моя сборка</h2>
          <button onClick={() => setIsPackOpen(false)} className="bg-white/10 hover:bg-white/20 border border-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {modsList.map(mod => (
            <div key={mod.project_id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div>
                <span className="text-sm font-bold truncate text-white">{mod.title}</span>
              </div>
              <button onClick={() => removeArtifact(mod.project_id)} className="text-red-500 hover:text-red-400 p-2">✕</button>
            </div>
          ))}
          {modsList.length === 0 && <div className="text-center text-zinc-400 mt-10">Пусто</div>}
        </div>
        <div className="p-6 border-t border-white/10 flex flex-col gap-3">
          <button onClick={() => downloadModpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            {isDownloading ? "Скачивание..." : "Скачать .zip"}
          </button>
          <button onClick={publishPack} disabled={modsList.length === 0 || !user} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
            Опубликовать в каталоге
          </button>
        </div>
      </div>

      {selectedMod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6" onClick={() => setSelectedMod(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-white/10 flex items-start gap-8 bg-gradient-to-br from-white/[0.04] to-transparent relative">
              <div className="w-32 h-32 rounded-3xl bg-zinc-800 overflow-hidden relative shadow-2xl shrink-0 border border-white/10"><Image src={selectedMod.icon_url || '/placeholder.png'} alt={selectedMod.title} fill className="object-cover" unoptimized /></div>
              <div className="flex-1">
                <h2 className="text-4xl font-black text-white">{selectedMod.title}</h2>
                <p className="text-zinc-300 mt-4 leading-relaxed text-base max-w-2xl">{selectedMod.description}</p>
              </div>
              <button onClick={() => setSelectedMod(null)} className="absolute top-8 right-8 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                {selectedMod.body && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Описание</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-white/5 p-6 rounded-2xl border border-white/10">
                      {selectedMod.body.substring(0, 1000)}...
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Версии</h3>
                {isModalLoading ? (<div className="text-center text-green-500 py-10">Загрузка...</div>) : (
                  <div className="flex flex-col gap-3">
                    {modVersions.slice(0, 5).map(v => (
                      <div key={v.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="font-bold text-sm text-white">{v.name}</div>
                        <button onClick={() => handleAddMod(selectedMod, v)} className="mt-3 w-full bg-white/10 hover:bg-green-500 hover:text-black text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold transition-all">Добавить</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}