"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { supabase } from "./supabase";
import { marked } from "marked";
import DOMPurify from "dompurify";

const ADMIN_ID = "4605b485-35e3-4592-b082-781339760840";

type ModInfo = { project_id: string; title: string; icon_url: string; description: string; downloads: number; categories: string[]; };
type FullModInfo = ModInfo & { body: string; gallery: { url: string; featured: boolean; title?: string }[]; };
type Artifact = { project_id: string; version_id: string; title: string; isLibrary: boolean; icon_url?: string; file_url?: string; file_name?: string; version_number?: string; };
type Modpack = { id: string; name: string; gameVersion: string; loader: string; artifacts: Record<string, Artifact>; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; published_id?: string; };
type PublishedPack = { id: string; user_id: string; name: string; game_version: string; loader: string; artifacts: Record<string, Artifact>; downloads: number; likes: number; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; profiles: { username: string; avatar_url: string; title: string; frame?: string } };

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

const FRAMES = [
  { id: "default", label: "Без рамки", icon: "" },
  { id: "flowers", label: "Цветочная", icon: "/frames/flowers.png" },
  { id: "neon", label: "Неоновая", icon: "/frames/neon.png" },
  { id: "halloween", label: "Хэллоуин", icon: "/frames/halloween.png" },
  { id: "snow", label: "Зимняя", icon: "/frames/snow.png" },
];

const ITEMS_PER_PAGE = 20;
const CATALOG_PER_PAGE = 9;

