"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Image from "next/image";
import { supabase } from "./supabase";
import { marked } from "marked";
import DOMPurify from "dompurify";
import Groups from "./Groups";
import Shop from "./Shop";

const ADMIN_ID = "4605b485-35e3-4592-b082-781339760840";

type ModInfo = { project_id: string; title: string; icon_url: string; description: string; downloads: number; categories: string[]; };
type FullModInfo = ModInfo & { body: string; gallery: { url: string; featured: boolean; title?: string }[]; };
type Artifact = { project_id: string; version_id: string; title: string; isLibrary: boolean; icon_url?: string; file_url?: string; file_name?: string; version_number?: string; };
type Modpack = { id: string; name: string; gameVersion: string; loader: string; artifacts: Record<string, Artifact>; artifacts_by_version?: Record<string, Record<string, Artifact>>; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; published_id?: string; price?: number; };
type PublishedPack = { id: string; user_id: string; name: string; game_version: string; loader: string; artifacts: Record<string, Artifact>; downloads: number; likes: number; rating?: number; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; bumped_until?: string; created_at?: string; price?: number; profiles: { username: string; avatar_url: string; title: string; frame?: string } };
type UserProfile = { id: string; username: string; avatar_url: string; title: string; frame?: string; role?: string; owned_titles?: string[]; bio?: string; owned_items?: string[]; coins?: number; last_gacha_pull?: string; total_sales?: number; yookassa_shop_id?: string; };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; };
type Frame = { id: string; name: string; img: string; emoji: string; style?: string; };
type Gif = { id: string; url: string; user_id: string; is_global: boolean; created_at: string; };

const CATEGORIES = [{ id: "adventure", label: "Приключения" }, { id: "technology", label: "Технологии" }, { id: "magic", label: "Магия" }, { id: "mobs", label: "Животные и Мобы" }, { id: "worldgen", label: "Генерация мира" }, { id: "equipment", label: "Снаряжение" }, { id: "decoration", label: "Декор" }, { id: "optimization", label: "Оптимизация" }, { id: "storage", label: "Хранение" }, { id: "food", label: "Еда" }, { id: "library", label: "Библиотеки" }, { id: "utility", label: "Утилиты" }, { id: "quests", label: "Квесты" }, { id: "game-mechanics", label: "Механики" }];

const TITLES = [
  { id: "novice", name: "Новичок", type: "standard", bg: "bg-gradient-to-b from-zinc-600 to-zinc-800 border border-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "player", name: "Игрок", type: "standard", bg: "bg-gradient-to-b from-blue-500 to-blue-800 border border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "master", name: "Мастер", type: "standard", bg: "bg-gradient-to-b from-purple-500 to-purple-900 border border-purple-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_10px_rgba(168,85,247,0.4)]" },
  { id: "vip", name: "VIP", type: "donate", bg: "bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_0_15px_rgba(250,204,21,0.5)]" },
  { id: "admin", name: "Администратор", type: "exclusive", bg: "bg-gradient-to-b from-red-600 via-red-900 to-black border border-red-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_0_30px_rgba(220,38,38,0.8)]" },
];

const FRAMES: Frame[] = [
  { id: "f_wood", name: "Деревянная", img: "", emoji: "🪵", style: "border-amber-700" },
  { id: "space_helmet", name: "Космический Шлем", img: "/gacha/space_helmet.png", emoji: "👨‍🚀", style: "border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" },
  { id: "winged_lantern", name: "Свет Небес", img: "/gacha/winged_lantern.png", emoji: "🏮", style: "border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" },
];

const ITEMS_PER_PAGE = 40;
const CATALOG_PER_PAGE = 9;
const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🤩", "😎", "😭", "😡", "👍", "👎", "🔥", "💯", "❤️", "💔", "🎉", "💩", "👻", "💀", "🤖", "👾", "🎮", "🕹️", "💻"];

