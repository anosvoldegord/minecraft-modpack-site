"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { supabase } from "./supabase";

type ModInfo = { project_id: string; title: string; icon_url: string; description: string; downloads: number; categories: string[]; };
type FullModInfo = ModInfo & { body: string; gallery: { url: string; featured: boolean; title?: string }[]; };
type Artifact = { project_id: string; version_id: string; title: string; isLibrary: boolean; icon_url?: string; file_url?: string; file_name?: string; version_number?: string; };
type Modpack = { id: string; name: string; gameVersion: string; loader: string; artifacts: Record<string, Artifact>; };

const CATEGORIES = [
  { id: "adventure", label: "Приключения" }, { id: "technology", label: "Технологии" }, { id: "magic", label: "Магия" },
  { id: "mobs", label: "Животные и Мобы" }, { id: "worldgen", label: "Генерация мира" }, { id: "equipment", label: "Снаряжение" },
  { id: "decoration", label: "Декор" }, { id: "optimization", label: "Оптимизация" }, { id: "storage", label: "Хранение" },
  { id: "food", label: "Еда" }, { id: "library", label: "Библиотеки" }, { id: "utility", label: "Утилиты" },
  { id: "quests", label: "Квесты" }, { id: "game-mechanics", label: "Механики" },
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
    <div className={`relative ${widthClass}`} ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-green-500/50">
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#151519] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 min-w-[120%] animate-in fade-in slide-in-from-top-2">
          {options.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${value === opt.value ? "bg-white/5 text-green-400 font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"}`}>
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
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [activePackId, setActivePackId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  
  const [selectedMod, setSelectedMod] = useState<FullModInfo | null>(null);
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const activePack = modpacks.find(p => p.id === activePackId) || modpacks[0];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { setUser(session?.user ?? null); });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchFromDB();
    else {
      const saved = localStorage.getItem("modbuilder_packs");
      if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) { setModpacks(parsed); setActivePackId(parsed[0].id); } } catch(e) {} }
      else { const newPack = { id: "1", name: "Моя сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} }; setModpacks([newPack]); setActivePackId("1"); }
      setIsLoaded(true);
    }
  }, [user]);

  const fetchFromDB = async () => {
    try {
      const { data } = await supabase.from('modpacks').select('*').order('created_at', { ascending: true });
      if (data && data.length > 0) { setModpacks(data.map(d => ({ id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {} }))); setActivePackId(data[0].id); }
      else {
        const newId = crypto.randomUUID(); const newPack = { id: newId, name: "Моя первая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} };
        setModpacks([newPack]); setActivePackId(newId);
        await supabase.from('modpacks').insert({ id: newId, user_id: user.id, name: newPack.name, game_version: newPack.gameVersion, loader: newPack.loader, artifacts: {} });
      }
    } catch(e) {}
    setIsLoaded(true);
  };

  const saveToDB = async (newPacks: Modpack[], currentId: string) => {
    if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return; }
    const pack = newPacks.find(p => p.id === currentId); if (!pack) return;
    try { await supabase.from('modpacks').upsert({ id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: pack.artifacts }); } catch(e) {}
  };

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

  useEffect(() => { if (isLoaded) fetchMods(currentPage); }, [query, selectedCategories, activePack?.gameVersion, activePack?.loader, currentPage, isLoaded]);

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
  const downloadModpack = async () => { if (!activePack) return; const list = Object.values(activePack.artifacts); if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${activePack.name}.zip`; a.click(); } catch(e) {} finally { setIsDownloading(false); } };

  const login = () => supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();
  if (!isLoaded) return <div className="h-screen bg-[#09090b] text-white flex items-center justify-center">Загрузка...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter(a => !a.isLibrary);
  const libsList = artifactList.filter(a => a.isLibrary);
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      <aside className={`bg-[#0c0c0e] border-r border-white/5 flex flex-col shrink-0 transition-all ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden opacity-0"}`}>
        <div className="p-6 flex justify-between items-center"><h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">ModBuilder</h1></div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {modpacks.map(pack => (
            <div key={pack.id} onClick={() => setActivePackId(pack.id)} className={`p-4 rounded-2xl cursor-pointer ${activePackId === pack.id ? "bg-white/10" : "hover:bg-white/5"}`}>
              <div className="font-bold text-sm truncate">{pack.name}</div>
              <div className="text-xs text-zinc-500">{pack.gameVersion} • {pack.loader.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div className="p-5">
           {user ? (
             <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
               <div className="text-green-400 text-xs mb-1">Вы вошли:</div>
               <div className="truncate font-bold text-sm">{user.email}</div>
               <button onClick={logout} className="mt-2 text-zinc-400 hover:text-white bg-white/10 px-3 py-1 rounded-lg w-full text-sm">Выйти</button>
             </div>
           ) : (
             <button onClick={login} className="bg-[#24292e] text-white px-4 py-3 rounded-xl font-bold w-full">Войти</button>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="p-6 border-b border-white/5 flex flex-col gap-4 bg-[#09090b]/80 backdrop-blur-xl z-10">
          <div className="flex items-center justify-between gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/5 p-3 rounded-xl shrink-0">Меню</button>
            <input type="text" placeholder="Поиск модов..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-green-500/50" />
            <div className="flex gap-2 shrink-0">
              <CustomSelect value={activePack?.gameVersion || "1.16.5"} onChange={(val) => updateActivePack({ gameVersion: val, artifacts: {} })} options={[{ value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} />
              <CustomSelect value={activePack?.loader || "forge"} onChange={(val) => updateActivePack({ loader: val, artifacts: {} })} options={[{ value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} />
              <button onClick={() => setIsPackOpen(true)} className="bg-green-500 text-black px-6 py-3 rounded-2xl font-bold">Сборка ({modsList.length})</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${selectedCategories.includes(cat.id) ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-white/5 border-white/5 text-zinc-400"}`}>{cat.label}</button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? <div className="text-center py-20 text-green-500">Загрузка...</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {results.map(mod => (
                <div key={mod.project_id} onClick={() => openModModal(mod)} className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl hover:bg-white/[0.06] cursor-pointer flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div>
                    <div><h3 className="font-bold text-lg truncate">{mod.title}</h3><div className="text-xs text-zinc-400">⬇ {mod.downloads.toLocaleString()}</div></div>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-3 flex-1">{mod.description}</p>
                  <button onClick={(e) => { e.stopPropagation(); handleAddMod(mod); }} disabled={isAdding === mod.project_id || !!activePack?.artifacts[mod.project_id]} className="bg-white/5 hover:bg-green-500 hover:text-black py-2 rounded-xl font-bold text-sm">
                    {isAdding === mod.project_id ? "..." : activePack?.artifacts[mod.project_id] ? "Добавлено" : "+ В сборку"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ПАНЕЛЬ СБОРКИ (ВЫЕЗЖАЮЩАЯ) */}
      <div className={`fixed inset-y-0 right-0 w-[28rem] bg-[#0c0c0e] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-2xl font-black">Сборка</h2>
          <button onClick={() => setIsPackOpen(false)} className="bg-white/5 hover:bg-white/10 w-10 h-10 rounded-full flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {modsList.map(mod => (
            <div key={mod.project_id} className="flex items-center justify-between bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div>
                <span className="text-sm font-bold truncate">{mod.title}</span>
              </div>
              <button onClick={() => removeArtifact(mod.project_id)} className="text-red-500 hover:text-red-400">✕</button>
            </div>
          ))}
          {modsList.length === 0 && <div className="text-center text-zinc-600 mt-10">Пусто</div>}
        </div>
        <div className="p-6 border-t border-white/5">
          <button onClick={downloadModpack} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 text-black py-4 rounded-xl font-bold text-lg">{isDownloading ? "Скачивание..." : "Скачать .zip"}</button>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО С ОПИСАНИЕМ И ГАЛЕРЕЕЙ */}
      {selectedMod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6" onClick={() => setSelectedMod(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-white/5 flex items-start gap-8 bg-gradient-to-br from-white/[0.04] to-transparent relative">
              <div className="w-32 h-32 rounded-3xl bg-zinc-800 overflow-hidden relative shadow-2xl shrink-0 border border-white/10"><Image src={selectedMod.icon_url || '/placeholder.png'} alt={selectedMod.title} fill className="object-cover" unoptimized /></div>
              <div className="flex-1">
                <h2 className="text-4xl font-black">{selectedMod.title}</h2>
                <p className="text-zinc-400 mt-4 leading-relaxed text-base max-w-2xl">{selectedMod.description}</p>
                <div className="flex gap-6 mt-6 text-sm font-medium text-zinc-400"><span className="flex items-center gap-2">⬇ {selectedMod.downloads.toLocaleString()}</span></div>
              </div>
              <button onClick={() => setSelectedMod(null)} className="absolute top-8 right-8 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 w-12 h-12 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                {selectedMod.gallery && selectedMod.gallery.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Галерея</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedMod.gallery.map((img, idx) => (
                        <div key={idx} className="rounded-xl overflow-hidden relative border border-white/10 shadow-lg aspect-video group"><Image src={img.url} alt={img.title || "Gallery image"} fill className="object-cover" unoptimized /></div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedMod.body && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Описание</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                      {selectedMod.body.split('\n').map((paragraph, idx) => (<p key={idx} className="mb-4 last:mb-0 whitespace-pre-wrap">{paragraph}</p>))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Версии для {activePack?.gameVersion}</h3>
                {isModalLoading ? (<div className="text-center text-green-500 py-10">Загрузка версий...</div>) : modVersions.length === 0 ? (<div className="text-center text-zinc-500 text-sm bg-white/[0.02] rounded-xl border border-white/5 py-10">Нет версий</div>) : (
                  <div className="flex flex-col gap-3">
                    {modVersions.map(v => (
                      <div key={v.id} className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                        <div className="font-bold text-sm text-zinc-200">{v.name}</div>
                        <div className="text-xs text-zinc-500 mt-1 font-medium">{v.version_number}</div>
                        <button onClick={() => handleAddMod(selectedMod, v)} disabled={isAdding === selectedMod.project_id || !!activePack?.artifacts[selectedMod.project_id]} className="mt-3 w-full bg-white/5 hover:bg-green-500 hover:text-black text-zinc-300 disabled:bg-white/[0.02] disabled:text-zinc-600 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200">
                          {activePack?.artifacts[selectedMod.project_id] ? "Уже в сборке" : "Добавить"}
                        </button>
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