const CustomSelect = ({ value, options, onChange, widthClass = "w-40" }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void, widthClass?: string }) => {
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
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-black/30 backdrop-blur-md hover:bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-green-500/50 text-white">
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#121214] border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 min-w-[120%] animate-in fade-in slide-in-from-top-2">
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

const AvatarWithFrame = ({ url, frame, size = "w-10 h-10" }: { url?: string, frame?: string, size?: string }) => {
  const frameFile = FRAMES.find(f => f.id === frame)?.icon;
  return (
    <div className={`relative ${size} shrink-0 rounded-full overflow-hidden border border-white/10 bg-zinc-900`}>
      <div className="absolute inset-1 rounded-full overflow-hidden">
        {url ? <Image src={url} alt="avatar" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-lg">👤</div>}
      </div>
      {frameFile && (
        <Image src={frameFile} alt="frame" fill className="absolute inset-0 object-contain p-0.5 pointer-events-none" unoptimized />
      )}
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  const borderColor = type === 'success' ? 'border-l-green-500' : type === 'error' ? 'border-l-red-500' : 'border-l-blue-500';
  return (
    <div className={`fixed top-6 right-6 px-5 py-3 rounded-r-xl rounded-l-md bg-[#121214]/95 border border-white/10 border-l-4 ${borderColor} shadow-2xl z-[100] animate-in slide-in-from-top-5 flex items-center gap-3 font-medium text-sm text-zinc-200 backdrop-blur-xl`}>
      {type === 'success' && <span className="text-green-500 text-lg">✓</span>}
      {type === 'error' && <span className="text-red-500 text-lg">✕</span>}
      {message}
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
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "gallery" | "files">("description");
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type });

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const translateDescription = async (markdown: string) => {
    try {
      const rawHtml = marked.parse(markdown) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = cleanHtml;
      
      const textNodes: Node[] = [];
      const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent && node.textContent.trim().length > 0) {
          textNodes.push(node);
        }
      }

      if (textNodes.length === 0) return;

      const delimiter = " ||| ";
      const combinedText = textNodes.map(n => n.textContent?.trim() || "").join(delimiter);

      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(combinedText.substring(0, 4000))}`);
      const data = await res.json();
      const translatedFull = data[0].map((item: any) => item[0]).join("");
      const translatedParts = translatedFull.split(delimiter);

      textNodes.forEach((n, i) => {
        if (translatedParts[i]) {
          n.textContent = translatedParts[i].trim();
        }
      });

      setTranslatedDesc(DOMPurify.sanitize(tempDiv.innerHTML));
    } catch (e) {
      showToast("Ошибка перевода", "error");
    }
  };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  
  const [catalog, setCatalog] = useState<PublishedPack[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState<string>("all");
  const [catalogLoader, setCatalogLoader] = useState<string>("all");
  const [catalogSort, setCatalogSort] = useState<string>("newest");
  const [catalogPage, setCatalogPage] = useState(1);
  
  const [selectedMod, setSelectedMod] = useState<FullModInfo | null>(null);
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  
  const [viewingPack, setViewingPack] = useState<PublishedPack | null>(null);
  const [likedPacks, setLikedPacks] = useState<string[]>([]);

  const [isPackOpen, setIsPackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const activePack = modpacks.find(p => p.id === activePackId) || modpacks[0];

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) { setDbError(error.message); return; }
    if (data) { setProfile(data); } 
    else {
      const newProfile = { id: userId, username: "Игрок", title: "Новичок", avatar_url: null, frame: "default" };
      const { error: insertError } = await supabase.from('profiles').insert(newProfile);
      if (insertError) setDbError(insertError.message);
      else setProfile(newProfile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setUser(session?.user ?? null); 
      setIsLoggingIn(false);
      if(session?.user) {
        fetchProfile(session.user.id);
        fetchUserLikes(session.user.id);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { 
      setUser(session?.user ?? null); 
      if (event === 'SIGNED_IN') { setIsLoggingIn(false); fetchProfile(session!.user.id); fetchUserLikes(session!.user.id); }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserLikes = async (userId: string) => {
    const { data } = await supabase.from('pack_likes').select('pack_id').eq('user_id', userId);
    if (data) setLikedPacks(data.map(d => d.pack_id));
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: data.publicUrl, username: profile?.username || "Игрок", title: profile?.title || "Новичок", frame: profile?.frame || "default" });
      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, avatar_url: data.publicUrl }));
      fetchProfile(user.id);
      showToast("Аватарка обновлена!", "success");
    } catch (error: any) { showToast(error.message || "Ошибка загрузки", "error"); } 
    finally { setIsUploading(false); }
  };

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cover-${packId}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('covers').getPublicUrl(fileName);
      
      const newPacks = modpacks.map(p => p.id === packId ? { ...p, cover_url: data.publicUrl } : p);
      setModpacks(newPacks);
      await saveToDB(newPacks, packId);
      
      if (activePack?.id === packId && activePack.published_id) {
          await supabase.from('published_packs').update({ cover_url: data.publicUrl }).eq('id', activePack.published_id);
          fetchCatalog();
      }
      showToast("Обложка загружена!", "success");
    } catch (error: any) { showToast("Ошибка загрузки обложки: " + error.message, "error"); }
  };

  const uploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `screen-${packId}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('covers').getPublicUrl(fileName);
      
      const pack = modpacks.find(p => p.id === packId);
      const currentScreens = pack?.screenshots || [];
      const newScreens = [...currentScreens, data.publicUrl];

      const newPacks = modpacks.map(p => p.id === packId ? { ...p, screenshots: newScreens } : p);
      setModpacks(newPacks);
      await saveToDB(newPacks, packId);
      
      if (activePack?.id === packId && activePack.published_id) {
          await supabase.from('published_packs').update({ screenshots: newScreens }).eq('id', activePack.published_id);
          fetchCatalog();
      }
      showToast("Скриншот добавлен!", "success");
    } catch (error: any) { showToast("Ошибка загрузки скриншота: " + error.message, "error"); }
  };

  const saveProfile = async (updates: any) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').upsert({ 
      id: user.id, 
      username: updates.username, 
      title: profile?.title || "Новичок", 
      avatar_url: profile?.avatar_url || null,
      frame: updates.frame !== undefined ? updates.frame : profile?.frame || "default"
    });
    if (error) showToast("Ошибка сохранения: " + error.message, "error");
    else {
      setProfile((prev: any) => ({ ...prev, ...updates }));
      fetchProfile(user.id);
      showToast("Профиль сохранен!", "success");
    }
  };

  const toggleLike = async (packId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return showToast("Войдите, чтобы ставить лайки", "error");
    
    const isLiked = likedPacks.includes(packId);
    try {
      if (isLiked) {
        await supabase.from('pack_likes').delete().eq('pack_id', packId).eq('user_id', user.id);
        await supabase.from('published_packs').update({ likes: (viewingPack?.likes || 1) - 1 }).eq('id', packId);
        setLikedPacks(prev => prev.filter(id => id !== packId));
        if (viewingPack) setViewingPack({ ...viewingPack, likes: viewingPack.likes - 1 });
      } else {
        await supabase.from('pack_likes').insert({ pack_id: packId, user_id: user.id });
        await supabase.from('published_packs').update({ likes: (viewingPack?.likes || 0) + 1 }).eq('id', packId);
        setLikedPacks(prev => [...prev, packId]);
        if (viewingPack) setViewingPack({ ...viewingPack, likes: viewingPack.likes + 1 });
      }
      fetchCatalog();
    } catch (e: any) { showToast("Ошибка лайка: " + e.message, "error"); }
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
    setCatalogError(null);
    try {
      const { data: packs, error: packsError } = await supabase.from('published_packs').select('*').order('created_at', { ascending: false });
      if (packsError) throw packsError;
      if (!packs || packs.length === 0) { setCatalog([]); return; }

      const userIds = [...new Set(packs.map(p => p.user_id))];
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, username, avatar_url, title, frame').in('id', userIds);
      if (profilesError) throw profilesError;

      const combined = packs.map(pack => {
        const author = profiles?.find(pr => pr.id === pack.user_id);
        return { ...pack, profiles: author || { username: 'Неизвестный', avatar_url: '', title: 'Новичок', frame: 'default' } };
      });
      setCatalog(combined as any);
    } catch (err: any) { setCatalogError(err.message || "Ошибка каталога"); }
  };

  const fetchFromDB = async () => {
    try {
      const { data } = await supabase.from('modpacks').select('*').order('created_at', { ascending: true });
      if (data && data.length > 0) { 
        setModpacks(data.map(d => ({ 
          id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {}, 
          cover_url: d.cover_url || undefined, description: d.description || undefined, screenshots: d.screenshots || [], video_url: d.video_url || undefined,
          published_id: d.published_id || undefined
        }))); 
        setActivePackId(data[0].id); 
      }
      else { createNewPack(true, user); }
    } catch(e) { console.error("Fetch error:", e); showToast("Ошибка загрузки сборок", "error"); } setIsLoaded(true);
  };

  const saveToDB = async (newPacks: Modpack[], currentId: string) => {
    if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return; }
    const pack = newPacks.find(p => p.id === currentId); if (!pack) return;
    try { 
      const { error } = await supabase.from('modpacks').upsert({ 
        id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: pack.artifacts || {},
        description: pack.description || null, screenshots: pack.screenshots || [], cover_url: pack.cover_url || null, video_url: pack.video_url || null,
        published_id: pack.published_id || null
      }); 
      if (error) { console.error("Save error:", error); showToast("Ошибка сохранения: " + error.message, "error"); }
    } catch(e) { console.error(e); }
  };

  const createNewPack = async (isInitial = false, currentUser = user) => {
    const newId = crypto.randomUUID();
    const newPack = { 
      id: newId, 
      name: isInitial ? "Моя сборка" : "Новая сборка", 
      gameVersion: "1.16.5", 
      loader: "forge", 
      artifacts: {}, 
      screenshots: [], 
      cover_url: undefined, 
      description: "", 
      video_url: "" 
    };
    const newPacks = [...modpacks, newPack];
    setModpacks(newPacks); setActivePackId(newId); setIsSidebarOpen(true);
    if (currentUser) { 
      try { 
        await supabase.from('modpacks').insert({ 
          id: newId, 
          user_id: currentUser.id, 
          name: newPack.name, 
          game_version: newPack.gameVersion, 
          loader: newPack.loader, 
          artifacts: {},
          description: "",
          screenshots: []
        }); 
      } catch(e) {} 
    } else { 
      localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); 
    }
  };

  const publishPack = async () => {
    if (!user || !activePack || Object.keys(activePack.artifacts).length === 0) return showToast("Сначала добавьте моды в сборку!", "error");
    if (!activePack.description || activePack.description.trim() === "") return showToast("Добавьте описание перед публикацией!", "error");
    
    try {
      if (activePack.published_id) {
        // Обновляем существующую
        const { error } = await supabase.from('published_packs').update({
          name: activePack.name,
          game_version: activePack.gameVersion,
          loader: activePack.loader,
          artifacts: activePack.artifacts,
          cover_url: activePack.cover_url,
          description: activePack.description,
          screenshots: activePack.screenshots || [],
          video_url: activePack.video_url
        }).eq('id', activePack.published_id);
        if (error) throw error;
        showToast("Сборка обновлена в каталоге!", "success");
      } else {
        // Создаем новую
        const { data: insertedData, error } = await supabase.from('published_packs').insert({
          user_id: user.id,
          name: activePack.name,
          game_version: activePack.gameVersion,
          loader: activePack.loader,
          artifacts: activePack.artifacts,
          cover_url: activePack.cover_url,
          description: activePack.description,
          screenshots: activePack.screenshots || [],
          video_url: activePack.video_url
        }).select();
        if (error) throw error;
        
        if (insertedData && (insertedData as any)[0]) {
          const pubId = (insertedData as any)[0].id;
          const newPacks = modpacks.map(p => p.id === activePackId ? { ...p, published_id: pubId } : p);
          setModpacks(newPacks);
          await saveToDB(newPacks, activePackId);
        }
        showToast("Сборка опубликована в каталоге!", "success");
      }
      setIsPublishModalOpen(false);
      fetchCatalog();
    } catch(e: any) { showToast("Ошибка: " + e.message, "error"); }
  };

  const importPack = async (pack: PublishedPack) => {
    const newId = crypto.randomUUID();
    const newPack = { 
      id: newId, name: `Копия: ${pack.name}`, gameVersion: pack.game_version, loader: pack.loader, artifacts: pack.artifacts, 
      cover_url: pack.cover_url, description: pack.description, screenshots: pack.screenshots, video_url: pack.video_url
    };
    const newPacks = [...modpacks, newPack];
    setModpacks(newPacks); setActivePackId(newId); saveToDB(newPacks, newId);
    try {
      await supabase.from('published_packs').update({ downloads: (pack.downloads || 0) + 1 }).eq('id', pack.id);
      fetchCatalog();
    } catch(e) { console.error(e); }
    showToast("Сборка добавлена в ваш личный кабинет!", "success");
    setView("mods");
  };

  const deleteFromCatalog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить эту сборку из каталога?")) {
      try {
        const { error } = await supabase.from('published_packs').delete().eq('id', id);
        if (error) throw error;
        fetchCatalog();
        showToast("Сборка удалена из каталога", "success");
      } catch (e: any) { showToast("Ошибка удаления: " + e.message, "error"); }
    }
  };

  const deletePack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (modpacks.length === 1) return showToast("Нельзя удалить последнюю сборку", "error");
    if (confirm("Удалить эту сборку?")) {
      const newPacks = modpacks.filter(p => p.id !== id);
      setModpacks(newPacks);
      if (activePackId === id) setActivePackId(newPacks[0].id);
      if (user) { await supabase.from('modpacks').delete().eq('id', id); } 
      else { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); }
      showToast("Сборка удалена", "success");
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
    setTranslatedDesc(null);
    try {
      const [projRes, verRes] = await Promise.all([ fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`), fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`) ]);
      const projData = await projRes.json(); const verData = await verRes.json();
      setSelectedMod({ ...mod, body: projData.body || "", gallery: projData.gallery || [] }); setModVersions(verData || []);
      if (projData.body) { translateDescription(projData.body); }
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
      if (!verRes) return showToast("Версия не найдена", "error");
      
      const newArtifacts: Record<string, Artifact> = { [mod.project_id]: { project_id: mod.project_id, version_id: verRes.id, title: mod.title, isLibrary: false, icon_url: mod.icon_url || "", file_url: verRes.files[0]?.url || "", file_name: verRes.files[0]?.filename || "", version_number: verRes.version_number || "" } };
      
      if (verRes.dependencies) {
        for (const dep of verRes.dependencies) {
          if (dep.dependency_type === "required" && dep.project_id) {
            const libProj = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`)).json();
            const libVersions = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json();
            const libVer = libVersions[0];
            if (libVer) newArtifacts[dep.project_id] = { project_id: dep.project_id, version_id: libVer.id, title: libProj.title, isLibrary: true, icon_url: libProj.icon_url || "", file_url: libVer.files[0]?.url || "", file_name: libVer.files[0]?.filename || "", version_number: libVer.version_number || "" };
          }
        }
      }
      
      const newPacks = modpacks.map(p => { if (p.id !== activePackId) return p; return { ...p, artifacts: { ...p.artifacts, ...newArtifacts } }; });
      setModpacks(newPacks); await saveToDB(newPacks, activePackId); setSelectedMod(null);
      showToast("Мод добавлен в сборку", "success");
    } catch(e) {} finally { setIsAdding(null); }
  };

  const removeArtifact = (id: string) => { const newPacks = modpacks.map(p => { if (p.id !== activePackId) return p; const copy = { ...p.artifacts }; delete copy[id]; return { ...p, artifacts: copy }; }); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const downloadModpack = async (pack: Modpack) => { const list = Object.values(pack.artifacts); if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.zip`; a.click(); } catch(e) {} finally { setIsDownloading(false); } };

  const login = (provider: 'github' | 'email' | 'google' = 'github') => { 
    setIsLoggingIn(true); 
    if (provider === 'github') {
      supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } }); 
    } else if (provider === 'google') {
      supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); 
    } else {
      supabase.auth.signInWithOtp({ email: prompt("Введите ваш Email:") || "" }).then(({ error }) => {
        if (error) { showToast(error.message, "error"); setIsLoggingIn(false); }
        else { showToast("Проверьте почту для входа!", "success"); setIsLoggingIn(false); }
      });
    }
  };
  const logout = () => supabase.auth.signOut();
  
  if (!isLoaded) return <div className="h-screen bg-[#09090b] text-white flex items-center justify-center">Загрузка...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter(a => !a.isLibrary);
  const libsList = artifactList.filter(a => a.isLibrary);
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);

  let filteredCatalog = catalog.filter(pack => {
    const matchVersion = catalogVersion === "all" || pack.game_version === catalogVersion;
    const matchLoader = catalogLoader === "all" || pack.loader === catalogLoader;
    return matchVersion && matchLoader;
  });

  if (catalogSort === "downloads") {
    filteredCatalog.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  }

  const totalCatalogPages = Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE);
  const paginatedCatalog = filteredCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE);

  const getYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="flex h-screen text-white font-sans overflow-hidden relative selection:bg-green-500/30">
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg.png')" }}></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {isLoggingIn && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Вход...</h2>
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
             <div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center gap-3">
               <AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" />
               <div className="flex-1 min-w-0">
                 <div className="text-green-400 text-xs mb-0.5">Вы вошли:</div>
                 <div className="truncate font-bold text-sm text-white">{profile?.username || user.email}</div>
               </div>
               <button onClick={logout} className="text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-xs transition-colors">Выйти</button>
             </div>
           ) : (
             <div className="flex flex-col gap-2">
               <button onClick={() => login('github')} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/20 text-white px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Войти через GitHub</button>
               <button onClick={() => login('google')} className="bg-white hover:bg-gray-200 text-black border border-white/20 px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors flex items-center justify-center gap-2">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 01-2.393 3.621v3.011h3.874c2.267-2.088 3.58-5.163 3.58-8.819z" fill="#4285F4"/><path d="M12 24c3.24 0 5.956-1.075 7.941-2.909l-3.874-3.011c-1.075.72-2.45 1.149-4.067 1.149-3.126 0-5.77-2.112-6.715-4.947H1.276v3.111A11.995 11.995 0 0012 24z" fill="#34A853"/><path d="M5.285 14.282A7.19 7.19 0 014.886 12c0-.794.136-1.564.399-2.282V6.607H1.276A11.995 11.995 0 000 12c0 1.94.464 3.775 1.276 5.393l4.009-3.111z" fill="#FBBC05"/><path d="M12 4.771c1.762 0 3.343.605 4.586 1.794l3.437-3.437C17.951 1.182 15.235 0 12 0 7.302 0 3.232 2.693 1.276 6.607l4.009 3.111C6.23 6.883 8.874 4.771 12 4.771z" fill="#EA4335"/></svg>
                 Войти через Google
               </button>
             </div>
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
              {totalPages > 1 && (
                <div className="flex flex-wrap justify-center items-center gap-4 mt-8">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">← Назад</button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400 font-bold">Страница</span>
                    <input 
                      type="number" 
                      value={currentPage} 
                      onChange={(e) => { const val = Number(e.target.value); if (val >= 1 && val <= totalPages) setCurrentPage(val); }}
                      className="w-16 bg-black/50 border border-white/20 rounded-xl px-2 py-2 text-center text-white font-bold focus:outline-none focus:border-green-500"
                      min={1}
                      max={totalPages}
                    />
                    <span className="text-sm text-zinc-400 font-bold">из {totalPages}</span>
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Вперед →</button>
                </div>
              )}
            </div>
          </>
        )}

        {view === "catalog" && (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">Каталог сборок</h2>
            
            <div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md relative z-20">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold ml-1">Версия игры</span>
                <CustomSelect value={catalogVersion} onChange={(v) => { setCatalogVersion(v); setCatalogPage(1); }} options={[{ value: "all", label: "Все версии" }, { value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold ml-1">Загрузчик</span>
                <CustomSelect value={catalogLoader} onChange={(v) => { setCatalogLoader(v); setCatalogPage(1); }} options={[{ value: "all", label: "Все" }, { value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold ml-1">Сортировка</span>
                <CustomSelect value={catalogSort} onChange={(v) => { setCatalogSort(v); setCatalogPage(1); }} options={[{ value: "newest", label: "Сначала новые" }, { value: "downloads", label: "По скачиваниям" }]} />
              </div>
            </div>

            {catalogError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">Ошибка загрузки каталога: {catalogError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedCatalog.map(pack => (
                <div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/80 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-green-500/50 transition-all hover:-translate-y-1">
                  
                  <div className="w-full h-48 bg-zinc-800 relative border-b border-white/10">
                    {pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">🖼️</div>}
                    
                    {user && user.id === pack.user_id && (
                      <button 
                        onClick={(e) => deleteFromCatalog(pack.id, e)} 
                        className="absolute top-4 right-4 text-zinc-300 hover:text-red-500 bg-black/60 hover:bg-black/90 p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 z-10"
                        title="Удалить из каталога"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                      <AvatarWithFrame url={pack.profiles?.avatar_url} frame={pack.profiles?.frame} size="w-10 h-10" />
                      <div>
                        <div className="font-bold text-xs text-green-400">{pack.profiles?.username || "Игрок"}</div>
                        <div className="text-[10px] text-zinc-400">{pack.profiles?.title || "Новичок"}</div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold pr-6 leading-tight">{pack.name}</h3>
                    <div className="text-sm text-zinc-400">{pack.game_version} • {pack.loader.toUpperCase()}</div>
                    <div className="text-sm text-zinc-300 flex justify-between items-center mt-auto pt-2 border-t border-white/5">
                      <div className="flex gap-3 text-xs">
                        <span className="text-zinc-400">Модов: {Object.keys(pack.artifacts).length}</span>
                        <span className="text-pink-400 flex items-center gap-1">❤️ {pack.likes || 0}</span>
                      </div>
                      <span className="text-green-400 font-bold">⬇ {pack.downloads || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCatalog.length === 0 && !catalogError && <div className="text-zinc-500 col-span-full">По вашему запросу ничего не найдено.</div>}
            </div>

            {totalCatalogPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">← Назад</button>
                <span className="text-sm text-zinc-400 mx-4 font-bold">Стр. {catalogPage} из {totalCatalogPages}</span>
                <button onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))} disabled={catalogPage === totalCatalogPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Вперед →</button>
              </div>
            )}
          </div>
        )}

        {view === "profile" && user && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl">
              <h2 className="text-3xl font-black mb-8 text-center text-white">Мой профиль</h2>
              
              {dbError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">
                  Ошибка БД: {dbError}
                </div>
              )}

              <div className="flex flex-col items-center gap-4 mb-8">
                <AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-32 h-32" />
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
                
                <div>
                  <label className="text-sm text-zinc-400 mb-3 block font-bold">Рамка профиля (Инвентарь)</label>
                  <div className="grid grid-cols-4 gap-3">
                    {FRAMES.filter(f => f.id === "default" || user?.id === ADMIN_ID).map(f => (
                      <button 
                        key={f.id} 
                        onClick={() => { setProfile({...profile, frame: f.id}); saveProfile({ username: profile.username, frame: f.id }); }}
                        className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-2 ${profile?.frame === f.id ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`}
                        title={f.label}
                      >
                        {f.icon ? (
                          <div className="w-10 h-10 relative">
                            <Image src={f.icon} alt={f.label} fill className="object-contain" unoptimized />
                          </div>
                        ) : (
                          <div className="text-2xl opacity-50">🚫</div>
                        )}
                        <span className="text-[10px] text-zinc-400 mt-1 text-center leading-tight">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => saveProfile({ username: profile.username })} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl mt-4 transition-colors">Сохранить изменения</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className={`fixed inset-y-0 right-0 w-[28rem] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Моя сборка</h2>
          <button onClick={() => setIsPackOpen(false)} className="bg-white/10 hover:bg-white/20 border border-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-white">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
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
        <div className="p-4 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button onClick={() => downloadModpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            {isDownloading ? "Скачивание..." : "Скачать .zip"}
          </button>
          <button onClick={() => setIsPublishModalOpen(true)} disabled={modsList.length === 0 || !user} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
            {activePack?.published_id ? "Обновить в каталоге" : "Опубликовать в каталоге"}
          </button>
        </div>
      </div>

      {viewingPack && (
        <div className="fixed inset-0 bg-[#09090b] z-[70] overflow-y-auto w-full h-full flex flex-col animate-in fade-in duration-200">
          
          <div className="w-full h-[40vh] min-h-[300px] relative shrink-0">
            {viewingPack.cover_url ? <Image src={viewingPack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-8xl opacity-10 bg-zinc-900">🖼️</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent"></div>
            
            <button onClick={() => setViewingPack(null)} className="absolute top-8 right-8 text-white bg-black/50 hover:bg-black/80 w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md z-10">✕</button>
            
            <div className="absolute bottom-10 left-10 max-w-4xl">
              <h1 className="text-5xl font-black text-white drop-shadow-2xl mb-4">{viewingPack.name}</h1>
              <div className="flex items-center gap-4 text-zinc-300">
                <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md">
                  <AvatarWithFrame url={viewingPack.profiles?.avatar_url} frame={viewingPack.profiles?.frame} size="w-8 h-8" />
                  <span className="font-bold text-sm text-white">{viewingPack.profiles?.username || "Игрок"}</span>
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold">
                  {viewingPack.game_version} • {viewingPack.loader.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto w-full px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              
              {viewingPack.video_url && getYouTubeID(viewingPack.video_url) && (
                <div className="w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                  <iframe 
                    width="100%" height="100%" 
                    src={`https://www.youtube.com/embed/${getYouTubeID(viewingPack.video_url)}`} 
                    title="YouTube video player" frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                </div>
              )}

              {viewingPack.screenshots && viewingPack.screenshots.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Скриншоты</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingPack.screenshots.map((url, i) => (
                      <div key={i} className="w-full aspect-video rounded-2xl bg-zinc-800 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => window.open(url, '_blank')}>
                        <Image src={url} alt="screenshot" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Описание</h3>
                <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-[#121214] p-8 rounded-3xl border border-white/5 shadow-xl leading-relaxed whitespace-pre-wrap">
                  {viewingPack.description || "Автор пока не добавил описание к этой сборке."}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                  <h3 className="text-xl font-bold text-white">Моды в сборке ({Object.keys(viewingPack.artifacts).length})</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(viewingPack.artifacts).map((mod) => (
                    <div key={mod.project_id} className="flex items-center gap-3 bg-[#121214] p-3 rounded-2xl border border-white/5">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative border border-white/10 shrink-0">
                        {mod.icon_url ? <Image src={mod.icon_url} alt="icon" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl">🧩</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate text-white">{mod.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{mod.isLibrary ? "Библиотека" : "Мод"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="space-y-6">
              <div className="bg-[#121214] p-6 rounded-3xl border border-white/10 shadow-xl sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-green-400">{viewingPack.downloads || 0}</span>
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Скачиваний</span>
                  </div>
                  <button onClick={(e) => toggleLike(viewingPack.id, e)} className={`flex flex-col items-center gap-1 group transition-transform hover:scale-110 ${likedPacks.includes(viewingPack.id) ? "text-pink-500" : "text-zinc-400 hover:text-pink-400"}`}>
                    <span className="text-3xl">{likedPacks.includes(viewingPack.id) ? "❤️" : "🤍"}</span>
                    <span className="text-xs font-bold">{viewingPack.likes || 0} лайков</span>
                  </button>
                </div>

                <button onClick={() => { importPack(viewingPack); setViewingPack(null); }} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors shadow-[0_0_20px_rgba(34,197,94,0.4)] mb-3">
                  Скачать себе
                </button>
                <button onClick={() => { downloadModpack(viewingPack as unknown as Modpack); }} disabled={isDownloading} className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">
                  {isDownloading ? "..." : "Скачать .zip"}
                </button>
                
                <div className="mt-8 pt-6 border-t border-white/10 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Загрузчик:</span>
                    <span className="font-bold text-white">{viewingPack.loader.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Версия игры:</span>
                    <span className="font-bold text-white">{viewingPack.game_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Модов:</span>
                    <span className="font-bold text-white">{Object.keys(viewingPack.artifacts).length}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {selectedMod && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-2 md:p-4" onClick={() => setSelectedMod(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-[95vw] h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            
            <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-black/20 relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative shadow-2xl shrink-0 border border-white/10"><Image src={selectedMod.icon_url || '/placeholder.png'} alt={selectedMod.title} fill className="object-cover" unoptimized /></div>
              <div className="flex-1 min-w-0 pr-12">
                <h2 className="text-xl font-bold text-white truncate">{selectedMod.title}</h2>
                <p className="text-zinc-400 text-xs line-clamp-1">{selectedMod.description}</p>
              </div>
              <button onClick={() => setSelectedMod(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            </div>

            <div className="flex border-b border-white/10 px-6 md:px-8 shrink-0 bg-black/20">
              <button onClick={() => setActiveTab("description")} className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "description" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Описание</button>
              <button onClick={() => setActiveTab("gallery")} className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "gallery" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Галерея</button>
              <button onClick={() => setActiveTab("files")} className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "files" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Файлы</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#09090b]">
              
              {activeTab === "description" && (
                <div className="w-full">
                  {selectedMod.body ? (
                    <div className="prose prose-invert prose-base max-w-none text-zinc-300 bg-white/5 p-6 md:p-8 rounded-2xl border border-white/10 whitespace-pre-wrap">
                      {!translatedDesc ? <span className="text-green-500 animate-pulse">Перевод...</span> : <div dangerouslySetInnerHTML={{ __html: translatedDesc }} />}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500 py-20">Описание отсутствует</div>
                  )}
                </div>
              )}

              {activeTab === "gallery" && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedMod.gallery && selectedMod.gallery.length > 0 ? (
                    selectedMod.gallery.map((img, i) => (
                      <div key={i} className="w-full aspect-video rounded-2xl bg-zinc-800 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                        <Image src={img.url} alt={img.title || "Gallery image"} fill className="object-cover" unoptimized />
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-zinc-500 py-20 col-span-full">Галерея пуста</div>
                  )}
                </div>
              )}

              {activeTab === "files" && (
                <div className="w-full space-y-4">
                  <h3 className="text-xl font-bold text-white mb-6">Доступные версии</h3>
                  {isModalLoading ? (<div className="text-center text-green-500 py-10">Загрузка...</div>) : (
                    <div className="flex flex-col gap-3">
                      {modVersions.map(v => (
                        <div key={v.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate">{v.name}</div>
                            <div className="text-xs text-zinc-400 mt-1">Загрузчик: {v.loaders.join(", ")} • Игра: {v.game_versions.join(", ")}</div>
                          </div>
                          <button onClick={() => handleAddMod(selectedMod, v)} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0">Добавить в сборку</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setIsPublishModalOpen(false)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white mb-6">Публикация сборки</h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block font-bold">Обложка</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 rounded-xl bg-zinc-800 relative overflow-hidden border border-white/10 shrink-0">
                    {activePack?.cover_url ? <Image src={activePack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🖼️</div>}
                  </div>
                  <div className="flex-1">
                    <input type="file" id="publish-cover-upload" accept="image/*" onChange={(e) => uploadCover(e, activePackId)} className="hidden" />
                    <label htmlFor="publish-cover-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">
                      Загрузить обложку
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block font-bold">Ссылка на YouTube-видео</label>
                <input type="text" placeholder="https://youtube.com/watch?v=..." value={activePack?.video_url || ""} onChange={(e) => updateActivePack({ video_url: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm" />
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block font-bold">Описание</label>
                <textarea 
                  placeholder="Расскажите о своей сборке на русском..." 
                  value={activePack?.description || ""} 
                  onChange={(e) => updateActivePack({ description: e.target.value })}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-32 resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block font-bold">Скриншоты</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {activePack?.screenshots?.map((url, i) => (
                    <div key={i} className="w-20 h-20 rounded-lg bg-zinc-800 relative overflow-hidden border border-white/10 group">
                      <Image src={url} alt="screenshot" fill className="object-cover" unoptimized />
                      <button 
                        onClick={() => {
                          const newScreens = activePack.screenshots?.filter((_, idx) => idx !== i);
                          updateActivePack({ screenshots: newScreens });
                        }}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <input type="file" id="publish-screenshot-upload" accept="image/*" onChange={(e) => uploadScreenshot(e, activePackId)} className="hidden" />
                <label htmlFor="publish-screenshot-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">
                  + Добавить скриншот
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsPublishModalOpen(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">Отмена</button>
                <button onClick={publishPack} className="flex-1 bg-green-500 hover:bg-green-400 text-black py-3 rounded-xl font-bold transition-colors">Опубликовать</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}