const ItemImage = ({ src, emoji, alt, className }: { src: string, emoji: string, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  if (error || !src) return <div className={`flex items-center justify-center ${className}`}><span className="text-4xl md:text-5xl drop-shadow-md">{emoji}</span></div>;
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
};

const TitleBadge = ({ titleName, size = "sm" }: { titleName: string, size?: "sm" | "lg" }) => {
  const t = TITLES.find((x: any) => x.name === titleName) || TITLES[0];
  if (size === "lg") return <div className={`inline-flex items-center justify-center px-6 py-2 rounded-lg font-black uppercase tracking-widest ${t.bg}`}><span className="drop-shadow-md text-sm">{t.name}</span></div>;
  return <div className={`inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wider ${t.bg}`}><span className="drop-shadow-sm text-[10px]">{t.name}</span></div>;
};

const CustomSelect = ({ value, options, onChange, widthClass = "w-40" }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void, widthClass?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedOption = options.find((o: any) => o.value === value);
  return (
    <div className={`relative z-50 ${widthClass}`} ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-black/30 backdrop-blur-md hover:bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-2 text-white">
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#121214] border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 py-2 min-w-[120%] animate-in fade-in slide-in-from-top-2">
          {options.map((opt: any) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${value === opt.value ? "bg-white/10 text-green-400 font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AvatarWithFrame = ({ url, frame, size = "w-10 h-10" }: { url?: string, frame?: string, size?: string }) => {
  const equippedFrame = FRAMES.find((i: any) => i.id === frame);
  const frameStyle = equippedFrame?.style || "border-white/10";
  return (
    <div className={`relative ${size} shrink-0 rounded-full border-2 ${frameStyle} bg-zinc-900 overflow-hidden group`}>
      <div className="absolute inset-0.5 rounded-full overflow-hidden">
        {url ? <Image src={url} alt="avatar" fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-lg">👤</div>}
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); 
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const borderColor = type === 'success' ? 'border-l-green-500' : type === 'error' ? 'border-l-red-500' : 'border-l-blue-500';
  
  return (
    <div className={`fixed top-6 right-6 px-5 py-3 rounded-r-xl rounded-l-md bg-[#121214]/95 border border-white/10 border-l-4 ${borderColor} shadow-2xl z-[100] flex items-center gap-3 font-medium text-sm text-zinc-200 backdrop-blur-xl transition-all duration-300 ease-out ${isVisible ? "translate-x-0 opacity-100" : "translate-x-12 opacity-0"}`}>
      {type === 'success' && <span className="text-green-500 text-lg">✓</span>}
      {type === 'error' && <span className="text-red-500 text-lg">✕</span>}
      {message}
    </div>
  );
};

export default function Home() {
  const [view, setView] = useState<"mods" | "catalog" | "profile" | "friends" | "admin" | "afisha" | "groups" | "shop">("mods");
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [activePackId, setActivePackId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type });

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentPackId, setPaymentPackId] = useState<string | null>(null);

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [activeChat, setActiveChat] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<"emojis" | "gifs">("emojis");
  const [gifSubTab, setGifSubTab] = useState<"my" | "global">("my");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");
  const [packSearch, setPackSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [profileTab, setProfileTab] = useState<"frames" | "titles" | "earnings">("frames");
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [viewingUserPacks, setViewingUserPacks] = useState<PublishedPack[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

  const [myGifs, setMyGifs] = useState<Gif[]>([]);
  const [globalGifs, setGlobalGifs] = useState<Gif[]>([]);
  const [isUploadingGif, setIsUploadingGif] = useState(false);
  const gifUploadRef = useRef<HTMLInputElement>(null);

  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "gallery" | "files">("description");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [totalHits, setTotalHits] = useState(0);
  const [catalog, setCatalog] = useState<PublishedPack[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState<string>("all");
  const [catalogLoader, setCatalogLoader] = useState<string>("all");
  const [catalogSort, setCatalogSort] = useState<string>("newest");
  const [catalogSearch, setCatalogSearch] = useState("");
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isAfishaMuted, setIsAfishaMuted] = useState(true);
  const afishaVideoRef = useRef<HTMLVideoElement>(null);

  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  const handleBoostPayment = (packId: string) => {
    setPaymentPackId(packId);
    setIsPaymentModalOpen(true);
  };

  const processPayment = async (amount: number) => {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          description: 'VIP-буст сборки на 24 часа',
          packId: paymentPackId,
          userId: user?.id
        })
      });
      const data = await res.json();
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        showToast(data.error || 'Ошибка оплаты', 'error');
      }
    } catch (e) {
      showToast('Ошибка сети', 'error');
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePack = modpacks.find((p: any) => p.id === activePackId) || modpacks[0];
  const formatTime = (isoString: string) => isoString ? new Date(isoString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : "";
  const isImageUrl = (text: string) => /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(text) || text.includes('tenor.com') || text.includes('giphy.com');
  
  const getUserId = () => {
    if (user) return user.id;
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) { guestId = crypto.randomUUID(); localStorage.setItem('guest_id', guestId); }
    return guestId;
  };
  
  const getYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getOriginalUrl = (url: string) => {
    if (url.includes('cdn.modrinth.com')) return url.split('?')[0];
    return url;
  };

  const isOwnPack = !!(viewingPack && user && viewingPack.user_id === user.id);

  const calculateTopScore = (a: PublishedPack, b: PublishedPack) => {
    const ratingA = Number(a.rating || 0);
    const ratingB = Number(b.rating || 0);
    if (ratingA !== ratingB) return ratingB - ratingA;
    const likesA = Number(a.likes || 0);
    const likesB = Number(b.likes || 0);
    if (likesA !== likesB) return likesB - likesA;
    const dlA = Number(a.downloads || 0);
    const dlB = Number(b.downloads || 0);
    if (dlA !== dlB) return dlB - dlA;
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateA - dateB;
  };

  const getVersionKey = (version: string, loader: string) => `${version}__${loader}`;

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);

  // Синхронизация звука видео Афиши после ремаунта / переключения вкладок
  useEffect(() => {
    if (view !== "afisha") return;
    const v = afishaVideoRef.current;
    if (!v) return;
    v.muted = isAfishaMuted;
    if (!isAfishaMuted) {
      v.play().catch(() => {});
    }
  }, [view, isAfishaMuted]);
  useEffect(() => { if (viewingPack) fetchComments(viewingPack.id); }, [viewingPack]);
  
  useEffect(() => {
    if (messages.length > prevMessagesLength.current && isScrolledToBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isFriendTyping, isScrolledToBottom]);

  useEffect(() => { if (activeChat && user) { fetchMessages(activeChat.id); const interval = setInterval(() => fetchMessages(activeChat.id), 3000); const channel = supabase.channel(`typing-${[user.id, activeChat.id].sort().join('-')}`); channel.on('broadcast', { event: 'typing' }, (payload: any) => { if (payload.payload.user_id !== user.id) { setIsFriendTyping(true); setTimeout(() => setIsFriendTyping(false), 2000); } }).subscribe(); channelRef.current = channel; return () => { clearInterval(interval); supabase.removeChannel(channel); }; } }, [activeChat, user]);
  useEffect(() => { if (user) { fetchFriends(); fetchSuggestedUsers(); fetchGifs(); const interval = setInterval(fetchFriends, 5000); return () => clearInterval(interval); } }, [user]);
  useEffect(() => { if (user && user.id === ADMIN_ID && view === "admin") { supabase.from('profiles').select('*').then(({ data }) => { if (data) setAdminUsers(data); }); } }, [user, view]);
  useEffect(() => { if (user) fetchFromDB(); else { const saved = localStorage.getItem("modbuilder_packs"); if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) { setModpacks(parsed); setActivePackId(parsed[0].id); } } catch(e) {} } else { createNewPack(true, null); } setIsLoaded(true); } fetchCatalog(); }, [user]);
  useEffect(() => { if (isLoaded && view === "mods") fetchMods(currentPage); }, [query, selectedCategories, activePack?.gameVersion, activePack?.loader, currentPage, view, isLoaded]);
  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setIsLoggingIn(false); if(session?.user) { fetchProfile(session.user.id); fetchUserLikes(session.user.id); fetchUserRatings(session.user.id); } }); const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { setUser(session?.user ?? null); if (event === 'SIGNED_IN') { setIsLoggingIn(false); fetchProfile(session!.user.id); fetchUserLikes(session!.user.id); fetchUserRatings(session!.user.id); } }); return () => authListener.subscription.unsubscribe(); }, []);
  
  useEffect(() => { 
    if (!user) return; 
    const checkUnread = async () => { 
      const { data } = await supabase.from('messages').select('sender_id, created_at').eq('receiver_id', user.id); 
      if (data) { 
        const counts: Record<string, number> = {};
        const readState = JSON.parse(localStorage.getItem('read_state') || '{}'); 
        data.forEach((msg: any) => { 
          if (!readState[msg.sender_id] || new Date(msg.created_at) > new Date(readState[msg.sender_id])) {
            counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
          }
        }); 
        setUnreadCounts(counts); 
      } 
    }; 
    checkUnread(); 
    const interval = setInterval(checkUnread, 5000); 
    return () => clearInterval(interval); 
  }, [user]);

  const handleOpenChat = (friend: UserProfile) => { setActiveChat(friend); setIsScrolledToBottom(true); const readState = JSON.parse(localStorage.getItem('read_state') || '{}'); readState[friend.id] = new Date().toISOString(); localStorage.setItem('read_state', JSON.stringify(readState)); setUnreadCounts(prev => ({...prev, [friend.id]: 0})); };
  const translateDescription = async (markdown: string) => { try { const rawHtml = marked.parse(markdown) as string; const tempDiv = document.createElement("div"); tempDiv.innerHTML = DOMPurify.sanitize(rawHtml); const textNodes: Node[] = []; const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null); let node; while (node = walker.nextNode()) { if (node.textContent?.trim()) textNodes.push(node); } if (!textNodes.length) return; const combined = textNodes.map((n: any) => n.textContent?.trim() || "").join(" ||| "); const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(combined.substring(0, 4000))}`); const data = await res.json(); const parts = data[0].map((i: any) => i[0]).join("").split(" ||| "); textNodes.forEach((n: any, i: number) => { if (parts[i]) n.textContent = parts[i].trim(); }); setTranslatedDesc(DOMPurify.sanitize(tempDiv.innerHTML)); } catch { showToast("Ошибка перевода", "error"); } };

  const fetchFriends = async () => { if (!user) return; try { const { data: sent } = await supabase.from('friendships').select('*').eq('sender_id', user.id); const { data: received } = await supabase.from('friendships').select('*').eq('receiver_id', user.id); const relations = [...(sent || []), ...(received || [])]; const accepted = relations.filter((r: any) => r.status === 'accepted'); const pending = relations.filter((r: any) => r.status === 'pending' && r.receiver_id === user.id); const friendIds = accepted.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id); if (friendIds.length > 0) { const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds); setFriends(friendIds.map((id: string) => profiles?.find((pr: any) => pr.id === id) || { id, username: 'Неизвестный', avatar_url: null, title: 'Новичок', frame: 'default' })); } else setFriends([]); const reqIds = pending.map((r: any) => r.sender_id); if (reqIds.length > 0) { const { data: profs } = await supabase.from('profiles').select('*').in('id', reqIds); setRequests(pending.map((req: any) => ({ ...req, profile: profs?.find((pr: any) => pr.id === req.sender_id) || { id: req.sender_id, username: 'Неизвестный', avatar_url: null, title: 'Новичок', frame: 'default' } }))); } else setRequests([]); } catch(e) {} };
  const fetchSuggestedUsers = async () => { if (!user) return; const { data } = await supabase.from('profiles').select('*').neq('id', user.id).limit(20); if (data) setSuggestedUsers(data); };
  const searchUsers = async (q: string) => { setSearchQuery(q); if (q.length < 2) { setSearchResults([]); return; } const { data } = await supabase.from('profiles').select('*').ilike('username', `%${q}%`).neq('id', user?.id).limit(10); setSearchResults(data || []); };
  const sendFriendRequest = async (receiverId: string) => { await supabase.from('friendships').insert({ sender_id: user.id, receiver_id: receiverId, status: 'pending' }); showToast("Заявка отправлена!", "success"); setSearchQuery(""); setSearchResults([]); };
  const acceptRequest = async (id: string) => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id); showToast("Теперь вы друзья!", "success"); await fetchFriends(); };
  const removeFriend = async (friendId: string, e: React.MouseEvent) => { e.stopPropagation(); if (!confirm("Удалить из друзей?")) return; await supabase.from('friendships').delete().eq('sender_id', user.id).eq('receiver_id', friendId); await supabase.from('friendships').delete().eq('sender_id', friendId).eq('receiver_id', user.id); if (activeChat?.id === friendId) setActiveChat(null); fetchFriends(); showToast("Пользователь удален", "success"); };
  const clearChat = async () => { if (!activeChat || !user) return; if (!confirm("Очистить чат?")) return; await supabase.from('messages').delete().eq('sender_id', user.id).eq('receiver_id', activeChat.id); await supabase.from('messages').delete().eq('sender_id', activeChat.id).eq('receiver_id', user.id); setMessages([]); showToast("Чат очищен", "success"); };
  const fetchMessages = async (friendId: string) => { const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`).order('created_at', { ascending: true }); setMessages(data || []); };
  
  const fetchGifs = async () => {
    if (!user) return;
    const { data: my } = await supabase.from('user_gifs').select('*').eq('user_id', user.id).eq('is_global', false).order('created_at', { ascending: false });
    if (my) setMyGifs(my as Gif[]);
    const { data: global } = await supabase.from('user_gifs').select('*').eq('is_global', true).order('created_at', { ascending: false });
    if (global) setGlobalGifs(global as Gif[]);
  };

  const handleGifUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGlobal: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (isGlobal && user.id !== ADMIN_ID) return showToast("Только админ может загружать общие гифки", "error");
    setIsUploadingGif(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `gif-${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_files').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('chat_files').getPublicUrl(fileName);
      
      const { data: inserted, error: insertError } = await supabase.from('user_gifs').insert({ 
        user_id: user.id, 
        url: data.publicUrl,
        is_global: isGlobal
      }).select();

      if (insertError) throw insertError;
      
      showToast(isGlobal ? "Общая гифка добавлена!" : "Гифка добавлена в коллекцию!", "success");
      await fetchGifs();
    } catch (err: any) {
      showToast("Ошибка загрузки гифки: " + err.message, "error");
    } finally {
      setIsUploadingGif(false);
      if (gifUploadRef.current) gifUploadRef.current.value = "";
    }
  };

  const deleteGif = async (gifId: string, isGlobal: boolean) => {
    if (!confirm("Удалить гифку?")) return;
    try {
      const { error } = await supabase.from('user_gifs').delete().eq('id', gifId);
      if (error) throw error;
      showToast("Гифка удалена", "success");
      await fetchGifs();
    } catch (err: any) {
      showToast("Ошибка удаления", "error");
    }
  };

  const saveGifToCollection = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (myGifs.some(g => g.url === url)) return showToast("Эта гифка уже в коллекции", "info");
    try {
      await supabase.from('user_gifs').insert({ user_id: user.id, url, is_global: false });
      showToast("Гифка сохранена!", "success");
      await fetchGifs();
    } catch (err: any) {
      showToast("Ошибка сохранения", "error");
    }
  };

  const sendMessage = async (gifUrl?: string) => { 
    if (!newMessage.trim() && !attachedFile && !gifUrl) return; 
    if (!activeChat) return; 
    setIsSendingFile(true); 
    let fileUrl = null; 
    if (attachedFile) { 
      const fileExt = attachedFile.name.split('.').pop(); 
      const fileName = `${user.id}-${Date.now()}.${fileExt}`; 
      const { error } = await supabase.storage.from('chat_files').upload(fileName, attachedFile); 
      if (!error) { 
        const { data } = supabase.storage.from('chat_files').getPublicUrl(fileName); 
        fileUrl = data.publicUrl; 
      } else { 
        showToast("Ошибка загрузки", "error"); 
        setIsSendingFile(false); 
        return; 
      } 
    } 
    const content = gifUrl || fileUrl || newMessage.trim(); 
    setNewMessage(""); 
    setAttachedFile(null); 
    setPreviewUrl(null); 
    setShowEmojiPicker(false); 
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: activeChat.id, content }); 
    fetchMessages(activeChat.id); 
    setIsSendingFile(false); 
    setIsScrolledToBottom(true);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsScrolledToBottom(isBottom);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setAttachedFile(file); setPreviewUrl(URL.createObjectURL(file)); } };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); const file = e.dataTransfer.files?.[0]; if (file) { setAttachedFile(file); setPreviewUrl(URL.createObjectURL(file)); } };
  const deleteMessage = async (id: string) => { if (!confirm("Удалить сообщение?")) return; await supabase.from('messages').delete().eq('id', id); setMessages(prev => prev.filter((m: any) => m.id !== id)); };
  const startEditMessage = (id: string, content: string) => { setEditingMessageId(id); setEditMessageContent(content); };
  const cancelEditMessage = () => { setEditingMessageId(null); setEditMessageContent(""); };
  const saveEditMessage = async (id: string) => { if (!editMessageContent.trim()) return; await supabase.from('messages').update({ content: editMessageContent.trim() }).eq('id', id); setMessages(prev => prev.map((m: any) => m.id === id ? { ...m, content: editMessageContent.trim() } : m)); setEditingMessageId(null); setEditMessageContent(""); showToast("Сообщение обновлено", "success"); };

  const fetchProfile = async (userId: string) => { const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(); if (error) return; if (data) setProfile(data); else { const newProfile = { id: userId, username: "Игрок", title: "Новичок", avatar_url: null, frame: "default", role: "user", owned_titles: ["novice"], bio: "" }; await supabase.from('profiles').insert(newProfile); setProfile(newProfile); } };
  const fetchUserLikes = async (userId: string) => { const { data } = await supabase.from('pack_likes').select('pack_id').eq('user_id', userId); if (data) setLikedPacks(data.map((d: any) => d.pack_id)); };
  const fetchUserRatings = async (userId: string) => { const { data } = await supabase.from('pack_ratings').select('pack_id, rating').eq('user_id', userId); if (data) { const ratingsMap: Record<string, number> = {}; data.forEach((r: any) => { ratingsMap[r.pack_id] = r.rating; }); setUserRatings(ratingsMap); } };
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !user) return; setIsUploading(true); try { const fileExt = file.name.split('.').pop(); const fileName = `${user.id}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('avatars').getPublicUrl(fileName); await supabase.from('profiles').upsert({ id: user.id, avatar_url: data.publicUrl, username: profile?.username || "Игрок", title: profile?.title || "Новичок", frame: profile?.frame || "default" }); setProfile((prev: any) => ({ ...prev, avatar_url: data.publicUrl })); fetchProfile(user.id); showToast("Аватарка обновлена!", "success"); } catch (error: any) { showToast(error.message || "Ошибка", "error"); } finally { setIsUploading(false); } };
  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => { const file = e.target.files?.[0]; if (!file || !user) return; try { const fileExt = file.name.split('.').pop(); const fileName = `cover-${packId}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('covers').getPublicUrl(fileName); const newPacks = modpacks.map((p: any) => p.id === packId ? { ...p, cover_url: data.publicUrl } : p); setModpacks(newPacks); await saveToDB(newPacks, packId); if (activePack?.id === packId && activePack.published_id) { await supabase.from('published_packs').update({ cover_url: data.publicUrl }).eq('id', activePack.published_id); fetchCatalog(); } showToast("Обложка загружена!", "success"); } catch (error: any) { showToast("Ошибка: " + error.message, "error"); } };
  const uploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => { const file = e.target.files?.[0]; if (!file || !user) return; try { const fileExt = file.name.split('.').pop(); const fileName = `screen-${packId}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('covers').getPublicUrl(fileName); const pack = modpacks.find((p: any) => p.id === packId); const newScreens = [...(pack?.screenshots || []), data.publicUrl]; const newPacks = modpacks.map((p: any) => p.id === packId ? { ...p, screenshots: newScreens } : p); setModpacks(newPacks); await saveToDB(newPacks, packId); if (activePack?.id === packId && activePack.published_id) { await supabase.from('published_packs').update({ screenshots: newScreens }).eq('id', activePack.published_id); fetchCatalog(); } showToast("Скриншот добавлен!", "success"); } catch (error: any) { showToast("Ошибка: " + error.message, "error"); } };

  const saveProfile = async (updates: any) => { if (!user) return; const { error } = await supabase.from('profiles').upsert({ id: user.id, username: updates.username || profile?.username || "Игрок", title: updates.title || profile?.title || "Новичок", avatar_url: profile?.avatar_url || null, frame: updates.frame !== undefined ? updates.frame : profile?.frame || "default", bio: updates.bio !== undefined ? updates.bio : profile?.bio || "", owned_items: profile?.owned_items || [] }); if (error) showToast("Ошибка: " + error.message, "error"); else { setProfile((prev: any) => ({ ...prev, ...updates })); fetchProfile(user.id); showToast("Сохранено!", "success"); } };
  const toggleTitle = async (targetUserId: string, titleId: string) => { const targetUser = adminUsers.find((u: any) => u.id === targetUserId); if (!targetUser) return; const currentOwned = targetUser.owned_titles || ['novice']; const hasTitle = currentOwned.includes(titleId); const newOwned = hasTitle ? currentOwned.filter((id: string) => id !== titleId) : [...currentOwned, titleId]; await supabase.from('profiles').update({ owned_titles: newOwned }).eq('id', targetUserId); showToast(hasTitle ? "Забран!" : "Выдан!", "success"); setAdminUsers(prev => prev.map((u: any) => u.id === targetUserId ? { ...u, owned_titles: newOwned } : u)); };
  const updateRole = async (targetUserId: string, newRole: string) => { await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId); showToast("Роль обновлена!", "success"); setAdminUsers(prev => prev.map((u: any) => u.id === targetUserId ? { ...u, role: newRole } : u)); };

  const toggleLike = async (packId: string, e: React.MouseEvent) => { e.stopPropagation(); if (!user) return showToast("Войдите", "error"); const isLiked = likedPacks.includes(packId); if (isLiked) { await supabase.from('pack_likes').delete().eq('pack_id', packId).eq('user_id', user.id); setLikedPacks(prev => prev.filter((id: string) => id !== packId)); if (viewingPack) setViewingPack({ ...viewingPack, likes: Math.max(0, (viewingPack?.likes || 1) - 1) }); } else { await supabase.from('pack_likes').insert({ pack_id: packId, user_id: user.id }); setLikedPacks(prev => [...prev, packId]); if (viewingPack) setViewingPack({ ...viewingPack, likes: (viewingPack?.likes || 0) + 1 }); } fetchCatalog(); };
  const setRating = async (packId: string, score: number, e: React.MouseEvent) => { e.stopPropagation(); if (!user || (viewingPack && viewingPack.user_id === user.id)) return; await supabase.from('pack_ratings').upsert({ pack_id: packId, user_id: user.id, rating: score }, { onConflict: 'pack_id,user_id' }); const { data } = await supabase.from('published_packs').select('rating').eq('id', packId).single(); if (data && viewingPack) setViewingPack({ ...viewingPack, rating: data.rating }); setUserRatings(prev => ({ ...prev, [packId]: score })); fetchCatalog(); };
  const openUserProfile = async (userId: string) => { const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (prof) setViewingUser(prof); const { data: packs } = await supabase.from('published_packs').select('*').eq('user_id', userId).order('created_at', { ascending: false }); if (packs) setViewingUserPacks(packs as any); };
  const fetchComments = async (packId: string) => { const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url, title, frame)').eq('pack_id', packId).order('created_at', { ascending: true }); if (data) setComments(data); };
  const postComment = async () => { if (!newComment.trim() || !user || !viewingPack) return; await supabase.from('comments').insert({ pack_id: viewingPack.id, user_id: user.id, content: newComment.trim() }); setNewComment(""); fetchComments(viewingPack.id); showToast("Комментарий добавлен", "success"); };

  const fetchCatalog = async () => { setCatalogError(null); const { data: packs, error } = await supabase.from('published_packs').select('*').order('created_at', { ascending: false }); if (error) { setCatalogError(error.message); return; } if (!packs) return; const userIds = [...new Set(packs.map((p: any) => p.user_id))]; const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, title, frame').in('id', userIds); setCatalog(packs.map((pack: any) => ({ ...pack, profiles: profiles?.find((pr: any) => pr.id === pack.user_id) || { username: 'Неизвестный', avatar_url: '', title: 'Новичок', frame: 'default' } })) as any); };
  const fetchFromDB = async () => { if (!user) return; const { data } = await supabase.from('modpacks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }); if (data && data.length > 0) { setModpacks(data.map((d: any) => ({ id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {}, artifacts_by_version: d.artifacts_by_version || {}, cover_url: d.cover_url || undefined, description: d.description || undefined, screenshots: d.screenshots || [], video_url: d.video_url || undefined, published_id: d.published_id || undefined, price: d.price || 0 }))); setActivePackId(data[0].id); } else createNewPack(true, user); setIsLoaded(true); };
  const saveToDB = async (newPacks: Modpack[], currentId: string): Promise<any> => { if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return true; } const pack = newPacks.find((p: any) => p.id === currentId); if (!pack) return false; const { error } = await supabase.from('modpacks').upsert({ id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: JSON.parse(JSON.stringify(pack.artifacts || {})), artifacts_by_version: pack.artifacts_by_version || {}, description: pack.description || null, screenshots: pack.screenshots || [], cover_url: pack.cover_url || null, video_url: pack.video_url || null, published_id: pack.published_id || null, price: pack.price || 0 }); if (error) { showToast("Ошибка БД: " + error.message, "error"); return false; } return true; };
  const createNewPack = async (isInitial = false, currentUser = user) => { const newId = crypto.randomUUID(); const newPack = { id: newId, name: isInitial ? "Моя сборка" : "Новая сборка", gameVersion: "1.16.5", loader: "forge", artifacts: {}, artifacts_by_version: {}, screenshots: [], cover_url: undefined, description: "", video_url: "" }; setModpacks(prev => [...prev, newPack]); setActivePackId(newId); setIsSidebarOpen(true); if (currentUser) await supabase.from('modpacks').insert({ id: newId, user_id: currentUser.id, name: newPack.name, game_version: newPack.gameVersion, loader: newPack.loader, artifacts: {}, artifacts_by_version: {}, description: "", screenshots: [] }); else localStorage.setItem("modbuilder_packs", JSON.stringify([newPack])); };
  const publishPack = async () => { if (!user || !activePack || Object.keys(activePack.artifacts).length === 0) return showToast("Сначала добавьте моды!", "error"); if (activePack.price && Number(activePack.price) > 0 && Number(activePack.price) < 40) return showToast("Минимальная цена платной сборки — 40 ₽", "error"); if (activePack.price && Number(activePack.price) > 0 && Number(activePack.price) < 40) return showToast("Минимальная цена платной сборки — 40 ₽", "error"); try { if (activePack.published_id) { const { error } = await supabase.from('published_packs').update({ name: activePack.name, game_version: activePack.gameVersion, loader: activePack.loader, artifacts: activePack.artifacts, cover_url: activePack.cover_url, description: activePack.description, screenshots: activePack.screenshots || [], video_url: activePack.video_url, price: activePack.price || 0 }).eq('id', activePack.published_id); if (error) throw error; showToast("Сборка обновлена!", "success"); } else { const { data: insertedData, error } = await supabase.from('published_packs').insert({ user_id: user.id, name: activePack.name, game_version: activePack.gameVersion, loader: activePack.loader, artifacts: activePack.artifacts, cover_url: activePack.cover_url, description: activePack.description, screenshots: activePack.screenshots || [], video_url: activePack.video_url, price: activePack.price || 0 }).select(); if (error) throw error; if (insertedData && (insertedData as any)[0]) { const pubId = (insertedData as any)[0].id; const newPacks = modpacks.map((p: any) => p.id === activePackId ? { ...p, published_id: pubId } : p); setModpacks(newPacks); await saveToDB(newPacks, activePackId); setActivePackId(activePackId); } showToast("Сборка опубликована!", "success"); } setIsPublishModalOpen(false); fetchCatalog(); } catch(e: any) { showToast("Ошибка: " + e.message, "error"); } };
  const importPack = async (pack: PublishedPack) => { const newId = crypto.randomUUID(); const versionKey = getVersionKey(pack.game_version, pack.loader); const newPack = { id: newId, name: `Копия: ${pack.name}`, gameVersion: pack.game_version, loader: pack.loader, artifacts: pack.artifacts, artifacts_by_version: { [versionKey]: pack.artifacts }, cover_url: pack.cover_url, description: pack.description, screenshots: pack.screenshots, video_url: pack.video_url }; const newPacks = [...modpacks, newPack]; setModpacks(newPacks); setActivePackId(newId); saveToDB(newPacks, newId); try { const userId = getUserId(); if (pack.user_id !== userId) { const { data: isNew } = await supabase.rpc('register_pack_download', { p_pack_id: pack.id, p_user_id: userId }); if (isNew) { setViewingPack(prev => prev ? { ...prev, downloads: (prev.downloads || 0) + 1 } : null); fetchCatalog(); } } } catch(e) { console.error(e); } showToast("Сборка добавлена в личный кабинет!", "success"); setView("mods"); };
  const deleteFromCatalog = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirm("Удалить из каталога?")) { try { const { error } = await supabase.from('published_packs').delete().eq('id', id); if (error) throw error; const packToUpdate = modpacks.find((p: any) => p.published_id === id); if (packToUpdate) { const newPacks = modpacks.map((p: any) => p.id === packToUpdate.id ? { ...p, published_id: undefined } : p); setModpacks(newPacks); await saveToDB(newPacks, packToUpdate.id); } fetchCatalog(); showToast("Удалено из каталога", "success"); } catch (e: any) { showToast("Ошибка: " + e.message, "error"); } } };
  const deletePack = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (modpacks.length === 1) return showToast("Нельзя удалить последнюю сборку", "error"); if (confirm("Удалить эту сборку?")) { const newPacks = modpacks.filter((p: any) => p.id !== id); setModpacks(newPacks); if (activePackId === id) setActivePackId(newPacks[0].id); if (user) { await supabase.from('modpacks').delete().eq('id', id); } else { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); } showToast("Сборка удалена", "success"); } };
  const startRenaming = (id: string, currentName: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPackId(id); setEditNameValue(currentName); };
  const saveRename = () => { if (editingPackId && editNameValue.trim()) { const newPacks = modpacks.map((p: any) => p.id === editingPackId ? { ...p, name: editNameValue.trim() } : p); setModpacks(newPacks); saveToDB(newPacks, activePackId); } setEditingPackId(null); };
  
  const updateActivePack = (updates: Partial<Modpack>) => { 
    const newPacks = modpacks.map((p: any) => { 
      if (p.id !== activePackId) return p; 
      if (updates.gameVersion || updates.loader) {
        const oldKey = getVersionKey(p.gameVersion, p.loader);
        const newVersion = updates.gameVersion || p.gameVersion;
        const newLoader = updates.loader || p.loader;
        const newKey = getVersionKey(newVersion, newLoader);
        
        const oldArtifactsByVersion = p.artifacts_by_version || {};
        oldArtifactsByVersion[oldKey] = p.artifacts; 
        const newArtifacts = oldArtifactsByVersion[newKey] || {}; 

        return { ...p, ...updates, artifacts: newArtifacts, artifacts_by_version: oldArtifactsByVersion };
      }
      return { ...p, ...updates }; 
    }); 
    setModpacks(newPacks); 
    saveToDB(newPacks, activePackId); 
  };

  const toggleCategory = (catId: string) => { setSelectedCategories(prev => prev.includes(catId) ? prev.filter((c: string) => c !== catId) : [...prev, catId]); setCurrentPage(1); };
  const fetchMods = async (page: number) => { setIsLoading(true); try { const facets = [[`versions:${activePack?.gameVersion || "1.16.5"}`], [`categories:${activePack?.loader || "forge"}`], ["project_type:mod"]]; if (selectedCategories.length > 0) facets.push(selectedCategories.map((c: string) => `categories:${c}`)); let url = `https://api.modrinth.com/v2/search?offset=${(page - 1) * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`; if (!query.trim() && selectedCategories.length === 0) url += `&query=&index=downloads`; else if (query.trim()) url += `&query=${encodeURIComponent(query)}`; url += `&facets=${encodeURIComponent(JSON.stringify(facets))}`; const res = await fetch(url); const data = await res.json(); setResults(data.hits || []); setTotalHits(data.total_hits || 0); } catch(e) {} setIsLoading(false); };
  
  const openModModal = async (mod: ModInfo) => { 
    setIsModalLoading(true); 
    setSelectedMod({ ...mod, body: "", gallery: [] }); 
    setTranslatedDesc(null); 
    try { 
      const [projRes, verRes] = await Promise.all([ 
        fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`), 
        fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`) 
      ]); 
      const projData = await projRes.json(); 
      const verData = await verRes.json(); 
      setSelectedMod({ ...mod, body: projData.body || "", gallery: projData.gallery || [] }); 
      setModVersions(verData || []); 
      if (projData.body) translateDescription(projData.body); 
    } catch(e) {} finally { setIsModalLoading(false); } 
  };

  const handleAddMod = async (mod: ModInfo, specificVersion?: any) => { setIsAdding(mod.project_id); try { let verRes: any = specificVersion; if (!verRes) { const versionsData = await (await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json(); verRes = versionsData[0]; } if (!verRes) return showToast("Версия не найдена", "error"); const newArtifacts: Record<string, Artifact> = { [mod.project_id]: { project_id: mod.project_id, version_id: verRes.id, title: mod.title, isLibrary: false, icon_url: mod.icon_url || "", file_url: verRes.files[0]?.url || "", file_name: verRes.files[0]?.filename || "", version_number: verRes.version_number || "" } }; if (verRes.dependencies) { for (const dep of verRes.dependencies) { if (dep.dependency_type === "required" && dep.project_id) { const libProj = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`)).json(); const libVersions = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json(); const libVer = libVersions[0]; if (libVer) newArtifacts[dep.project_id] = { project_id: dep.project_id, version_id: libVer.id, title: libProj.title, isLibrary: true, icon_url: libProj.icon_url || "", file_url: libVer.files[0]?.url || "", file_name: libVer.files[0]?.filename || "", version_number: libVer.version_number || "" }; } } } const newPacks = modpacks.map((p: any) => { if (p.id !== activePackId) return p; return { ...p, artifacts: { ...p.artifacts, ...newArtifacts } }; }); setModpacks(newPacks); const success = await saveToDB(newPacks, activePackId); if (success) { setSelectedMod(null); showToast("Мод добавлен", "success"); } } catch(e) {} finally { setIsAdding(null); } };
  const removeArtifact = (id: string) => { const newPacks = modpacks.map((p: any) => { if (p.id !== activePackId) return p; const copy = { ...p.artifacts }; delete copy[id]; return { ...p, artifacts: copy }; }); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const downloadModpack = async (pack: any) => { const list = Object.values(pack.artifacts) as any[]; if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.zip`; a.click(); if (pack.id && pack.downloads !== undefined) { const userId = getUserId(); if (pack.user_id !== userId) { const { data: isNew } = await supabase.rpc('register_pack_download', { p_pack_id: pack.id, p_user_id: userId }); if (isNew) { if (viewingPack && viewingPack.id === pack.id) setViewingPack({ ...viewingPack, downloads: (viewingPack.downloads || 0) + 1 }); fetchCatalog(); } } } } catch(e) { console.error(e); } finally { setIsDownloading(false); } };
  const exportMrpack = async (pack: Modpack) => { if (!pack || Object.keys(pack.artifacts).length === 0) return; setIsDownloading(true); const zip = new JSZip(); const files = Object.values(pack.artifacts).map((mod: any) => ({ path: `mods/${mod.file_name}`, hashes: {}, env: { client: "required", server: "required" }, downloads: [mod.file_url] })); const mrpackIndex = { formatVersion: 1, game: "minecraft", versionId: "1.0.0", name: pack.name || "Modpack", files: files, dependencies: { minecraft: pack.gameVersion, [pack.loader]: "latest" } }; zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 2)); try { const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.mrpack`; a.click(); } catch(e) { console.error(e); } finally { setIsDownloading(false); } };
  const login = (provider: 'github' | 'google' = 'github') => { setIsLoggingIn(true); supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }); };
  const logout = () => supabase.auth.signOut();

  if (!isLoaded) return <div className="h-dvh bg-[#09090b] text-white flex items-center justify-center">Загрузка...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter((a: any) => !a.isLibrary);
  const filteredPackMods = modsList.filter((m: any) => m.title.toLowerCase().includes(packSearch.toLowerCase()));
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);
  const now = Date.now();
  const vipPacks = catalog.filter((p: any) => p.bumped_until && new Date(p.bumped_until).getTime() > now).sort((a: any,b: any) => new Date(b.bumped_until!).getTime() - new Date(a.bumped_until!).getTime());
  // Вычисляем Топ-3 (сортируем по рейтингу, лайкам и скачиваниям)
let sortedByRating = [...catalog].filter((p: any) => Number(p.rating || 0) >= 3).sort(calculateTopScore);
let top3Packs = sortedByRating.slice(0, 3);

let filteredCatalog = catalog.filter((pack: any) => {
    const matchVersion = catalogVersion === "all" || pack.game_version === catalogVersion;
    const matchLoader = catalogLoader === "all" || pack.loader === catalogLoader;
    const matchSearch = pack.name.toLowerCase().includes(catalogSearch.toLowerCase());
    const notInTop3 = !top3Packs.find((p: any) => p.id === pack.id);
    const notVip = !pack.bumped_until || new Date(pack.bumped_until).getTime() <= now;
    return matchVersion && matchLoader && matchSearch && notVip && notInTop3;
  });
  if (catalogSort === "downloads") filteredCatalog.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
  else if (catalogSort === "popularity") filteredCatalog.sort(calculateTopScore);
  const totalCatalogPages = Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE);
  const paginatedCatalog = filteredCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const formatTimeLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Истекло";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}ч ${m}м`;
  };

  return (
    <div className="flex h-dvh text-white font-sans overflow-hidden relative selection:bg-green-500/30">
      <style jsx global>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 6s linear infinite; }
        @keyframes popIn { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(34, 197, 94, 0.6); }
      `}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 z-0 pointer-events-none bg-black">
  <video ref={afishaVideoRef} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60">
    <source src="/bg-afisha.mp4" type="video/mp4" />
  </video>
  <div className="absolute inset-0 bg-black/30"></div>
</div>
      {isLoggingIn && <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center"><div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-6"></div><h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Вход...</h2></div>}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`bg-black/90 md:bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 transition-all duration-300 z-40 fixed inset-y-0 left-0 md:relative md:translate-x-0 ${isSidebarOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none"}`}>
        <div className="p-6 flex justify-between items-center"><h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-md">ModBuilder</h1><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-white p-2">✕</button></div>
        <div className="px-4 space-y-1 mb-4">
          <button onClick={() => { setView("mods"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "mods" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Сборщик</button>
          <button onClick={() => { setView("catalog"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "catalog" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Каталог сборок</button>
          <button onClick={() => { setView("shop"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "shop" ? "bg-yellow-500 text-black" : "hover:bg-white/10 text-white"}`}>Магазин</button>
          <button onClick={() => { setView("afisha"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "afisha" ? "bg-blue-500 text-white" : "hover:bg-white/10 text-white"}`}>Афиша</button>
          <button onClick={() => { setView("friends"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-colors ${view === "friends" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Сообщество {totalUnread > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{totalUnread}</span>}</button>
          
          <button onClick={() => { setView("profile"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "profile" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Мой профиль</button>
          {user?.id === ADMIN_ID && <button onClick={() => { setView("admin"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "admin" ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-500/10"}`}>👑 Админ-панель</button>}
        </div>
        {view === "mods" && (<><div className="px-6 pb-2 flex justify-between items-center text-sm font-bold text-zinc-400"><span>Мои сборки</span><button onClick={() => createNewPack()} className="text-white hover:text-green-400 text-lg" title="Создать">+</button></div><div className="flex-1 overflow-y-auto px-3 space-y-2 min-h-0 pb-4">{modpacks.map((pack: any) => (<div key={pack.id} onClick={() => { setActivePackId(pack.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`relative group p-4 rounded-2xl cursor-pointer border border-transparent transition-all ${activePackId === pack.id ? "bg-white/20 border-white/20 shadow-lg" : "hover:bg-white/10"}`}>{editingPackId === pack.id ? <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={saveRename} onKeyDown={(e) => e.key === "Enter" && saveRename()} className="bg-black/50 border border-green-500/50 rounded-lg px-2 py-1 text-sm w-full outline-none text-white" /> : <div className="font-bold text-sm truncate pr-14 text-white">{pack.name}</div>}<div className="text-xs text-zinc-300 mt-1">{pack.gameVersion} • {pack.loader.toUpperCase()}</div><div className="absolute top-4 right-3 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => startRenaming(pack.id, pack.name, e)} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/20">✎</button><button onClick={(e) => deletePack(pack.id, e)} className="text-zinc-400 hover:text-red-500 p-1 rounded-md hover:bg-white/20">✕</button></div></div>))}</div></>)}
        
                <div className="px-5 pb-4 flex flex-col gap-2">
          <div className="flex flex-col gap-2 text-xs text-zinc-500">
            <a href="/docs/offer" className="hover:text-green-400 transition-colors">Публичная оферта</a>
            <a href="/docs/privacy" className="hover:text-green-400 transition-colors">Политика конфиденциальности</a>
            <a href="/docs/how-it-works" className="hover:text-green-400 transition-colors">Как это работает</a>
            <a href="/requisites" className="hover:text-green-400 transition-colors">Реквизиты</a>
          </div>
          <button
            onClick={() => {
              const v = afishaVideoRef.current;
              if (!v) return;
              const nextMuted = !v.muted;
              v.muted = nextMuted;
              if (!nextMuted) { v.play().catch(() => {}); }
              setIsAfishaMuted(nextMuted);
            }}
            className="w-full mt-2 text-left px-4 py-2 rounded-xl font-bold transition-colors bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-between border border-white/10"
          >
            <span>Фоновый звук</span>
            <span className="text-lg">{isAfishaMuted ? "🔇" : "🔊"}</span>
          </button>
        </div>
<div className="p-5 mt-auto">{user ? (<div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center gap-3"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" /><div className="flex-1 min-w-0"><div className="text-green-400 text-xs mb-0.5">Вы вошли:</div><div className="truncate font-bold text-sm text-white">{profile?.username || user.email}</div></div><button onClick={logout} className="text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-xs transition-colors">Выйти</button></div>) : (<div className="flex flex-col gap-2"><button onClick={() => login('github')} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/20 text-white px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Войти через GitHub</button><button onClick={() => login('google')} className="bg-white hover:bg-gray-200 text-black border border-white/20 px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Войти через Google</button></div>)}</div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10 w-full">
        {view === "mods" && (<><header className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4 bg-black/30 backdrop-blur-xl z-20"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4 w-full md:w-auto"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/10 hover:bg-white/20 border border-white/20 p-3 rounded-xl shrink-0 transition-colors text-white">Меню</button><input type="text" placeholder="Поиск модов..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 md:flex-none md:w-96 bg-black/30 border border-white/20 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-green-500/50 focus:bg-black/50 transition-all text-white placeholder-zinc-400" /></div><div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto"><CustomSelect value={activePack?.gameVersion || "1.16.5"} onChange={(val) => updateActivePack({ gameVersion: val })} options={[{ value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }, { value: "1.21.1", label: "1.21.1" }]} /><CustomSelect value={activePack?.loader || "forge"} onChange={(val) => updateActivePack({ loader: val })} options={[{ value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} /><button onClick={() => setIsPackOpen(true)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] flex-1 md:flex-none">Сборка ({modsList.length})</button></div></div><div className="flex flex-wrap gap-2">{CATEGORIES.map(cat => (<button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${selectedCategories.includes(cat.id) ? "bg-green-500/30 border-green-500/60 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{cat.label}</button>))}</div></header><div className="flex-1 overflow-y-auto p-4 md:p-6">{isLoading ? <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div></div> : (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">{results.map(mod => (<div key={mod.project_id} onClick={() => openModModal(mod)} className="bg-black/50 backdrop-blur-md border border-white/10 p-5 rounded-3xl hover:border-green-500/50 hover:bg-black/60 cursor-pointer flex flex-col gap-4 shadow-xl hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all duration-300 hover:-translate-y-1 group"><div className="flex items-center gap-4 relative z-10"><div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-lg group-hover:scale-105 transition-transform border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div><div className="min-w-0"><h3 className="font-bold text-lg truncate pr-2 text-white">{mod.title}</h3><div className="text-xs text-zinc-400 mt-1">⬇ {mod.downloads.toLocaleString()}</div></div></div><p className="text-sm text-zinc-300 line-clamp-3 flex-1 relative z-10">{mod.description}</p><button onClick={(e) => { e.stopPropagation(); handleAddMod(mod); }} disabled={isAdding === mod.project_id || !!activePack?.artifacts[mod.project_id]} className="bg-white/10 hover:bg-green-500 hover:text-black py-2.5 rounded-xl font-bold text-sm transition-colors relative z-10 border border-white/10 hover:border-green-500">{isAdding === mod.project_id ? "..." : activePack?.artifacts[mod.project_id] ? "Добавлено" : "+ В сборку"}</button></div>))}</div>)}{totalPages > 1 && (<div className="flex flex-wrap justify-center items-center gap-2 mt-8 mb-4"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">← Назад</button><div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-2"><span className="text-sm text-zinc-400">Стр.</span><input type="number" min="1" max={totalPages} value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const val = parseInt(pageInput); if (val >= 1 && val <= totalPages) { setCurrentPage(val); } } }} className="w-16 bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="text-sm text-zinc-400">из {totalPages}</span></div><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Вперед →</button></div>)}</div></>)}
        {view === "catalog" && (<div className="flex-1 overflow-y-auto p-4 md:p-8"><h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">Каталог сборок</h2><div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md relative z-20"><div className="flex-1 min-w-[200px] flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Поиск</span><input type="text" placeholder="Название сборки..." value={catalogSearch} onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 text-white placeholder-zinc-400" /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Версия</span><CustomSelect value={catalogVersion} onChange={(v) => { setCatalogVersion(v); setCatalogPage(1); }} options={[{ value: "all", label: "Все версии" }, { value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Загрузчик</span><CustomSelect value={catalogLoader} onChange={(v) => { setCatalogLoader(v); setCatalogPage(1); }} options={[{ value: "all", label: "Все" }, { value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Сортировка</span><CustomSelect value={catalogSort} onChange={(v) => { setCatalogSort(v); setCatalogPage(1); }} options={[{ value: "newest", label: "Сначала новые" }, { value: "downloads", label: "По скачиваниям" }, { value: "popularity", label: "По популярности" }]} /></div></div>{catalogError && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">Ошибка: {catalogError}</div>}{vipPacks.length > 0 && (<div className="mb-10"><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-yellow-400">⭐ VIP-Витрина <span className="text-sm font-normal text-zinc-500 ml-2">Занято {vipPacks.length} из 30</span></h3></div><div className="flex overflow-x-auto gap-6 pb-4 snap-x scrollbar-thin scrollbar-thumb-yellow-500/50 scrollbar-track-transparent">{vipPacks.map((pack, index) => (<div key={pack.id} onClick={() => setViewingPack(pack)} className="snap-start shrink-0 w-80 bg-[#121214]/90 backdrop-blur-md border border-yellow-500/40 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-yellow-400 transition-all hover:-translate-y-1"><div className="w-full h-40 bg-zinc-800 relative border-b border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">🖼️</div>}<div className="absolute top-3 left-3 bg-yellow-500 text-black px-3 py-1 rounded-xl font-black text-sm flex items-center gap-1">{index === 0 ? "🥇 1" : index === 1 ? "🥈 2" : index === 2 ? "🥉 3" : "VIP"}</div><div className="absolute top-3 right-3 bg-black/70 text-yellow-300 px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-md">{formatTimeLeft(pack.bumped_until!)}</div></div><div className="p-5"><h3 className="text-xl font-bold">{pack.name}</h3><div className="text-sm text-zinc-400 mt-1">{pack.game_version} • {pack.loader.toUpperCase()}</div><div className="flex justify-between mt-3 text-sm"><span className="text-green-400 font-bold">⬇ {pack.downloads || 0}</span><span className="text-pink-400">❤️ {pack.likes || 0}</span></div></div></div>))}</div></div>)}{/* ТОП-3 СБОРОК */}
{top3Packs.length > 0 && catalogSearch === "" && catalogVersion === "all" && catalogLoader === "all" && (
  <div className="mb-12">
    <h3 className="text-xl font-bold text-white mb-4">🏆 Топ-3 сборки</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {top3Packs.map((pack: any, index: number) => (
        <div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-gradient-to-b from-[#1a1a1c] to-[#121214] border border-yellow-500/30 rounded-3xl flex flex-col shadow-2xl relative group overflow-hidden cursor-pointer hover:-translate-y-1 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400"></div>
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-xl font-black text-sm z-10 flex items-center gap-1 border border-white/10">
            {index === 0 ? "🥇 1 место" : index === 1 ? "🥈 2 место" : "🥉 3 место"}
          </div>
          <div className="w-full h-40 bg-zinc-800 relative border-b border-white/10">
            {pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">🖼️</div>}
          </div>
          <div className="p-5 flex flex-col flex-1">
            <h3 className="text-xl font-bold text-white mb-1 truncate">{pack.name}</h3>
            <div className="text-sm text-zinc-400 mb-3">{pack.game_version} • {pack.loader.toUpperCase()}</div>
            <div className="mt-auto flex justify-between items-center text-sm border-t border-white/10 pt-3">
              <div className="flex gap-3 text-xs">
                <span className="text-pink-400">❤️ {pack.likes || 0}</span>
                <span className="text-yellow-400">★ {Number(pack.rating || 0).toFixed(1)}</span>
              </div>
              <span className="text-green-400 font-bold">⬇ {pack.downloads || 0}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{paginatedCatalog.map(pack => (<div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/80 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-green-500/50 transition-all hover:-translate-y-1"><div className="w-full h-48 bg-zinc-800 relative border-b border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">🖼️</div>}{user && user.id === pack.user_id && (<button onClick={(e) => deleteFromCatalog(pack.id, e)} className="absolute top-4 right-4 text-zinc-300 hover:text-red-500 bg-black/60 hover:bg-black/90 p-2.5 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100 z-10" title="Удалить из каталога">✕</button>)}</div><div className="p-5 flex flex-col gap-3 flex-1"><div className="flex items-center gap-3 border-b border-white/10 pb-3"><AvatarWithFrame url={pack.profiles?.avatar_url} frame={pack.profiles?.frame} size="w-10 h-10" /><div><div className="font-bold text-xs text-green-400 flex items-center gap-2 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserProfile(pack.user_id); }}>{pack.profiles?.username || "Игрок"}<TitleBadge titleName={pack.profiles?.title || "Новичок"} /></div><div className="text-[10px] text-zinc-400">{pack.profiles?.title || "Новичок"}</div></div></div><h3 className="text-xl font-bold pr-6 leading-tight">{pack.name}</h3><div className="text-sm text-zinc-400">{pack.game_version} • {pack.loader.toUpperCase()}</div><div className="text-sm text-zinc-300 flex justify-between items-center mt-auto pt-2 border-t border-white/5"><div className="flex gap-3 text-xs"><span className="text-zinc-400">Модов: {Object.keys(pack.artifacts).length}</span><span className="text-pink-400">❤️ {pack.likes || 0}</span><span className="text-yellow-400">★ {Number(pack.rating || 0).toFixed(1)}</span></div><span className="text-green-400 font-bold">⬇ {pack.downloads || 0}</span></div></div></div>))}{filteredCatalog.length === 0 && !catalogError && <div className="text-zinc-500 col-span-full">По вашему запросу ничего не найдено.</div>}</div>{totalCatalogPages > 1 && (<div className="flex justify-center items-center gap-2 mt-8"><button onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">← Назад</button><span className="text-sm text-zinc-400 mx-4 font-bold">Стр. {catalogPage} из {totalCatalogPages}</span><button onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))} disabled={catalogPage === totalCatalogPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Вперед →</button></div>)}</div>)}

        {view === "friends" && user && (<div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-transparent"><div className={`w-full md:w-80 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md shrink-0 ${activeChat ? 'hidden md:flex' : 'flex'}`}><div className="p-4 border-b border-white/10"><h2 className="text-xl font-bold mb-4">Сообщество</h2><input type="text" placeholder="Поиск игроков..." value={searchQuery} onChange={(e) => searchUsers(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" />{searchResults.length > 0 && (<div className="mt-2 bg-[#121214] border border-white/10 rounded-xl overflow-hidden">{searchResults.map(u => (<div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 border-b border-white/5 last:border-0"><div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(u.id)}><AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-6 h-6" /><span className="text-sm truncate hover:underline">{u.username}</span></div><button onClick={() => sendFriendRequest(u.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">+</button></div>))}</div>)}</div>{requests.length > 0 && (<div className="p-4 border-b border-white/10"><h3 className="text-sm font-bold text-zinc-400 mb-2">Заявки</h3>{requests.map(req => (<div key={req.id} className="flex items-center justify-between mb-2 bg-white/5 p-2 rounded-lg"><div className="flex items-center gap-2"><AvatarWithFrame url={req.profile?.avatar_url} frame={req.profile?.frame} size="w-8 h-8" /><span className="text-sm truncate">{req.profile?.username}</span></div><button onClick={() => acceptRequest(req.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">Принять</button></div>))}</div>)}<div className="flex-1 overflow-y-auto p-4"><div className="flex justify-between items-center mb-2"><h3 className="text-sm font-bold text-zinc-400">Мои друзья</h3><button onClick={fetchFriends} className="text-xs text-green-500 hover:text-green-400">Обновить</button></div>{friends.length === 0 && <div className="text-zinc-500 text-sm">Пока нет друзей</div>}{friends.map(f => { const unread = unreadCounts[f.id] || 0; return (<div key={f.id} onClick={() => handleOpenChat(f)} className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${activeChat?.id === f.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="flex items-center gap-3 truncate"><AvatarWithFrame url={f.avatar_url} frame={f.frame} size="w-10 h-10" /><div className="truncate font-bold text-sm flex items-center gap-2">{f.username} {unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>}</div></div><button onClick={(e) => removeFriend(f.id, e)} className="text-zinc-500 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить">✕</button></div>); })}</div></div><div className={`flex-1 flex flex-col bg-black/10 backdrop-blur-sm relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>{activeChat ? (<><div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40"><div className="flex items-center gap-3"><button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-400 hover:text-white mr-2 text-xl">←</button><AvatarWithFrame url={activeChat.avatar_url} frame={activeChat.frame} size="w-10 h-10" /><div><h3 className="font-bold text-lg leading-tight flex items-center gap-2">{activeChat.username}<TitleBadge titleName={activeChat.title || "Новичок"} /></h3>{isFriendTyping && <span className="text-xs text-green-400 animate-pulse">Печатает...</span>}</div></div><button onClick={clearChat} className="text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Очистить</button></div><div ref={messagesContainerRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto p-6 space-y-4 relative transition-colors ${isDraggingOver ? "bg-green-500/10 border-2 border-dashed border-green-500" : ""}`} onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={handleDrop}>{messages.length === 0 && <div className="text-center text-zinc-500 mt-10">Начните общение!</div>}{messages.map(m => (<div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"} group`}>{editingMessageId === m.id ? (<div className="flex flex-col gap-2 max-w-[70%] w-full items-end"><input autoFocus value={editMessageContent} onChange={e => setEditMessageContent(e.target.value)} className="w-full bg-black/50 border border-green-500 rounded-xl px-4 py-2 text-white outline-none" onKeyDown={(e) => e.key === 'Enter' && saveEditMessage(m.id)} /><div className="flex gap-2"><button onClick={() => cancelEditMessage()} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">Отмена</button><button onClick={() => saveEditMessage(m.id)} className="text-xs bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg">Сохранить</button></div></div>) : (<div className={`relative max-w-[85%] md:max-w-[70%] p-3 rounded-2xl ${m.sender_id === user.id ? "bg-zinc-800 text-white rounded-br-none" : "bg-zinc-700 text-white rounded-bl-none"}`}>{isImageUrl(m.content) ? (<div className="relative group/img rounded-xl overflow-hidden border border-white/10"><div className="cursor-pointer" onClick={() => setLightboxUrl(m.content)}><img src={m.content} alt="attachment" className="max-h-60 w-auto object-contain" /></div>{m.sender_id !== user.id && (<button onClick={(e) => saveGifToCollection(m.content, e)} className="absolute bottom-2 right-2 bg-black/70 hover:bg-green-500 text-white hover:text-black rounded-lg px-2 py-1 text-xs opacity-100 md:opacity-0 group-hover/img:opacity-100 transition-all font-bold z-10" title="Сохранить в мои гифки">💾 В гифки</button>)}</div>) : (<p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>)}<div className={`text-[10px] mt-1 text-right ${m.sender_id === user.id ? "text-zinc-400" : "text-zinc-400"}`}>{formatTime(m.created_at)}</div>{m.sender_id === user.id && !isImageUrl(m.content) && (<div className="absolute top-1/2 -translate-y-1/2 -left-16 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEditMessage(m.id, m.content)} className="text-zinc-400 hover:text-white p-1" title="Редактировать">✎</button><button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1" title="Удалить">✕</button></div>)}{m.sender_id === user.id && isImageUrl(m.content) && (<div className="absolute top-1/2 -translate-y-1/2 -left-10 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1 bg-black/50 rounded-full" title="Удалить">✕</button></div>)}</div>)}</div>))}{isFriendTyping && (<div className="flex justify-start"><div className="bg-white/10 text-white rounded-2xl rounded-bl-none p-3 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span></div></div>)}<div ref={chatEndRef} /></div><div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">{previewUrl && (<div className="relative w-32 h-32 rounded-xl overflow-hidden border border-green-500 mb-2 group"><img src={previewUrl} alt="preview" className="w-full h-full object-contain bg-black/50" /><button onClick={() => { setAttachedFile(null); setPreviewUrl(null); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>)}<div className="flex gap-2 items-center relative">{showEmojiPicker && (<div className="absolute bottom-full mb-2 left-0 bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-80 animate-in slide-in-from-bottom-2"><div className="flex gap-2 mb-3 border-b border-white/10 pb-2"><button onClick={() => setEmojiTab("emojis")} className={`text-sm font-bold ${emojiTab === "emojis" ? "text-green-400" : "text-zinc-400"}`}>Эмодзи</button><button onClick={() => setEmojiTab("gifs")} className={`text-sm font-bold ${emojiTab === "gifs" ? "text-green-400" : "text-zinc-400"}`}>Гифки</button></div>{emojiTab === "emojis" ? (<div className="grid grid-cols-6 gap-2">{EMOJIS.map(e => (<button key={e} onClick={() => setNewMessage(prev => prev + e)} className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</button>))}</div>) : (<div><div className="flex gap-2 mb-3 text-xs"><button onClick={() => setGifSubTab("my")} className={`px-2 py-1 rounded font-bold ${gifSubTab === "my" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Мои</button><button onClick={() => setGifSubTab("global")} className={`px-2 py-1 rounded font-bold ${gifSubTab === "global" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Общие</button></div><div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">{gifSubTab === "my" ? myGifs.map((gif) => (<div key={gif.id} onClick={() => sendMessage(gif.url)} className="cursor-pointer hover:opacity-80 rounded-lg overflow-hidden border border-white/10 h-20 relative group"><img src={gif.url} alt="gif" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-xs font-bold bg-green-500 text-black px-2 py-1 rounded">Отправить</span></div><button onClick={(e) => { e.stopPropagation(); deleteGif(gif.id, false); }} className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>)) : globalGifs.map((gif) => (<div key={gif.id} onClick={() => sendMessage(gif.url)} className="cursor-pointer hover:opacity-80 rounded-lg overflow-hidden border border-white/10 h-20 relative group"><img src={gif.url} alt="gif" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-xs font-bold bg-green-500 text-black px-2 py-1 rounded">Отправить</span></div></div>))}{gifSubTab === "my" && (<button onClick={() => gifUploadRef.current?.click()} disabled={isUploadingGif} className="h-20 border border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"><span className="text-xl mb-1">+</span> {isUploadingGif ? "..." : "Загрузить"}</button>)}<input type="file" ref={gifUploadRef} onChange={(e) => handleGifUpload(e, false)} className="hidden" accept="image/gif,image/png,image/jpeg,image/webp,video/mp4" /></div></div>)}</div>)}<button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">😊</button><button onClick={() => fileInputRef.current?.click()} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">📎</button><input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" /><input type="text" value={newMessage} onChange={(e) => { setNewMessage(e.target.value); }} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Написать..." className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" /><button onClick={() => sendMessage()} disabled={isSendingFile} className="bg-green-500 hover:bg-green-400 text-black px-4 md:px-6 py-3 rounded-xl font-bold disabled:opacity-50">{isSendingFile ? "..." : "Отправить"}</button></div></div></>) : (<div className="flex-1 flex items-center justify-center text-zinc-500">Выберите друга, чтобы начать переписку</div>)}</div></div>)}

        
        {view === "shop" && (user ? (<Shop user={user} processPayment={processPayment} />) : (<div className="flex-1 flex items-center justify-center p-8"><div className="bg-[#121214] border border-white/10 rounded-3xl p-10 text-center max-w-md"><h2 className="text-2xl font-black text-white mb-4">Магазин доступен после входа</h2><p className="text-zinc-400 mb-6">Войдите через GitHub или Google, чтобы покупать и открывать предметы.</p><div className="flex flex-col gap-2"><button onClick={() => login('github')} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/20 text-white px-4 py-3 rounded-xl font-bold w-full">Войти через GitHub</button><button onClick={() => login('google')} className="bg-white hover:bg-gray-200 text-black px-4 py-3 rounded-xl font-bold w-full">Войти через Google</button></div></div></div>))}
        {view === "afisha" && (
  <div className="flex-1 overflow-y-auto relative p-4 md:p-8 min-h-[calc(100dvh-4rem)]">
    <div className="max-w-6xl mx-auto relative z-10">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 drop-shadow-lg">Афиша обновлений</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#121214]/80 backdrop-blur-md border border-blue-500/30 rounded-3xl overflow-hidden shadow-2xl hover:-translate-y-1 transition-all group">
          <div className="h-40 bg-gradient-to-br from-blue-600/40 to-indigo-900/40 relative flex items-center justify-center"><div className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-500">💰</div></div>
          <div className="p-6"><div className="text-xs text-blue-400 font-bold mb-2 uppercase tracking-widest">Новое</div><h3 className="text-xl font-bold text-white mb-3">Запуск системы заработка</h3><p className="text-sm text-zinc-300 leading-relaxed">Теперь авторы могут подключать ShopId во вкладке «Заработок» и получать 80% с каждой продажи своей сборки прямо на карту.</p></div>
        </div>
        <div className="bg-[#121214]/80 backdrop-blur-md border border-green-500/30 rounded-3xl overflow-hidden shadow-2xl hover:-translate-y-1 transition-all group">
          <div className="h-40 bg-gradient-to-br from-green-600/40 to-emerald-900/40 relative flex items-center justify-center"><div className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-500">🏆</div></div>
          <div className="p-6"><div className="text-xs text-green-400 font-bold mb-2 uppercase tracking-widest">Обновление</div><h3 className="text-xl font-bold text-white mb-3">Улучшенный каталог сборок</h3><p className="text-sm text-zinc-300 leading-relaxed">Мы добавили Топ-3 лучших сборок с медальками и сделали VIP-витрину более удобной. Ищите самые популярные сборки наверху!</p></div>
        </div>
        <div className="bg-[#121214]/80 backdrop-blur-md border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl hover:-translate-y-1 transition-all group">
          <div className="h-40 bg-gradient-to-br from-purple-600/40 to-fuchsia-900/40 relative flex items-center justify-center"><div className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-500">🚀</div></div>
          <div className="p-6"><div className="text-xs text-purple-400 font-bold mb-2 uppercase tracking-widest">Скоро</div><h3 className="text-xl font-bold text-white mb-3">Вывод средств в один клик</h3><p className="text-sm text-zinc-300 leading-relaxed">В будущем вы сможете хранить деньги на платформе и выводить их на СБП или карту без каких-либо сложностей.</p></div>
        </div>
      </div>
    </div>
  </div>
)}
        {view === "profile" && user && (<div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center"><div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl"><div className="w-full lg:w-1/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center h-fit"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-40 h-40" /><div className="text-center mt-4 mb-6"><h2 className="text-2xl font-black text-white">{profile?.username || "Игрок"}</h2><div className="mt-3 mb-2 flex justify-center"><TitleBadge titleName={profile?.title || "Новичок"} size="lg" /></div><div className="text-xs text-zinc-400 mt-1 uppercase tracking-widest">{profile?.role === 'admin' ? 'Администратор' : profile?.role === 'moderator' ? 'Модератор' : 'Пользователь'}</div></div><div className="w-full space-y-4"><div><label className="text-sm text-zinc-400 mb-1 block">Аватарка</label><input type="file" id="avatar-upload" accept="image/*" onChange={uploadAvatar} className="hidden" /><label htmlFor="avatar-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block">{isUploading ? "Загрузка..." : "Выбрать фото"}</label></div><div><label className="text-sm text-zinc-400 mb-1 block">Никнейм</label><input type="text" value={profile?.username || ""} onChange={(e) => setProfile({...profile, username: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" /></div><div><label className="text-sm text-zinc-400 mb-1 block">О себе</label><textarea value={profile?.bio || ""} onChange={(e) => setProfile({...profile, bio: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-24 resize-none" placeholder="Расскажите о себе..."></textarea></div><button onClick={() => saveProfile({ username: profile.username, bio: profile.bio })} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-colors mt-4">Сохранить изменения</button></div></div><div className="w-full lg:w-2/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col min-h-[500px]"><h3 className="text-2xl font-black text-white mb-6">Инвентарь</h3><div className="flex gap-2 border-b border-white/10 mb-6 pb-2"><button onClick={() => setProfileTab("frames")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "frames" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Рамки</button><button onClick={() => setProfileTab("titles")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "titles" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Титулы</button>
            <button onClick={() => setProfileTab("earnings")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "earnings" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Заработок</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {profileTab === "frames" && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                <button onClick={() => { setProfile({...profile, frame: "default"}); saveProfile({ username: profile.username, frame: "default" }); }} className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-4 ${profile?.frame === "default" || !profile?.frame ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`} title="Без рамки">
                  <div className="w-16 h-16 rounded-full border-2 border-white/10 bg-zinc-800 flex items-center justify-center text-3xl mb-3">🚫</div>
                  <span className="text-xs text-zinc-400 text-center leading-tight font-bold">Без рамки</span>
                </button>
              </div>
            )}
            {profileTab === "earnings" && (
  <div className="flex flex-col gap-6">
    <div className="bg-[#121214] p-6 rounded-3xl border border-white/10">
      <h3 className="text-xl font-bold text-white mb-4">Ваш доход и комиссия</h3>
      <p className="text-sm text-zinc-400 mb-6">Комиссия платформы снижается по мере роста ваших продаж. Чем больше вы зарабатываете, тем меньше мы берем.</p>
      
      <div className="flex justify-between text-sm font-bold text-zinc-300 mb-2">
        <span>Оборот: {profile?.total_sales || 0} ₽</span>
        <span>Текущая комиссия: {
          (profile?.total_sales || 0) >= 50001 ? "19%" :
          (profile?.total_sales || 0) >= 30001 ? "20%" :
          (profile?.total_sales || 0) >= 15001 ? "21%" :
          (profile?.total_sales || 0) >= 5001 ? "22%" : "23%"
        }</span>
      </div>
      <div className="w-full bg-black/50 h-4 rounded-full overflow-hidden border border-white/10 relative">
        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, ((profile?.total_sales || 0) / 50000) * 100)}%` }}></div>
      </div>
      <p className="text-xs text-zinc-500 mt-2 text-right">До комиссии 19% осталось: {Math.max(0, 50000 - (profile?.total_sales || 0))} ₽</p>
    </div>

    <div className="bg-[#121214] p-6 rounded-3xl border border-white/10">
      <h3 className="text-xl font-bold text-white mb-4">Настройки выплат</h3>
      <div className="text-sm text-zinc-400 mb-4 space-y-2">
  <p>Чтобы продавать сборки и получать деньги автоматически, вам нужно подключиться к ЮKassa как продавец и получить <strong>ShopId</strong>.</p>
  <ul className="list-disc pl-4 space-y-1 text-xs">
    <li><strong>ИП на НПД</strong> — самый простой и надежный вариант. Налог 4-6%, нет отчетности и взносов.</li>
    <li><strong>Самозанятый (физлицо)</strong> — тоже можно, но ЮKassa больше не формирует чеки автоматически. Вам придется самостоятельно выдавать чеки в приложении «Мой налог».</li>
  </ul>
  <p className="text-xs mt-2">После получения ShopId вставьте его в поле ниже. Платежи будут распределяться автоматически: <strong>{
    (profile?.total_sales || 0) >= 50001 ? "81" :
    (profile?.total_sales || 0) >= 30001 ? "80" :
    (profile?.total_sales || 0) >= 15001 ? "79" :
    (profile?.total_sales || 0) >= 5001 ? "78" : "77"
  }% вам</strong>, остальное — комиссия платформы.</p>
</div>
      <label className="text-sm text-zinc-400 mb-2 block font-bold">Ваш ShopId (ЮKassa)</label>
      <div className="flex gap-2">
        <input type="text" placeholder="Введите ShopId..." value={profile?.yookassa_shop_id || ""} onChange={(e) => setProfile({...profile, yookassa_shop_id: e.target.value})} className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm" />
        <button onClick={() => saveProfile({ yookassa_shop_id: profile.yookassa_shop_id })} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-xl font-bold transition-colors">Сохранить</button>
      </div>
    </div>

    <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-3xl flex items-center gap-4">
      <div className="text-4xl">🚀</div>
      <div>
        <h4 className="font-bold text-yellow-400">Скоро: автоматический вывод</h4>
        <p className="text-sm text-zinc-300">В будущем вы сможете хранить деньги на платформе и выводить их в один клик на карту или СБП.</p>
      </div>
    </div>
  </div>
)}{profileTab === "titles" && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{TITLES.map((t: any) => { const isOwned = profile?.owned_titles?.includes(t.id) || (t.id === 'admin' && user.id === ADMIN_ID); if (!isOwned) return null; return (<button key={t.id} onClick={() => saveProfile({ username: profile.username, title: t.name })} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${profile?.title === t.name ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`}><TitleBadge titleName={t.name} /><div className="text-[10px] text-zinc-500 uppercase tracking-widest">{(t as any).type}</div></button>); })}{(!profile?.owned_titles || profile?.owned_titles.length === 0) && user.id !== ADMIN_ID && (<div className="text-zinc-500 col-span-full">У вас пока нет титулов</div>)}</div>)}</div></div></div></div>)}

        {view === "admin" && user?.id === ADMIN_ID && (<div className="flex-1 overflow-y-auto p-4 md:p-8"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"><h2 className="text-3xl font-black text-red-500 drop-shadow-lg">Админ-панель</h2><input type="text" placeholder="Поиск игрока..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-red-500 text-white w-full md:w-auto" /></div>
        
        <div className="mb-8 bg-[#121214] p-6 rounded-3xl border border-white/10 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">Библиотека общих гифок</h3>
          <div className="flex flex-wrap gap-4 mb-4">
            {globalGifs.map((gif) => (
              <div key={gif.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 group">
                <img src={gif.url} alt="gif" className="w-full h-full object-cover" />
                <button onClick={() => deleteGif(gif.id, true)} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
            <label className="w-24 h-24 border border-dashed border-white/30 rounded-xl flex flex-col items-center justify-center text-xs text-zinc-400 hover:bg-white/5 cursor-pointer">
              <span className="text-xl mb-1">+</span> {isUploadingGif ? "..." : "Добавить"}
              <input type="file" onChange={(e) => handleGifUpload(e, true)} className="hidden" accept="image/gif,image/png,image/jpeg,image/webp,video/mp4" />
            </label>
          </div>
          <p className="text-xs text-zinc-500">Эти гифки видны всем пользователям во вкладке "Общие" в чате.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{adminUsers.filter((u: any) => u.username?.toLowerCase().includes(adminSearch.toLowerCase())).map((u: any) => (<div key={u.id} className="bg-[#121214] p-6 rounded-3xl border border-white/10 flex flex-col gap-4"><div className="flex items-center gap-3"><AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-12 h-12" /><div><div className="font-bold text-lg text-white">{u.username || 'Без имени'}</div><div className="text-xs text-zinc-400">ID: {u.id.slice(0, 8)}...</div><div className="text-xs text-zinc-400">Роль: <span className="text-green-400 font-bold">{u.role || 'user'}</span></div></div></div><div className="border-t border-white/10 pt-3"><label className="text-sm text-zinc-400 mb-2 block">Назначить роль</label><select value={u.role || 'user'} onChange={(e) => updateRole(u.id, e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white"><option value="user">Пользователь</option><option value="moderator">Модератор</option><option value="admin">Администратор</option></select></div><div className="border-t border-white/10 pt-3 flex-1"><label className="text-sm text-zinc-400 mb-2 block">Титулы</label><div className="flex flex-wrap gap-2">{TITLES.map((t: any) => { const hasTitle = u.owned_titles?.includes(t.id); return (<button key={t.id} onClick={() => toggleTitle(u.id, t.id)} className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${hasTitle ? "bg-green-500/20 border-green-500/30 text-green-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/30"}`} title={hasTitle ? "Забрать" : "Выдать"}>{t.name}</button>); })}</div></div></div>))}</div></div>)}
      </main>

      <div className={`fixed inset-y-0 right-0 w-full md:w-[28rem] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[60] transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center"><h2 className="text-2xl font-black text-white">Моя сборка</h2><button onClick={() => setIsPackOpen(false)} className="bg-white/10 hover:bg-white/20 border border-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-white">✕</button></div>
        <div className="p-4 border-b border-white/10 shrink-0"><input type="text" placeholder="Поиск по сборке..." value={packSearch} onChange={(e) => setPackSearch(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" /></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">{filteredPackMods.map((mod: any) => (<div key={mod.project_id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div><span className="text-sm font-bold truncate text-white">{mod.title}</span></div><button onClick={() => removeArtifact(mod.project_id)} className="text-red-500 hover:text-red-400 p-2">✕</button></div>))}{filteredPackMods.length === 0 && <div className="text-center text-zinc-400 mt-10">Ничего не найдено</div>}</div>
        <div className="p-4 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button onClick={() => downloadModpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.4)]">{isDownloading ? "Скачивание..." : "Скачать .zip"}</button>
          <button onClick={() => exportMrpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">{isDownloading ? "..." : "Экспорт в .mrpack"}</button>
          <button onClick={() => setIsPublishModalOpen(true)} disabled={modsList.length === 0 || !user} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">{activePack?.published_id ? "Обновить в каталоге" : "Опубликовать в каталоге"}</button>
        </div>
      </div>

      {viewingPack && (<div className="fixed inset-0 bg-[#09090b] z-[70] overflow-y-auto w-full h-full flex flex-col animate-in fade-in duration-200"><div className="w-full h-[40vh] min-h-[300px] relative shrink-0">{viewingPack.cover_url ? <Image src={viewingPack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-8xl opacity-10 bg-zinc-900">🖼️</div>}<div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent"></div><button onClick={() => setViewingPack(null)} className="absolute top-8 right-8 text-white bg-black/50 hover:bg-black/80 w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md z-10">✕</button><div className="absolute bottom-10 left-4 md:left-10 max-w-4xl"><h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">{viewingPack.name}</h1><div className="flex flex-wrap items-center gap-4 text-zinc-300"><div onClick={() => openUserProfile(viewingPack.user_id)} className="flex items-center gap-2 bg-black/40 hover:bg-black/60 cursor-pointer px-4 py-2 rounded-xl backdrop-blur-md transition-colors"><AvatarWithFrame url={viewingPack.profiles?.avatar_url} frame={viewingPack.profiles?.frame} size="w-8 h-8" /><span className="font-bold text-sm text-white hover:underline">{viewingPack.profiles?.username || "Игрок"}</span><TitleBadge titleName={viewingPack.profiles?.title || "Новичок"} /></div><div className="bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold">{viewingPack.game_version} • {viewingPack.loader.toUpperCase()}</div></div></div></div><div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12"><div className="lg:col-span-2 space-y-12">{viewingPack.video_url && getYouTubeID(viewingPack.video_url) && (<div className="w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeID(viewingPack.video_url)}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>)}{viewingPack.screenshots && viewingPack.screenshots.length > 0 && (<div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Скриншоты</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{viewingPack.screenshots.map((url, i) => (<div key={i} className="w-full aspect-video rounded-2xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => setLightboxUrl(url)}><Image src={url} alt="screenshot" fill className="object-contain" unoptimized /></div>))}</div></div>)}<div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Описание</h3><div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-[#121214] p-6 md:p-8 rounded-3xl border border-white/5 shadow-xl leading-relaxed whitespace-pre-wrap">{viewingPack.description || "Автор пока не добавил описание."}</div></div><div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Моды ({Object.keys(viewingPack.artifacts).length})</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.values(viewingPack.artifacts).map((mod: any) => (<div key={mod.project_id} className="flex items-center gap-3 bg-[#121214] p-3 rounded-2xl border border-white/5"><div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative border border-white/10 shrink-0">{mod.icon_url ? <Image src={mod.icon_url} alt="icon" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl">🧩</div>}</div><div className="min-w-0"><div className="text-sm font-bold truncate text-white">{mod.title}</div><div className="text-xs text-zinc-500 truncate">{mod.isLibrary ? "Библиотека" : "Мод"}</div></div></div>))}</div></div><div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Комментарии</h3>{user ? (<div className="flex gap-3 mb-6"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" /><div className="flex-1 flex gap-2"><input type="text" placeholder="Написать комментарий..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && postComment()} className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" /><button onClick={postComment} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-bold transition-colors">Отправить</button></div></div>) : (<div className="text-zinc-500 mb-6 bg-white/5 p-4 rounded-xl text-center">Войдите, чтобы оставить комментарий</div>)}<div className="space-y-4">{comments.length === 0 && <div className="text-zinc-500 text-sm">Пока нет комментариев.</div>}{comments.map((c: any) => (<div key={c.id} className="bg-[#121214] p-4 rounded-2xl border border-white/5 flex gap-3"><AvatarWithFrame url={c.profiles?.avatar_url} frame={c.profiles?.frame} size="w-8 h-8" /><div><div className="flex items-center gap-2 mb-1"><span className="font-bold text-sm text-green-400">{c.profiles?.username || "Игрок"}</span><TitleBadge titleName={c.profiles?.title || "Новичок"} /><span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.content}</p></div></div>))}</div></div></div><div className="space-y-6"><div className="bg-[#121214] p-6 rounded-3xl border border-white/10 shadow-xl sticky top-8"><div className="flex items-center justify-between mb-6"><div className="flex flex-col"><span className="text-3xl font-black text-green-400">{viewingPack.downloads || 0}</span><span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Скачиваний</span></div><button onClick={(e) => toggleLike(viewingPack.id, e)} className={`flex flex-col items-center gap-1 group transition-transform hover:scale-110 ${likedPacks.includes(viewingPack.id) ? "text-pink-500" : "text-zinc-400 hover:text-pink-400"}`}><span className="text-3xl">{likedPacks.includes(viewingPack.id) ? "❤️" : "🤍"}</span><span className="text-xs font-bold">{viewingPack.likes || 0} лайков</span></button></div><div className={`mb-6 pb-6 border-b border-white/10 flex flex-col items-center gap-2 ${isOwnPack ? "opacity-50" : ""}`}><div className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Оценка сборки</div><div className="flex gap-1">{[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={(e) => !isOwnPack && setRating(viewingPack.id, star, e)} disabled={isOwnPack} className={`text-3xl transition-transform ${isOwnPack ? "cursor-not-allowed" : "hover:scale-125"} ${star <= (userRatings[viewingPack.id] || 0) ? "text-yellow-400" : "text-zinc-600 hover:text-yellow-400/50"}`}>★</button>))}</div><div className="text-sm font-bold text-zinc-300 mt-1">{Number(viewingPack.rating || 0) > 0 ? `${Number(viewingPack.rating).toFixed(1)} / 5` : "Нет оценок"}</div></div><button onClick={() => { if (viewingPack.price && viewingPack.price > 0) { handleBoostPayment(viewingPack.id); } else { importPack(viewingPack); } }} className={`w-full py-4 rounded-xl font-bold text-lg transition-colors mb-3 ${viewingPack.price && viewingPack.price > 0 ? "bg-green-500 hover:bg-green-400 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]" : "bg-white/10 hover:bg-white/20 text-white"}`}>{viewingPack.price && viewingPack.price > 0 ? `Купить за ${viewingPack.price} ₽` : "Скачать себе"}</button><button onClick={() => { downloadModpack(viewingPack); }} disabled={Boolean(isDownloading) || Boolean(viewingPack.price && viewingPack.price > 0 && !isOwnPack)} className={`w-full py-3 rounded-xl font-bold transition-colors ${(viewingPack.price && viewingPack.price > 0) ? "bg-white/5 text-zinc-600 cursor-not-allowed" : "bg-white/10 hover:bg-white/20 text-white"}`}>{isDownloading ? "..." : (viewingPack.price && viewingPack.price > 0 && !isOwnPack) ? "Сначала купите сборку" : "Скачать .zip"}</button><div className="mt-8 pt-6 border-t border-white/10 space-y-3 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Загрузчик:</span><span className="font-bold text-white">{viewingPack.loader.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-zinc-500">Версия игры:</span><span className="font-bold text-white">{viewingPack.game_version}</span></div><div className="flex justify-between"><span className="text-zinc-500">Модов:</span><span className="font-bold text-white">{Object.keys(viewingPack.artifacts).length}</span></div></div></div></div></div></div>)}

      {selectedMod && (<div className="fixed inset-0 bg-[#09090b] z-[80] overflow-y-auto w-full h-full flex flex-col animate-in fade-in duration-200" onClick={() => setSelectedMod(null)}><div className="bg-transparent min-h-screen flex flex-col relative" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-8 border-b border-white/10 flex items-center justify-between bg-black/40 sticky top-0 z-10 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-2xl shrink-0 border border-white/10">
                    <Image src={selectedMod.icon_url || '/placeholder.png'} alt={selectedMod.title} fill className="object-cover" unoptimized />
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-black text-white">{selectedMod.title}</h2>
                    <p className="text-zinc-400 text-sm md:text-base mt-1 line-clamp-2">{selectedMod.description}</p>
                </div>
            </div>
            <button onClick={() => setSelectedMod(null)} className="text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0">✕</button>
        </div>

        <div className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
            <div className="flex border-b border-white/10 mb-8 gap-4 shrink-0">
                <button onClick={() => setActiveTab("description")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "description" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Описание</button>
                <button onClick={() => setActiveTab("gallery")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "gallery" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Галерея</button>
                <button onClick={() => setActiveTab("files")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "files" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Файлы</button>
            </div>

            {activeTab === "description" && (
                <div className="w-full">
                    {selectedMod.body ? (
                        <div className="prose prose-invert prose-base md:prose-lg max-w-none text-zinc-300 bg-[#121214] p-6 md:p-10 rounded-3xl border border-white/5 whitespace-pre-wrap">
                            {!translatedDesc ? <span className="text-green-500 animate-pulse text-xl">Перевод описания...</span> : <div dangerouslySetInnerHTML={{ __html: translatedDesc }} />}
                        </div>
                    ) : (
                        <div className="text-center text-zinc-500 py-20 text-xl">Описание отсутствует</div>
                    )}
                </div>
            )}

            {activeTab === "gallery" && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedMod.gallery && selectedMod.gallery.length > 0 ? (
                        selectedMod.gallery.map((img, i) => (
                            <div key={i} className="w-full aspect-video rounded-3xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-all cursor-pointer shadow-xl" onClick={() => setLightboxUrl(getOriginalUrl(img.url))}>
                                <img src={getOriginalUrl(img.url)} alt={img.title || "Gallery image"} className="w-full h-full object-cover" loading="lazy" />
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-zinc-500 py-20 col-span-full text-xl">Галерея пуста</div>
                    )}
                </div>
            )}

            {activeTab === "files" && (
                <div className="w-full max-w-3xl mx-auto space-y-6">
                    <h3 className="text-2xl font-bold text-white mb-6">Доступные версии</h3>
                    {isModalLoading ? (
                        <div className="text-center text-green-500 py-10 text-xl">Загрузка...</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {modVersions.map(v => (
                                <div key={v.id} className="bg-[#121214] p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                                    <div className="min-w-0 flex-1 w-full">
                                        <div className="font-bold text-lg text-white truncate">{v.name}</div>
                                        <div className="text-sm text-zinc-400 mt-2 truncate" title={v.game_versions.join(", ")}>Загрузчик: {v.loaders.join(", ")} • Игра: {v.game_versions.slice(0, 5).join(", ")} {v.game_versions.length > 5 ? `и еще ${v.game_versions.length - 5}...` : ''}</div>
                                    </div>
                                    <button onClick={() => handleAddMod(selectedMod, v)} disabled={isAdding === selectedMod.project_id || !!activePack?.artifacts[selectedMod.project_id]} className="bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-xl text-sm font-bold transition-all w-full md:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                        {isAdding === selectedMod.project_id ? "..." : activePack?.artifacts[selectedMod.project_id] ? "Добавлено" : "Добавить в сборку"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div></div>)}

      {viewingUser && (<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[80] flex items-center justify-center p-2 md:p-4" onClick={() => setViewingUser(null)}><div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl p-6 md:p-10 relative" onClick={e => e.stopPropagation()}><button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button><div className="flex flex-col md:flex-row items-center gap-6 mb-8 mt-4"><AvatarWithFrame url={viewingUser.avatar_url} frame={viewingUser.frame} size="w-32 h-32" /><div className="text-center md:text-left"><h2 className="text-3xl font-black text-white mb-2">{viewingUser.username}</h2><div className="flex items-center justify-center md:justify-start gap-3 mb-3"><TitleBadge titleName={viewingUser.title || "Новичок"} size="lg" /><span className="text-xs text-zinc-400 uppercase tracking-widest">{viewingUser.role === 'admin' ? 'Админ' : viewingUser.role === 'moderator' ? 'Модер' : 'Игрок'}</span></div><p className="text-zinc-300 text-sm max-w-lg whitespace-pre-wrap">{viewingUser.bio || "Этот пользователь еще не рассказал о себе."}</p></div></div><div className="border-t border-white/10 pt-6"><h3 className="text-xl font-bold text-white mb-4">Сборки пользователя ({viewingUserPacks.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{viewingUserPacks.length === 0 && <div className="text-zinc-500 col-span-full">У пользователя пока нет опубликованных сборок.</div>}{viewingUserPacks.map(pack => (<div key={pack.id} onClick={() => { setViewingUser(null); setViewingPack(pack); }} className="bg-[#121214] border border-white/10 p-4 rounded-2xl hover:border-green-500/50 cursor-pointer transition-all flex items-center gap-4"><div className="w-16 h-16 rounded-xl bg-zinc-800 relative overflow-hidden shrink-0 border border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-20">🖼️</div>}</div><div className="min-w-0 flex-1"><div className="font-bold text-white truncate">{pack.name}</div><div className="text-xs text-zinc-400 mt-1">{pack.game_version} • {pack.loader.toUpperCase()}</div><div className="text-xs text-green-400 mt-1">⬇ {pack.downloads || 0}</div></div></div>))}</div></div></div></div>)}

      {isPublishModalOpen && (<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setIsPublishModalOpen(false)}><div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8" onClick={e => e.stopPropagation()}><h2 className="text-2xl font-black text-white mb-6">Публикация сборки</h2><div className="space-y-6"><div><label className="text-sm text-zinc-400 mb-2 block font-bold">Обложка</label><div className="flex items-center gap-4"><div className="w-32 h-20 rounded-xl bg-zinc-800 relative overflow-hidden border border-white/10 shrink-0">{activePack?.cover_url ? <Image src={activePack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🖼️</div>}</div><div className="flex-1"><input type="file" id="publish-cover-upload" accept="image/*" onChange={(e) => uploadCover(e, activePackId)} className="hidden" /><label htmlFor="publish-cover-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">Загрузить обложку</label></div></div></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">Ссылка на YouTube-видео</label><input type="text" placeholder="https://youtube.com/watch?v=..." value={activePack?.video_url || ""} onChange={(e) => updateActivePack({ video_url: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm" /></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">Описание</label><textarea placeholder="Расскажите о своей сборке..." value={activePack?.description || ""} onChange={(e) => updateActivePack({ description: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-32 resize-none" /></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">Скриншоты</label><div className="flex flex-wrap gap-2 mb-3">{activePack?.screenshots?.map((url, i) => (<div key={i} className="w-20 h-20 rounded-lg bg-black/50 relative overflow-hidden border border-white/10 group"><Image src={url} alt="screenshot" fill className="object-contain" unoptimized /><button onClick={() => { const newScreens = activePack.screenshots?.filter((_, idx) => idx !== i); updateActivePack({ screenshots: newScreens }); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>))}</div><input type="file" id="publish-screenshot-upload" accept="image/*" onChange={(e) => uploadScreenshot(e, activePackId)} className="hidden" /><label htmlFor="publish-screenshot-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">+ Добавить скриншот</label></div><div>
  <label className="text-sm text-zinc-400 mb-2 block font-bold">Цена сборки (в рублях)</label>
  <input type="number" min="0" placeholder="0 (бесплатно) или от 40 ₽" value={activePack?.price === 0 ? "" : activePack?.price || ""} onChange={(e) => updateActivePack({ price: parseInt(e.target.value) || 0 })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm" />
  <p className="text-xs text-zinc-500 mt-1">Если 0 — скачивание бесплатное. Если больше 0 — 80% уйдет вам, 20% комиссия платформы.</p>
</div>
<div className="flex gap-3 pt-4"><button onClick={() => setIsPublishModalOpen(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">Отмена</button><button onClick={publishPack} className="flex-1 bg-green-500 hover:bg-green-400 text-black py-3 rounded-xl font-bold transition-colors">Опубликовать</button></div></div></div></div>)}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4 md:p-10 cursor-zoom-out backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors z-[1000]">✕</button>
          <img src={lightboxUrl} alt="Fullscreen" className="w-full h-full object-contain drop-shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
