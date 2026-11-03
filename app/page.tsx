"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";

type ModInfo = {
  project_id: string;
  title: string;
  icon_url: string;
  description: string;
  downloads: number;
  categories: string[];
};

type FullModInfo = ModInfo & {
  body: string;
  gallery: { url: string; featured: boolean; title?: string }[];
};

type Artifact = {
  project_id: string;
  version_id: string;
  title: string;
  isLibrary: boolean;
  icon_url?: string;
  file_url?: string;
  file_name?: string;
  version_number?: string;
};

type Modpack = {
  id: string;
  name: string;
  gameVersion: string;
  loader: string;
  artifacts: Record<string, Artifact>;
};

const CATEGORIES = [
  { id: "adventure", label: "Приключения" },
  { id: "technology", label: "Технологии" },
  { id: "magic", label: "Магия" },
  { id: "mobs", label: "Животные и Мобы" },
  { id: "worldgen", label: "Генерация мира" },
  { id: "equipment", label: "Снаряжение" },
  { id: "decoration", label: "Декор" },
  { id: "optimization", label: "Оптимизация" },
  { id: "storage", label: "Хранение" },
  { id: "food", label: "Еда" },
  { id: "library", label: "Библиотеки" },
  { id: "utility", label: "Утилиты" },
  { id: "quests", label: "Квесты" },
  { id: "game-mechanics", label: "Механики" },
];

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [modpacks, setModpacks] = useState<Modpack[]>([
    { id: "1", name: "Моя первая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} }
  ]);
  const [activePackId, setActivePackId] = useState<string>("1");
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [query, setQuery] = useState("");
  const [searchInBody, setSearchInBody] = useState(false);
  const [results, setResults] = useState<ModInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);

  const [selectedMod, setSelectedMod] = useState<FullModInfo | null>(null);
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  
  const searchRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activePack = modpacks.find(p => p.id === activePackId) || modpacks[0];

  // Загрузка данных из LocalStorage при старте
  useEffect(() => {
    const saved = localStorage.getItem("modbuilder_packs");
    const savedActiveId = localStorage.getItem("modbuilder_active_id");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setModpacks(parsed);
          if (savedActiveId && parsed.find((p: any) => p.id === savedActiveId)) {
            setActivePackId(savedActiveId);
          } else {
            setActivePackId(parsed[0].id);
          }
        }
      } catch (e) {
        console.error("Ошибка загрузки сборок", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Автосохранение при любом изменении
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("modbuilder_packs", JSON.stringify(modpacks));
      localStorage.setItem("modbuilder_active_id", activePackId);
    }
  }, [modpacks, activePackId, isLoaded]);

  const updateActivePack = (updates: Partial<Modpack>) => {
    setModpacks(prev => prev.map(p => p.id === activePackId ? { ...p, ...updates } : p));
  };

  const createNewPack = () => {
    const newId = Date.now().toString();
    const newPack = { id: newId, name: "Новая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} };
    setModpacks([...modpacks, newPack]);
    setActivePackId(newId);
    setIsSidebarOpen(true);
  };

  const deletePack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (modpacks.length === 1) {
      alert("Нельзя удалить последнюю сборку.");
      return;
    }
    if (confirm("Удалить эту сборку?")) {
      const newPacks = modpacks.filter(p => p.id !== id);
      setModpacks(newPacks);
      if (activePackId === id) setActivePackId(newPacks[0].id);
    }
  };

  const startRenaming = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPackId(id);
    setEditNameValue(currentName);
  };

  const saveRename = () => {
    if (editingPackId && editNameValue.trim()) {
      setModpacks(prev => prev.map(p => p.id === editingPackId ? { ...p, name: editNameValue.trim() } : p));
    }
    setEditingPackId(null);
  };

  const clearAllData = () => {
    if (confirm("Удалить ВСЕ сборки и начать с нуля? Это действие нельзя отменить.")) {
      localStorage.removeItem("modbuilder_packs");
      localStorage.removeItem("modbuilder_active_id");
      window.location.reload();
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchMods = async (searchQuery: string, page: number) => {
    setIsLoading(true);
    try {
      const facets = [
        [`versions:${activePack.gameVersion}`],
        [`categories:${activePack.loader}`],
        ["project_type:mod"]
      ];
      
      if (selectedCategories.length > 0) {
        facets.push(selectedCategories.map(c => `categories:${c}`));
      }

      let url = `https://api.modrinth.com/v2/search?`;
      const offset = (page - 1) * ITEMS_PER_PAGE;
      
      if (!searchQuery.trim() && selectedCategories.length === 0) {
        url += `query=&index=downloads&`; 
      } else {
        if (searchQuery.trim()) {
          url += `query=${encodeURIComponent(searchQuery)}&`;
          if (searchInBody) {
            url += `search_in_description=true&`;
          }
        }
      }
      
      const encodedFacets = encodeURIComponent(JSON.stringify(facets));
      url += `facets=${encodedFacets}&limit=${ITEMS_PER_PAGE}&offset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();
      setResults(data.hits || []);
      setTotalHits(data.total_hits || 0);
    } catch (error) {
      console.error("Ошибка поиска:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, searchInBody, selectedCategories, activePack.gameVersion, activePack.loader]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMods(query, currentPage);
      if (scrollRef.current) scrollRef.current.scrollTop = 0; 
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchInBody, selectedCategories, activePack.gameVersion, activePack.loader, currentPage]);

  const openModModal = async (mod: ModInfo) => {
    setShowSuggestions(false);
    setIsModalLoading(true);
    setSelectedMod({ ...mod, body: "", gallery: [] });
    
    try {
      const [projRes, versionsRes] = await Promise.all([
        fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`),
        fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)
      ]);
      
      const projData = await projRes.json();
      const versionsData = await versionsRes.json();
      
      setSelectedMod({
        ...mod,
        body: projData.body || "",
        gallery: projData.gallery || []
      });
      setModVersions(versionsData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsModalLoading(false);
    }
  };

  const resolveDependencies = async (mod: ModInfo, versionData: any) => {
    const newArtifacts: Record<string, Artifact> = {};
    newArtifacts[mod.project_id] = {
      project_id: mod.project_id,
      version_id: versionData.id,
      title: mod.title,
      isLibrary: false,
      icon_url: mod.icon_url,
      file_url: versionData.files[0]?.url,
      file_name: versionData.files[0]?.filename,
      version_number: versionData.version_number,
    };

    if (versionData.dependencies) {
      for (const dep of versionData.dependencies) {
        if (dep.dependency_type === "required" && dep.project_id) {
          const projRes = await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`);
          const projData = await projRes.json();
          const versionsRes = await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`);
          const versionsData = await versionsRes.json();
          
          if (versionsData && versionsData.length > 0) {
            const libVersion = versionsData[0];
            newArtifacts[dep.project_id] = {
              project_id: dep.project_id,
              version_id: libVersion.id,
              title: projData.title,
              isLibrary: true,
              icon_url: projData.icon_url,
              file_url: libVersion.files[0]?.url,
              file_name: libVersion.files[0]?.filename,
              version_number: libVersion.version_number,
            };
          }
        }
      }
    }

    setModpacks(prev => prev.map(pack => {
      if (pack.id !== activePackId) return pack;
      const merged = { ...pack.artifacts };
      for (const [key, value] of Object.entries(newArtifacts)) {
        if (!merged[key]) merged[key] = value;
      }
      return { ...pack, artifacts: merged };
    }));
  };

  const handleAddMod = async (mod: ModInfo, specificVersion?: any) => {
    setIsAdding(mod.project_id);
    try {
      if (specificVersion) {
        await resolveDependencies(mod, specificVersion);
        setSelectedMod(null);
      } else {
        const versionsRes = await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`);
        const versionsData = await versionsRes.json();
        if (versionsData && versionsData.length > 0) {
          await resolveDependencies(mod, versionsData[0]);
        } else {
          alert("Не найдена версия.");
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAdding(null);
    }
  };

  const removeArtifact = (projectId: string) => {
    setModpacks(prev => prev.map(pack => {
      if (pack.id !== activePackId) return pack;
      const copy = { ...pack.artifacts };
      delete copy[projectId];
      return { ...pack, artifacts: copy };
    }));
  };

  const downloadModpack = async () => {
    const list = Object.values(activePack.artifacts);
    if (list.length === 0) return;
    setIsDownloading(true);
    const zip = new JSZip();
    const modsFolder = zip.folder("mods");
    
    try {
      for (const item of list) {
        if (item.file_url && item.file_name) {
          const res = await fetch(item.file_url);
          const blob = await res.blob();
          modsFolder?.file(item.file_name, blob);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activePack.name.replace(/\s+/g, '_')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const artifactList = Object.values(activePack.artifacts);
  const modsList = artifactList.filter(a => !a.isLibrary);
  const libsList = artifactList.filter(a => a.isLibrary);

  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);
  
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, currentPage + 1);
    
    if (currentPage === 1) end = Math.min(3, totalPages);
    if (currentPage === totalPages) start = Math.max(1, totalPages - 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (!isLoaded) return null; // Ждем загрузки из localStorage

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-green-500/30">
      
      <aside className={`bg-[#0c0c0e] border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden opacity-0"}`}>
        <div className="p-6 flex items-center justify-between min-w-[18rem]">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">ModBuilder</h1>
          <button onClick={createNewPack} className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xl transition-all hover:scale-105 active:scale-95" title="Новая сборка">
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2 custom-scrollbar min-w-[18rem]">
          {modpacks.map(pack => (
            <div 
              key={pack.id}
              onClick={() => setActivePackId(pack.id)}
              className={`relative group w-full text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer ${activePackId === pack.id ? "bg-white/10 shadow-lg scale-[1.02]" : "hover:bg-white/5"}`}
            >
              {editingPackId === pack.id ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => e.key === "Enter" && saveRename()}
                    className="bg-black/50 border border-green-500/50 rounded-lg px-2 py-1 text-sm w-full outline-none"
                  />
                </div>
              ) : (
                <div className="font-bold text-sm truncate pr-14">{pack.name}</div>
              )}
              <div className="text-xs text-zinc-500 mt-1 font-medium">{pack.gameVersion} • {pack.loader.toUpperCase()}</div>
              
              <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => startRenaming(pack.id, pack.name, e)} className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-white/10" title="Переименовать">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={(e) => deletePack(pack.id, e)} className="text-zinc-500 hover:text-red-500 p-1 rounded-md hover:bg-white/10" title="Удалить">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 text-xs font-medium text-center min-w-[18rem] flex flex-col gap-2">
           <button onClick={clearAllData} className="text-zinc-600 hover:text-red-500 transition-colors">
              Очистить все данные
           </button>
           <span className="text-zinc-700">Powered by Modrinth</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        <header className="p-6 sticky top-0 bg-[#09090b]/80 backdrop-blur-xl z-30 flex flex-col gap-5 border-b border-white/5">
          <div className="flex items-center justify-between gap-6 max-w-7xl mx-auto w-full">
            
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>

            <div className="relative flex-1 max-w-3xl" ref={searchRef}>
              <div className="flex items-center gap-3 relative z-50">
                <input
                  type="text"
                  placeholder="Поиск модов... (или оставьте пустым для топа)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-green-500/50 focus:bg-white/10 text-sm transition-all shadow-sm pr-32"
                />
                <label className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors z-10 bg-[#09090b]/80 px-2 py-1 rounded-lg">
                  <input 
                    type="checkbox" 
                    checked={searchInBody}
                    onChange={(e) => setSearchInBody(e.target.checked)}
                    className="w-4 h-4 accent-green-500 rounded border-white/20 bg-white/5 cursor-pointer"
                  />
                  Искать в описании
                </label>
              </div>
              
              {showSuggestions && results.length > 0 && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[#151519] border border-white/10 rounded-2xl shadow-2xl max-h-[28rem] overflow-y-auto z-50 p-2 animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                  {results.slice(0, 5).map(mod => (
                    <div key={mod.project_id} onClick={() => openModModal(mod)} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative">
                        <Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{mod.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{mod.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <select value={activePack.gameVersion} onChange={(e) => updateActivePack({ gameVersion: e.target.value, artifacts: {} })} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-green-500/50 cursor-pointer">
                <option value="1.20.1">1.20.1</option>
                <option value="1.19.2">1.19.2</option>
                <option value="1.16.5">1.16.5</option>
                <option value="1.12.2">1.12.2</option>
              </select>
              <select value={activePack.loader} onChange={(e) => updateActivePack({ loader: e.target.value, artifacts: {} })} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-green-500/50 cursor-pointer">
                <option value="forge">Forge</option>
                <option value="fabric">Fabric</option>
                <option value="quilt">Quilt</option>
              </select>

              <button 
                onClick={() => setIsPackOpen(true)}
                className="bg-green-500 hover:bg-green-400 text-black px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                Сборка ({modsList.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center max-w-7xl mx-auto w-full">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200 border ${
                  selectedCategories.includes(cat.id)
                    ? "bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.15)]"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative" ref={scrollRef}>
          {isLoading && (
            <div className="absolute inset-0 bg-[#09090b]/50 backdrop-blur-sm z-20 flex items-start justify-center pt-32">
               <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            {!isLoading && !query.trim() && selectedCategories.length === 0 && (
              <div className="mb-4 text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                 Топ популярных модов
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {results.map((mod, i) => (
                <div 
                  key={mod.project_id} 
                  className="flex flex-col gap-4 bg-white/[0.03] border border-white/5 p-5 rounded-[1.5rem] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer group shadow-xl hover:shadow-[0_10px_40px_-10px_rgba(34,197,94,0.15)] hover:-translate-y-1 relative overflow-hidden"
                  onClick={(e) => { e.stopPropagation(); openModModal(mod); }}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-lg group-hover:scale-105 transition-transform duration-300">
                        <Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-zinc-100 truncate pr-2 leading-tight">{mod.title}</h3>
                        <div className="text-xs font-medium text-zinc-400 mt-1.5 flex items-center gap-1.5 bg-black/30 w-fit px-2 py-0.5 rounded-md">
                          <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                          {mod.downloads.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed flex-1 relative z-10">{mod.description}</p>
                  
                  <div className="flex justify-end mt-2 relative z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddMod(mod); }}
                      disabled={isAdding === mod.project_id}
                      className="bg-white/5 hover:bg-green-500 hover:text-black text-zinc-300 h-10 px-5 flex items-center justify-center rounded-xl font-bold transition-all duration-200 shrink-0 shadow-sm gap-2 text-sm"
                    >
                      {isAdding === mod.project_id ? (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div>
                      ) : activePack.artifacts[mod.project_id] ? (
                        <>Добавлено</>
                      ) : (
                        <>+ В сборку</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 mb-6 flex items-center justify-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
                >
                  ←
                </button>

                {getPageNumbers()[0] > 1 && (
                  <>
                    <button onClick={() => setCurrentPage(1)} className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors ${currentPage === 1 ? 'bg-green-500 text-black' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}>1</button>
                    {getPageNumbers()[0] > 2 && <span className="text-zinc-600">...</span>}
                  </>
                )}

                {getPageNumbers().map(page => (
                  <button 
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors ${currentPage === page ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}
                  >
                    {page}
                  </button>
                ))}

                {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                  <>
                    {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && <span className="text-zinc-600">...</span>}
                    <button onClick={() => setCurrentPage(totalPages)} className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors ${currentPage === totalPages ? 'bg-green-500 text-black' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}>{totalPages}</button>
                  </>
                )}

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <div 
        className={`fixed inset-y-0 right-0 w-[28rem] bg-[#0c0c0e] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">{activePack.name}</h2>
            <div className="text-xs text-zinc-500 font-medium mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> {modsList.length} модов</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {libsList.length} библиотек</span>
            </div>
          </div>
          <button onClick={() => setIsPackOpen(false)} className="bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {modsList.length === 0 ? (
            <div className="text-center py-20 text-zinc-600 text-sm flex flex-col items-center">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
              Пусто. Добавь что-нибудь!
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Моды</h3>
                <ul className="space-y-3">
                  {modsList.map(mod => (
                    <li key={mod.project_id} className="flex items-center gap-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative shadow-sm">
                        <Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate text-zinc-200">{mod.title}</div>
                        <div className="text-xs text-zinc-500 truncate mt-0.5">{mod.version_number}</div>
                      </div>
                      <button onClick={() => removeArtifact(mod.project_id)} className="text-zinc-600 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {libsList.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    Библиотеки <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px]">Авто</span>
                  </h3>
                  <ul className="space-y-3">
                    {libsList.map(lib => (
                      <li key={lib.project_id} className="flex items-center gap-4 bg-white/[0.01] p-3 rounded-2xl border border-white/[0.02] hover:border-white/10 transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden relative opacity-60">
                          <Image src={lib.icon_url || '/placeholder.png'} alt={lib.title} fill className="object-cover" unoptimized />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate text-zinc-400">{lib.title}</div>
                          <div className="text-[10px] text-zinc-600 truncate mt-0.5">{lib.version_number}</div>
                        </div>
                        <button onClick={() => removeArtifact(lib.project_id)} className="text-zinc-700 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0c0c0e]">
          <button 
            onClick={downloadModpack}
            disabled={isDownloading || artifactList.length === 0}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-white/5 disabled:text-zinc-600 text-black px-6 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isDownloading ? "Собираем..." : "Скачать .zip"}
          </button>
        </div>
      </div>

      {isPackOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsPackOpen(false)}></div>
      )}

      {selectedMod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200" onClick={() => setSelectedMod(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 md:p-10 border-b border-white/5 flex items-start gap-8 bg-gradient-to-br from-white/[0.04] to-transparent relative">
              <div className="w-32 h-32 rounded-3xl bg-zinc-800 overflow-hidden relative shadow-2xl shrink-0 border border-white/10">
                <Image src={selectedMod.icon_url || '/placeholder.png'} alt={selectedMod.title} fill className="object-cover" unoptimized />
              </div>
              <div className="flex-1">
                <h2 className="text-4xl font-black">{selectedMod.title}</h2>
                <p className="text-zinc-400 mt-4 leading-relaxed text-base max-w-2xl">{selectedMod.description}</p>
                <div className="flex gap-6 mt-6 text-sm font-medium text-zinc-400">
                  <span className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> {selectedMod.downloads.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMod(null)} className="absolute top-8 right-8 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 w-12 h-12 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>
            
            <div className="p-8 md:p-10 overflow-y-auto flex-1 custom-scrollbar grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              <div className="lg:col-span-2 space-y-8">
                {selectedMod.gallery && selectedMod.gallery.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Галерея</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedMod.gallery.map((img, idx) => (
                        <div key={idx} className="rounded-xl overflow-hidden relative border border-white/10 shadow-lg aspect-video group">
                          <Image src={img.url} alt={img.title || "Gallery image"} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                          {img.title && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              {img.title}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMod.body && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Описание</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                      {selectedMod.body.split('\n').map((paragraph, idx) => (
                        <p key={idx} className="mb-4 last:mb-0 whitespace-pre-wrap">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Версии для {activePack.gameVersion}</h3>
                {isModalLoading ? (
                  <div className="flex items-center justify-center py-20 text-green-500 gap-4">
                    <div className="w-6 h-6 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                  </div>
                ) : modVersions.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-sm bg-white/[0.02] rounded-xl border border-white/5">Нет версий</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {modVersions.map(v => (
                      <div key={v.id} className="flex flex-col justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-green-500/30 transition-colors group">
                        <div>
                          <div className="font-bold text-sm text-zinc-200">{v.name}</div>
                          <div className="text-xs text-zinc-500 mt-1 font-medium">{v.version_number}</div>
                        </div>
                        <button 
                          onClick={() => handleAddMod(selectedMod, v)}
                          disabled={isAdding === selectedMod.project_id || !!activePack.artifacts[selectedMod.project_id]}
                          className="mt-3 w-full bg-white/5 hover:bg-green-500 hover:text-black text-zinc-300 disabled:bg-white/[0.02] disabled:text-zinc-600 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200"
                        >
                          {activePack.artifacts[selectedMod.project_id] ? "Уже в сборке" : "Добавить"}
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}