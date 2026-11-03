"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { supabase } from "./supabase";

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

const CustomSelect = ({ value, options, onChange, widthClass = "w-32" }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void, widthClass?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${widthClass}`} ref={ref}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-green-500/50"
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#151519] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 min-w-[120%] animate-in fade-in slide-in-from-top-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${value === opt.value ? "bg-white/5 text-green-400 font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"}`}
            >
              {opt.label}
              {value === opt.value && (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              )}
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

  // 1. Инициализация и проверка входа
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        loadLocalPacks(); // Гость
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        loadLocalPacks();
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // 2. Загрузка сборок при входе
  useEffect(() => {
    if (user) {
      fetchModpacksFromDB();
    }
  }, [user]);

  const loadLocalPacks = () => {
    const saved = localStorage.getItem("modbuilder_packs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setModpacks(parsed);
          setActivePackId(parsed[0].id);
        }
      } catch (e) {}
    } else {
      createNewPack(true); // Если вообще ничего нет
    }
    setIsLoaded(true);
  };

  const fetchModpacksFromDB = async () => {
    try {
      const { data, error } = await supabase.from('modpacks').select('*').order('created_at', { ascending: true });
      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map(d => ({
          id: d.id,
          name: d.name,
          gameVersion: d.game_version,
          loader: d.loader,
          artifacts: d.artifacts || {}
        }));
        setModpacks(formatted);
        setActivePackId(formatted[0].id);
      } else {
        createNewPack(true); // Если в базе пусто - создаем новую
      }
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveToDB = async (updatedPacks: Modpack[], currentActiveId: string) => {
    if (!user) {
      localStorage.setItem("modbuilder_packs", JSON.stringify(updatedPacks));
      localStorage.setItem("modbuilder_active_id", currentActiveId);
      return;
    }

    const pack = updatedPacks.find(p => p.id === currentActiveId);
    if (!pack) return;

    try {
      await supabase.from('modpacks').upsert({
        id: pack.id,
        user_id: user.id,
        name: pack.name,
        game_version: pack.gameVersion,
        loader: pack.loader,
        artifacts: pack.artifacts
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateActivePack = (updates: Partial<Modpack>) => {
    const newPacks = modpacks.map(p => p.id === activePackId ? { ...p, ...updates } : p);
    setModpacks(newPacks);
    saveToDB(newPacks, activePackId);
  };

  const createNewPack = async (isInitial = false) => {
    const newId = isInitial ? crypto.randomUUID() : Date.now().toString();
    const newPack = { id: newId, name: isInitial ? "Моя первая сборка" : "Новая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {} };
    const newPacks = [...modpacks, newPack];
    setModpacks(newPacks);
    setActivePackId(newId);
    setIsSidebarOpen(true);
    
    if (user) {
      try {
        await supabase.from('modpacks').insert({
          id: newId,
          user_id: user.id,
          name: newPack.name,
          game_version: newPack.gameVersion,
          loader: newPack.loader,
          artifacts: {}
        });
      } catch(e) { console.error(e); }
    } else {
      saveToDB(newPacks, newId);
    }
  };

  const deletePack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (modpacks.length === 1) {
      alert("Нельзя удалить последнюю сборку.");
      return;
    }
    if (confirm("Удалить эту сборку?")) {
      const newPacks = modpacks.filter(p => p.id !== id);
      setModpacks(newPacks);
      if (activePackId === id) setActivePackId(newPacks[0].id);
      
      if (user) {
        await supabase.from('modpacks').delete().eq('id', id);
      } else {
        saveToDB(newPacks, newPacks[0].id);
      }
    }
  };

  const loginWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Остальная логика поиска и модов...
  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
    setCurrentPage(1);
  };

  const fetchMods = async (searchQuery: string, page: number) => {
    setIsLoading(true);
    try {
      const facets = [
        [`versions:${activePack?.gameVersion || "1.16.5"}`],
        [`categories:${activePack?.loader || "forge"}`],
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

  // Запуск поиска при изменении фильтров или активной сборки
  useEffect(() => {
    if (isLoaded && activePack) {
      setCurrentPage(1);
      fetchMods(query, 1);
    }
  }, [query, searchInBody, selectedCategories, activePack?.gameVersion, activePack?.loader, currentPage, isLoaded]);

  // Отрисовка интерфейса...
  if (!isLoaded) return null;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter(a => !a.isLibrary);
  const libsList = artifactList.filter(a => a.isLibrary);

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-green-500/30">
      
      <aside className={`bg-[#0c0c0e] border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden opacity-0"}`}>
        <div className="p-6 flex items-center justify-between min-w-[18rem]">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">ModBuilder</h1>
          <button onClick={() => createNewPack()} className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xl transition-all hover:scale-105 active:scale-95" title="Новая сборка">
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
              <div className="font-bold text-sm truncate pr-14">{pack.name}</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">{pack.gameVersion} • {pack.loader.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div className="p-5 text-xs font-medium text-center min-w-[18rem] flex flex-col gap-4">
           {user ? (
             <div className="bg-white/5 p-3 rounded-xl border border-white/10">
               <div className="text-green-400 mb-1">Вы вошли как:</div>
               <div className="truncate font-bold text-white">{user.email}</div>
               <button onClick={logout} className="mt-2 text-zinc-400 hover:text-white bg-white/10 px-3 py-1 rounded-lg w-full transition-colors">Выйти</button>
             </div>
           ) : (
             <button onClick={loginWithGitHub} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/10 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg">
               Войти
             </button>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        <header className="p-6 sticky top-0 bg-[#09090b]/80 backdrop-blur-xl z-30 flex flex-col gap-5 border-b border-white/5">
          <div className="flex items-center justify-between gap-6 max-w-7xl mx-auto w-full">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>

            <div className="relative flex-1 max-w-3xl" ref={searchRef}>
              <div className="flex items-center gap-3 relative z-50">
                <input
                  type="text"
                  placeholder="Поиск модов... (или оставьте пустым для топа)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-green-500/50 focus:bg-white/10 text-sm transition-all shadow-sm pr-32"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <CustomSelect 
                value={activePack?.gameVersion || "1.16.5"}
                onChange={(val) => { updateActivePack({ gameVersion: val, artifacts: {} }); }}
                options={[
                  { value: "1.20.1", label: "1.20.1" },
                  { value: "1.19.2", label: "1.19.2" },
                  { value: "1.16.5", label: "1.16.5" },
                  { value: "1.12.2", label: "1.12.2" },
                ]}
                widthClass="w-32"
              />
              <CustomSelect 
                value={activePack?.loader || "forge"}
                onChange={(val) => { updateActivePack({ loader: val, artifacts: {} }); }}
                options={[
                  { value: "forge", label: "Forge" },
                  { value: "fabric", label: "Fabric" },
                  { value: "quilt", label: "Quilt" },
                ]}
                widthClass="w-32"
              />
              <button onClick={() => setIsPackOpen(true)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2">
                Сборка ({modsList.length})
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative" ref={scrollRef}>
          {isLoading && (
            <div className="absolute inset-0 bg-[#09090b]/50 backdrop-blur-sm z-20 flex items-start justify-center pt-32">
               <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            {!isLoading && results.length === 0 && (
              <div className="text-center py-32 text-zinc-600 flex flex-col items-center">
                <div className="text-5xl mb-4">🔍</div>
                <p>Введите название мода или выберите категорию</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {results.map((mod, i) => (
                <div key={mod.project_id} className="flex flex-col gap-4 bg-white/[0.03] border border-white/5 p-5 rounded-[1.5rem] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 group shadow-xl">
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-lg">
                        <Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-zinc-100 truncate pr-2 leading-tight">{mod.title}</h3>
                        <div className="text-xs font-medium text-zinc-400 mt-1.5 flex items-center gap-1.5 bg-black/30 w-fit px-2 py-0.5 rounded-md">
                          ⬇ {mod.downloads.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed flex-1">{mod.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}