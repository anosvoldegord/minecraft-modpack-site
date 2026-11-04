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
type PublishedPack = { id: string; user_id: string; name: string; game_version: string; loader: string; artifacts: Record<string, Artifact>; downloads: number; likes: number; rating?: number; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; profiles: { username: string; avatar_url: string; title: string; frame?: string } };
type UserProfile = { id: string; username: string; avatar_url: string; title: string; frame?: string; role?: string; owned_titles?: string[]; bio?: string; };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; };

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

const TITLES = [
  { id: "novice", name: "Новичок", type: "standard", color: "text-zinc-300", bg: "bg-gradient-to-b from-zinc-600 to-zinc-800 border border-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "player", name: "Игрок", type: "standard", color: "text-blue-300", bg: "bg-gradient-to-b from-blue-500 to-blue-800 border border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "master", name: "Мастер", type: "standard", color: "text-purple-300", bg: "bg-gradient-to-b from-purple-500 to-purple-900 border border-purple-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_10px_rgba(168,85,247,0.4)]" },
  
  { id: "vip", name: "VIP", type: "donate", color: "text-yellow-300", bg: "bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_0_15px_rgba(250,204,21,0.5)]" },
  { id: "premium", name: "Premium", type: "donate", color: "text-pink-300", bg: "bg-gradient-to-b from-cyan-300 via-blue-500 to-blue-800 border border-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_0_15px_rgba(59,130,246,0.5)]" },
  { id: "sponsor", name: "Спонсор", type: "donate", color: "text-orange-300", bg: "bg-gradient-to-b from-orange-400 via-orange-600 to-red-800 border border-orange-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_15px_rgba(249,115,22,0.5)]" },
  
  { id: "builder", name: "Строитель", type: "earned", color: "text-green-300", bg: "bg-gradient-to-b from-emerald-400 via-green-600 to-green-900 border border-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "explorer", name: "Исследователь", type: "earned", color: "text-cyan-300", bg: "bg-gradient-to-b from-teal-400 via-cyan-600 to-cyan-900 border border-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "modder", name: "Мододел", type: "earned", color: "text-sky-300", bg: "bg-gradient-to-b from-sky-400 via-indigo-600 to-indigo-900 border border-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.5)]" },
  
  { id: "event_hero", name: "Ивент-Герой", type: "exclusive", color: "text-fuchsia-300", bg: "bg-gradient-to-b from-fuchsia-400 via-pink-600 to-purple-900 border border-fuchsia-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_20px_rgba(217,70,239,0.6)]" },
  { id: "founder", name: "Основатель", type: "exclusive", color: "text-red-300", bg: "bg-gradient-to-b from-red-500 via-red-700 to-black border border-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_20px_rgba(239,68,68,0.6)]" },
  { id: "admin", name: "Администратор", type: "exclusive", color: "text-red-400 font-black", bg: "bg-gradient-to-b from-red-600 via-red-900 to-black border border-red-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_0_30px_rgba(220,38,38,0.8)]" },
];

const ITEMS_PER_PAGE = 40;
const CATALOG_PER_PAGE = 9;

const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🤩", "😎", "😭", "😡", "👍", "👎", "🔥", "💯", "❤️", "💔", "🎉", "💩", "👻", "💀", "🤖", "👾", "🎮", "🕹️", "💻"];

const GIFFS = [
  "https://media.tenor.com/2e0gS8t6c3AAAAAC/pepe-pepe-the-frog.gif",
  "https://media.tenor.com/8vJj2k4k5jAAAAAC/cat-cat-meme.gif",
  "https://media.tenor.com/5Fk4J3k2k1AAAAAC/dog-dog-meme.gif",
  "https://media.tenor.com/9k8J7k6k5jAAAAAC/minecraft-minecraft-meme.gif",
  "https://media.tenor.com/3k2J1k0k9jAAAAAC/dance-dancing.gif",
  "https://media.tenor.com/6k5J4k3k2jAAAAAC/laugh-laughing.gif"
];

const TitleBadge = ({ titleName, size = "sm" }: { titleName: string, size?: "sm" | "lg" }) => {
  const t = TITLES.find(x => x.name === titleName) || TITLES[0];
  
  if (size === "lg") {
    return (
      <div className={`inline-flex items-center justify-center px-6 py-2 rounded-lg font-black uppercase tracking-widest ${t.bg}`}>
        <span className="drop-shadow-md text-sm">{t.name}</span>
      </div>
    );
  }
  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded font-bold uppercase tracking-wider ${t.bg}`}>
      <span className="drop-shadow-sm text-[10px]">{t.name}</span>
    </div>
  );
};

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
  const [view, setView] = useState<"mods" | "catalog" | "profile" | "friends" | "admin">("mods");
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

  // Состояния для друзей и чата
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
  
  // Состояния для прикрепления файла
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<"emojis" | "gifs">("emojis");

  // Состояния для редактирования сообщений
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");

  // Поиск по сборке и уведомления
  const [packSearch, setPackSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Админ-панель
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");

  // Профиль (Инвентарь)
  const [profileTab, setProfileTab] = useState<"frames" | "titles" | "items">("frames");

  // Чужие профили, комментарии и рейтинги
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [viewingUserPacks, setViewingUserPacks] = useState<PublishedPack[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isImageUrl = (text: string) => {
    return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(text) || text.includes('tenor.com/view') || text.includes('media.tenor.com') || text.includes('media.giphy.com') || text.includes('i.giphy.com');
  };

  // --- УВЕДОМЛЕНИЯ ---
  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      const { data } = await supabase.from('messages')
        .select('sender_id, created_at')
        .eq('receiver_id', user.id);
      if (data) {
        let count = 0;
        const readState = JSON.parse(localStorage.getItem('read_state') || '{}');
        data.forEach(msg => {
          const lastRead = readState[msg.sender_id];
          if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
            count++;
          }
        });
        setUnreadCount(count);
      }
    };
    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleOpenChat = (friend: UserProfile) => {
    setActiveChat(friend);
    const readState = JSON.parse(localStorage.getItem('read_state') || '{}');
    readState[friend.id] = new Date().toISOString();
    localStorage.setItem('read_state', JSON.stringify(readState));
    setUnreadCount(0); // Сбрасываем визуально
  };

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

  const activePack = modpacks.find(p => p.id === activePackId) || modpacks[0];

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);

  // Загрузка друзей, заявок и рекомендаций
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchSuggestedUsers();
      const interval = setInterval(fetchFriends, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Админ функция загрузки пользователей
  useEffect(() => {
    if (user && user.id === ADMIN_ID && view === "admin") {
      supabase.from('profiles').select('*').then(({ data }) => {
        if (data) setAdminUsers(data);
      });
    }
  }, [user, view]);

  // Realtime для индикатора "Печатает..." и загрузка сообщений
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);
      
      const interval = setInterval(() => fetchMessages(activeChat.id), 3000);

      const roomName = `typing-${[user.id, activeChat.id].sort().join('-')}`;
      const channel = supabase.channel(roomName);
      
      channel.on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id !== user.id) {
          setIsFriendTyping(true);
          setTimeout(() => setIsFriendTyping(false), 2000);
        }
      }).subscribe();

      channelRef.current = channel;

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [activeChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isFriendTyping]);

  const fetchFriends = async () => {
    if (!user) return;
    try {
      const { data: sent, error: err1 } = await supabase.from('friendships').select('*').eq('sender_id', user.id);
      const { data: received, error: err2 } = await supabase.from('friendships').select('*').eq('receiver_id', user.id);
      
      if (err1 || err2) { console.error("Friendship fetch error:", err1, err2); return; }

      const relations = [...(sent || []), ...(received || [])];
      const accepted = relations.filter(r => r.status === 'accepted');
      const pending = relations.filter(r => r.status === 'pending' && r.receiver_id === user.id);

      const friendIds = accepted.map(r => r.sender_id === user.id ? r.receiver_id : r.sender_id);
      
      if (friendIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase.from('profiles').select('*').in('id', friendIds);
        if (profErr) { console.error("Profiles fetch error:", profErr); }
        
        const mappedFriends = friendIds.map(id => {
          const p = profiles?.find(pr => pr.id === id);
          return p || { id: id, username: 'Неизвестный игрок', avatar_url: null, title: 'Новичок', frame: 'default' };
        });
        setFriends(mappedFriends);
      } else {
        setFriends([]);
      }

      const requestSenderIds = pending.map(r => r.sender_id);
      if (requestSenderIds.length > 0) {
        const { data: profs, error: profsErr } = await supabase.from('profiles').select('*').in('id', requestSenderIds);
        if (!profsErr) {
          const mappedRequests = pending.map(req => {
            const p = profs?.find(pr => pr.id === req.sender_id);
            return { ...req, profile: p || { id: req.sender_id, username: 'Неизвестный', avatar_url: null, title: 'Новичок', frame: 'default' } };
          });
          setRequests(mappedRequests);
        }
      } else {
        setRequests([]);
      }
    } catch(e) { console.error("Exception in fetchFriends:", e); }
  };

  const fetchSuggestedUsers = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id).limit(20);
    if (data) setSuggestedUsers(data);
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('*').ilike('username', `%${q}%`).neq('id', user?.id).limit(10);
    setSearchResults(data || []);
  };

  const sendFriendRequest = async (receiverId: string) => {
    await supabase.from('friendships').insert({ sender_id: user.id, receiver_id: receiverId, status: 'pending' });
    showToast("Заявка отправлена!", "success");
    setSearchQuery(""); setSearchResults([]);
  };

  const acceptRequest = async (id: string) => {
    const { data: updated, error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id).select();
    if (error) { showToast("Ошибка БД: " + error.message, "error"); return; }
    if (!updated || updated.length === 0) { showToast("Не удалось принять заявку (проверьте RLS).", "error"); return; }
    showToast("Теперь вы друзья!", "success");
    await fetchFriends();
  };

  const removeFriend = async (friendId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Вы уверены, что хотите удалить этого пользователя из друзей?")) return;
    try {
      await supabase.from('friendships').delete().eq('sender_id', user.id).eq('receiver_id', friendId);
      await supabase.from('friendships').delete().eq('sender_id', friendId).eq('receiver_id', user.id);
      if (activeChat?.id === friendId) setActiveChat(null);
      fetchFriends();
      showToast("Пользователь удален из друзей", "success");
    } catch (err: any) { showToast("Ошибка удаления: " + err.message, "error"); }
  };

  const clearChat = async () => {
    if (!activeChat || !user) return;
    if (!confirm("Очистить всю историю переписки с этим пользователем?")) return;
    try {
      await supabase.from('messages').delete().eq('sender_id', user.id).eq('receiver_id', activeChat.id);
      await supabase.from('messages').delete().eq('sender_id', activeChat.id).eq('receiver_id', user.id);
      setMessages([]);
      showToast("Чат успешно очищен", "success");
    } catch (err: any) { showToast("Ошибка очистки: " + err.message, "error"); }
  };

  const fetchMessages = async (friendId: string) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
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
        showToast("Ошибка загрузки файла", "error");
        setIsSendingFile(false);
        return;
      }
    }

    const content = gifUrl || fileUrl || newMessage.trim();
    
    setNewMessage("");
    setAttachedFile(null);
    setPreviewUrl(null);
    setShowEmojiPicker(false);

    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: activeChat.id, content: content });
    fetchMessages(activeChat.id);
    setIsSendingFile(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setAttachedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleTyping = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id },
      });
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Удалить это сообщение?")) return;
    try {
      await supabase.from('messages').delete().eq('id', id);
      setMessages(prev => prev.filter(m => m.id !== id));
      showToast("Сообщение удалено", "success");
    } catch (e: any) { showToast("Ошибка удаления", "error"); }
  };

  const startEditMessage = (id: string, content: string) => {
    setEditingMessageId(id);
    setEditMessageContent(content);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditMessageContent("");
  };

  const saveEditMessage = async (id: string) => {
    if (!editMessageContent.trim()) return;
    try {
      await supabase.from('messages').update({ content: editMessageContent.trim() }).eq('id', id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editMessageContent.trim() } : m));
      setEditingMessageId(null);
      setEditMessageContent("");
      showToast("Сообщение обновлено", "success");
    } catch (e: any) { showToast("Ошибка обновления", "error"); }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) { setDbError(error.message); return; }
    if (data) { setProfile(data); } 
    else {
      const newProfile = { id: userId, username: "Игрок", title: "Новичок", avatar_url: null, frame: "default", role: "user", owned_titles: ["novice"], bio: "" };
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
        fetchUserRatings(session.user.id);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { 
      setUser(session?.user ?? null); 
      if (event === 'SIGNED_IN') { setIsLoggingIn(false); fetchProfile(session!.user.id); fetchUserLikes(session!.user.id); fetchUserRatings(session!.user.id); }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchUserLikes = async (userId: string) => {
    const { data } = await supabase.from('pack_likes').select('pack_id').eq('user_id', userId);
    if (data) setLikedPacks(data.map(d => d.pack_id));
  };

  const fetchUserRatings = async (userId: string) => {
    const { data } = await supabase.from('pack_ratings').select('pack_id, rating').eq('user_id', userId);
    if (data) {
      const ratingsMap: Record<string, number> = {};
      data.forEach(r => { ratingsMap[r.pack_id] = r.rating; });
      setUserRatings(ratingsMap);
    }
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
      title: updates.title || profile?.title || "Новичок", 
      avatar_url: profile?.avatar_url || null,
      frame: updates.frame !== undefined ? updates.frame : profile?.frame || "default",
      bio: updates.bio !== undefined ? updates.bio : profile?.bio || ""
    });
    if (error) showToast("Ошибка сохранения: " + error.message, "error");
    else {
      setProfile((prev: any) => ({ ...prev, ...updates }));
      fetchProfile(user.id);
      showToast("Профиль сохранен!", "success");
    }
  };

  // ==== АДМИН ФУНКЦИИ ====
  const toggleTitle = async (targetUserId: string, titleId: string) => {
    const targetUser = adminUsers.find(u => u.id === targetUserId);
    if (!targetUser) return;
    
    const currentOwned = targetUser.owned_titles || ['novice'];
    const hasTitle = currentOwned.includes(titleId);
    
    let newOwned;
    if (hasTitle) {
      newOwned = currentOwned.filter((id: string) => id !== titleId);
    } else {
      newOwned = [...currentOwned, titleId];
    }
    
    const { error } = await supabase.from('profiles').update({ owned_titles: newOwned }).eq('id', targetUserId);
    
    if (error) {
      showToast("Ошибка: " + error.message, "error");
    } else {
      showToast(hasTitle ? "Титул забран!" : "Титул выдан!", "success");
      setAdminUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, owned_titles: newOwned } : u));
    }
  };

  const updateRole = async (targetUserId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId);
    if (error) {
      showToast("Ошибка выдачи роли: " + error.message, "error");
    } else {
      showToast("Роль обновлена!", "success");
      setAdminUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
    }
  };

  // ==== РЕЙТИНГ, ЛАЙКИ, ПРОФИЛИ И КОММЕНТАРИИ ====
  const toggleLike = async (packId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return showToast("Войдите, чтобы ставить лайки", "error");
    
    const isLiked = likedPacks.includes(packId);
    try {
      if (isLiked) {
        await supabase.from('pack_likes').delete().eq('pack_id', packId).eq('user_id', user.id);
        const newLikes = Math.max(0, (viewingPack?.likes || 1) - 1);
        await supabase.from('published_packs').update({ likes: newLikes }).eq('id', packId);
        setLikedPacks(prev => prev.filter(id => id !== packId));
        if (viewingPack) setViewingPack({ ...viewingPack, likes: newLikes });
      } else {
        await supabase.from('pack_likes').insert({ pack_id: packId, user_id: user.id });
        const newLikes = (viewingPack?.likes || 0) + 1;
        await supabase.from('published_packs').update({ likes: newLikes }).eq('id', packId);
        setLikedPacks(prev => [...prev, packId]);
        if (viewingPack) setViewingPack({ ...viewingPack, likes: newLikes });
      }
      fetchCatalog();
    } catch (e: any) { showToast("Ошибка лайка: " + e.message, "error"); }
  };

  const setRating = async (packId: string, score: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return showToast("Войдите, чтобы оценить сборку", "error");

    try {
      const { error } = await supabase.from('pack_ratings').upsert({
        pack_id: packId,
        user_id: user.id,
        rating: score
      }, { onConflict: 'pack_id,user_id' });

      if (error) throw error;

      const { data: updatedPack } = await supabase.from('published_packs').select('rating').eq('id', packId).single();
      
      if (updatedPack) {
        if (viewingPack) setViewingPack({ ...viewingPack, rating: updatedPack.rating });
      }

      setUserRatings(prev => ({ ...prev, [packId]: score }));
      fetchCatalog();
      showToast("Оценка сохранена!", "success");
    } catch (err: any) {
      showToast("Ошибка: " + err.message, "error");
    }
  };

  const openUserProfile = async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (prof) setViewingUser(prof);
    
    const { data: packs } = await supabase.from('published_packs').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (packs) setViewingUserPacks(packs as any);
  };

  const fetchComments = async (packId: string) => {
    const { data } = await supabase.from('comments')
      .select('*, profiles(username, avatar_url, title, frame)')
      .eq('pack_id', packId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const postComment = async () => {
    if (!newComment.trim() || !user || !viewingPack) return;
    const { error } = await supabase.from('comments').insert({
      pack_id: viewingPack.id,
      user_id: user.id,
      content: newComment.trim()
    });
    if (error) showToast("Ошибка: " + error.message, "error");
    else {
      setNewComment("");
      fetchComments(viewingPack.id);
      showToast("Комментарий добавлен", "success");
    }
  };

  useEffect(() => {
    if (viewingPack) {
      fetchComments(viewingPack.id);
    }
  }, [viewingPack]);

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
    if (!user) return;
    try {
      const { data } = await supabase.from('modpacks').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (data && data.length > 0) { 
        setModpacks(data.map(d => ({ 
          id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {}, 
          cover_url: d.cover_url || undefined, description: d.description || undefined, screenshots: d.screenshots || [], video_url: d.video_url || undefined,
          published_id: d.published_id || undefined
        }))); 
        setActivePackId(data[0].id); 
      }
      else { createNewPack(true, user); }
    } catch(e) {}
    setIsLoaded(true);
  };

  const saveToDB = async (newPacks: Modpack[], currentId: string): Promise<any> => {
    if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return true; }
    const pack = newPacks.find(p => p.id === currentId); if (!pack) return false;
    try { 
      const cleanArtifacts = JSON.parse(JSON.stringify(pack.artifacts || {}));
      const { error } = await supabase.from('modpacks').upsert({ 
        id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: cleanArtifacts,
        description: pack.description || null, screenshots: pack.screenshots || [], cover_url: pack.cover_url || null, video_url: pack.video_url || null,
        published_id: pack.published_id || null
      }); 
      if (error) { 
        console.error("Save error:", error); 
        showToast("Ошибка БД: " + error.message, "error"); 
        return false; 
      }
      return true;
    } catch(e: any) { 
      console.error(e); 
      showToast("Ошибка БД: " + e.message, "error"); 
      return false; 
    }
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
    if (!activePack.description || activePack.description.trim() === "") showToast("Совет: добавьте описание, чтобы сборка выглядела лучше!", "info");
    
    try {
      if (activePack.published_id) {
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

        const packToUpdate = modpacks.find(p => p.published_id === id);
        if (packToUpdate) {
          const newPacks = modpacks.map(p => p.id === packToUpdate.id ? { ...p, published_id: undefined } : p);
          setModpacks(newPacks);
          await saveToDB(newPacks, packToUpdate.id);
        }

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
      setModpacks(newPacks);
      const success = await saveToDB(newPacks, activePackId);
      if (success) {
        setSelectedMod(null);
        showToast("Мод добавлен в сборку", "success");
      }
    } catch(e) {} finally { setIsAdding(null); }
  };

  const removeArtifact = (id: string) => { const newPacks = modpacks.map(p => { if (p.id !== activePackId) return p; const copy = { ...p.artifacts }; delete copy[id]; return { ...p, artifacts: copy }; }); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  
  // ==== СКАЧИВАНИЕ ZIP ====
  const downloadModpack = async (pack: Modpack) => { const list = Object.values(pack.artifacts); if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.zip`; a.click(); } catch(e) {} finally { setIsDownloading(false); } };
  
  // ==== ЭКСПОРТ MRPACK ====
  const exportMrpack = async (pack: Modpack) => {
    if (!pack || Object.keys(pack.artifacts).length === 0) return;
    setIsDownloading(true);
    const zip = new JSZip();

    const files = Object.values(pack.artifacts).map(mod => ({
        path: `mods/${mod.file_name}`,
        hashes: {},
        env: { client: "required", server: "required" },
        downloads: [mod.file_url]
    }));

    const mrpackIndex = {
        formatVersion: 1,
        game: "minecraft",
        versionId: "1.0.0",
        name: pack.name || "Modpack",
        files: files,
        dependencies: {
            minecraft: pack.gameVersion,
            [pack.loader]: "latest"
        }
    };

    zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 2));

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = `${pack.name}.mrpack`;
        a.click();
    } catch(e) { console.error(e); }
    finally { setIsDownloading(false); }
  };

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
  
  if (!isLoaded) return <div className="h-dvh bg-[#09090b] text-white flex items-center justify-center">Загрузка...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter(a => !a.isLibrary);
  const filteredPackMods = modsList.filter(m => m.title.toLowerCase().includes(packSearch.toLowerCase()));
  const libsList = artifactList.filter(a => a.isLibrary);
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);

  let filteredCatalog = catalog.filter(pack => {
    const matchVersion = catalogVersion === "all" || pack.game_version === catalogVersion;
    const matchLoader = catalogLoader === "all" || pack.loader === catalogLoader;
    const matchSearch = pack.name.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchVersion && matchLoader && matchSearch;
  });

  if (catalogSort === "downloads") {
    filteredCatalog.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  }

  const totalCatalogPages = Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE);
  const paginatedCatalog = filteredCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE);

  const topPacks = [...catalog].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 3);

  const getYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="flex h-dvh text-white font-sans overflow-hidden relative selection:bg-green-500/30">
      
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

      {/* МОБИЛЬНЫЙ ОВЕРЛЕЙ ДЛЯ САЙДБАРА */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`bg-black/90 md:bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 transition-transform duration-300 z-40 fixed inset-y-0 left-0 md:relative md:translate-x-0 w-72 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"}`}>
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-md">ModBuilder</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-white p-2">✕</button>
        </div>
        
        <div className="px-4 space-y-1 mb-4">
          <button onClick={() => { setView("mods"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "mods" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Сборщик</button>
          <button onClick={() => { setView("catalog"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "catalog" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Каталог сборок</button>
          <button onClick={() => { setView("friends"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-colors ${view === "friends" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>
            Сообщество
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => { setView("profile"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "profile" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>Мой профиль</button>
          
          {user?.id === ADMIN_ID && (
            <button onClick={() => { setView("admin"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "admin" ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-500/10"}`}>👑 Админ-панель</button>
          )}
        </div>

        {view === "mods" && (
          <>
            <div className="px-6 pb-2 flex justify-between items-center text-sm font-bold text-zinc-400">
              <span>Мои сборки</span>
              <button onClick={() => createNewPack()} className="text-white hover:text-green-400 text-lg" title="Создать">+</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-2">
              {modpacks.map(pack => (
                <div key={pack.id} onClick={() => { setActivePackId(pack.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`relative group p-4 rounded-2xl cursor-pointer border border-transparent transition-all ${activePackId === pack.id ? "bg-white/20 border-white/20 shadow-lg" : "hover:bg-white/10"}`}>
                  {editingPackId === pack.id ? (
                    <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={saveRename} onKeyDown={(e) => e.key === "Enter" && saveRename()} className="bg-black/50 border border-green-500/50 rounded-lg px-2 py-1 text-sm w-full outline-none text-white" />
                  ) : (
                    <div className="font-bold text-sm truncate pr-14 text-white">{pack.name}</div>
                  )}
                  <div className="text-xs text-zinc-300 mt-1">{pack.gameVersion} • {pack.loader.toUpperCase()}</div>
                  <div className="absolute top-4 right-3 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
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

      <main className="flex-1 flex flex-col min-w-0 relative z-10 w-full">
        {view === "mods" && (
          <>
            <header className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4 bg-black/30 backdrop-blur-xl z-20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/10 hover:bg-white/20 border border-white/20 p-3 rounded-xl shrink-0 transition-colors text-white">Меню</button>
                  <input type="text" placeholder="Поиск модов..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 md:flex-none md:w-96 bg-black/30 border border-white/20 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-green-500/50 focus:bg-black/50 transition-all text-white placeholder-zinc-400" />
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto">
                  <CustomSelect value={activePack?.gameVersion || "1.16.5"} onChange={(val) => updateActivePack({ gameVersion: val, artifacts: {} })} options={[{ value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} />
                  <CustomSelect value={activePack?.loader || "forge"} onChange={(val) => updateActivePack({ loader: val, artifacts: {} })} options={[{ value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} />
                  <button onClick={() => setIsPackOpen(true)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] flex-1 md:flex-none">Сборка ({modsList.length})</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${selectedCategories.includes(cat.id) ? "bg-green-500/30 border-green-500/60 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{cat.label}</button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {isLoading ? <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
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
                      type="text" 
                      inputMode="numeric"
                      value={pageInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setPageInput(val);
                      }}
                      onBlur={() => {
                        const val = parseInt(pageInput, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        } else {
                          setPageInput(currentPage.toString());
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-16 bg-black/50 border border-white/20 rounded-xl px-2 py-2 text-center text-white font-bold focus:outline-none focus:border-green-500"
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
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">Каталог сборок</h2>
            
            <div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md relative z-20">
              <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold ml-1">Поиск</span>
                <input type="text" placeholder="Название сборки..." value={catalogSearch} onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 text-white placeholder-zinc-400" />
              </div>
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

            {topPacks.length > 0 && !catalogSearch && catalogVersion === "all" && catalogLoader === "all" && (
              <div className="mb-10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="text-yellow-400">🏆</span> Топ-3 сборки</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topPacks.map((pack, idx) => (
                    <div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/90 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-yellow-500/50 transition-all hover:-translate-y-1">
                      <div className="w-full h-32 bg-zinc-800 relative border-b border-white/10">
                        {pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">🖼️</div>}
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl text-xl font-black shadow-lg border border-white/20">
                          {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : "🥉 3"}
                        </div>
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h4 className="text-lg font-bold truncate">{pack.name}</h4>
                        <div className="text-sm text-zinc-400 mt-1">{pack.game_version} • {pack.loader.toUpperCase()}</div>
                        <div className="flex justify-between items-center mt-auto pt-3">
                          <span className="text-xs text-zinc-400">{pack.profiles?.username}</span>
                          <span className="text-green-400 font-bold text-sm">⬇ {pack.downloads || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedCatalog.map(pack => (
                <div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/80 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-green-500/50 transition-all hover:-translate-y-1">
                  
                  <div className="w-full h-48 bg-zinc-800 relative border-b border-white/10">
                    {pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">🖼️</div>}
                    
                    {user && user.id === pack.user_id && (
                      <button 
                        onClick={(e) => deleteFromCatalog(pack.id, e)} 
                        className="absolute top-4 right-4 text-zinc-300 hover:text-red-500 bg-black/60 hover:bg-black/90 p-2.5 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100 z-10"
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
                        <div className="font-bold text-xs text-green-400 flex items-center gap-2 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserProfile(pack.user_id); }}>
                          {pack.profiles?.username || "Игрок"}
                          <TitleBadge titleName={pack.profiles?.title || "Новичок"} />
                        </div>
                        <div className="text-[10px] text-zinc-400">{pack.profiles?.title || "Новичок"}</div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold pr-6 leading-tight">{pack.name}</h3>
                    <div className="text-sm text-zinc-400">{pack.game_version} • {pack.loader.toUpperCase()}</div>
                    <div className="text-sm text-zinc-300 flex justify-between items-center mt-auto pt-2 border-t border-white/5">
                      <div className="flex gap-3 text-xs">
                        <span className="text-zinc-400">Модов: {Object.keys(pack.artifacts).length}</span>
                        <span className="text-pink-400 flex items-center gap-1">❤️ {pack.likes || 0}</span>
                        <span className="text-yellow-400 flex items-center gap-1">★ {Number(pack.rating || 0).toFixed(1)}</span>
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

        {view === "friends" && user && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-transparent">
            {/* Левая колонка: Поиск и списки */}
            <div className={`w-full md:w-80 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md shrink-0 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-white/10">
                <h2 className="text-xl font-bold mb-4">Сообщество</h2>
                <input 
                  type="text" 
                  placeholder="Поиск игроков..." 
                  value={searchQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-[#121214] border border-white/10 rounded-xl overflow-hidden">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(u.id)}>
                          <AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-6 h-6" />
                          <span className="text-sm truncate hover:underline">{u.username}</span>
                        </div>
                        <button onClick={() => sendFriendRequest(u.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">+</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {requests.length > 0 && (
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-bold text-zinc-400 mb-2">Заявки в друзья</h3>
                  {requests.map(req => (
                    <div key={req.id} className="flex items-center justify-between mb-2 bg-white/5 p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AvatarWithFrame url={req.profile?.avatar_url} frame={req.profile?.frame} size="w-8 h-8" />
                        <span className="text-sm truncate">{req.profile?.username}</span>
                      </div>
                      <button onClick={() => acceptRequest(req.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">Принять</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Рекомендации (скрываем тех, кто уже в друзьях) */}
              {!searchQuery && suggestedUsers.filter(u => !friends.some(f => f.id === u.id)).length > 0 && (
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-bold text-zinc-400 mb-2">Рекомендации</h3>
                  <div className="space-y-2">
                    {suggestedUsers
                      .filter(u => !friends.some(f => f.id === u.id))
                      .slice(0, 5)
                      .map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(u.id)}>
                          <AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-8 h-8" />
                          <span className="text-sm truncate hover:underline">{u.username}</span>
                        </div>
                        <button onClick={() => sendFriendRequest(u.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">+</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-zinc-400">Мои друзья</h3>
                  <button onClick={fetchFriends} className="text-xs text-green-500 hover:text-green-400">Обновить</button>
                </div>
                {friends.length === 0 && <div className="text-zinc-500 text-sm">Пока нет друзей</div>}
                {friends.map(f => (
                  <div key={f.id} onClick={() => handleOpenChat(f)} className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${activeChat?.id === f.id ? "bg-white/10" : "hover:bg-white/5"}`}>
                    <div className="flex items-center gap-3 truncate">
                      <AvatarWithFrame url={f.avatar_url} frame={f.frame} size="w-10 h-10" />
                      <div className="truncate font-bold text-sm">{f.username}</div>
                    </div>
                    <button onClick={(e) => removeFriend(f.id, e)} className="text-zinc-500 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить из друзей">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Правая колонка: Чат (прозрачный) */}
            <div className={`flex-1 flex flex-col bg-black/10 backdrop-blur-sm relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
              {activeChat ? (
                <>
                  <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-400 hover:text-white mr-2 text-xl">←</button>
                      <AvatarWithFrame url={activeChat.avatar_url} frame={activeChat.frame} size="w-10 h-10" />
                      <div>
                        <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                          {activeChat.username}
                          <TitleBadge titleName={activeChat.title || "Новичок"} />
                        </h3>
                        {isFriendTyping && <span className="text-xs text-green-400 animate-pulse">Печатает...</span>}
                      </div>
                    </div>
                    <button onClick={clearChat} className="text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Очистить
                    </button>
                  </div>
                  
                  <div 
                    className={`flex-1 overflow-y-auto p-6 space-y-4 relative transition-colors ${isDraggingOver ? "bg-green-500/10 border-2 border-dashed border-green-500" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={handleDrop}
                  >
                    {messages.length === 0 && <div className="text-center text-zinc-500 mt-10">Начните общение!</div>}
                    {messages.map(m => (
                      <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"} group`}>
                        {editingMessageId === m.id ? (
                          <div className="flex flex-col gap-2 max-w-[70%] w-full items-end">
                            <input
                              autoFocus
                              value={editMessageContent}
                              onChange={e => setEditMessageContent(e.target.value)}
                              className="w-full bg-black/50 border border-green-500 rounded-xl px-4 py-2 text-white outline-none"
                              onKeyDown={(e) => e.key === 'Enter' && saveEditMessage(m.id)}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => cancelEditMessage()} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">Отмена</button>
                              <button onClick={() => saveEditMessage(m.id)} className="text-xs bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg">Сохранить</button>
                            </div>
                          </div>
                        ) : (
                          <div className={`relative max-w-[85%] md:max-w-[70%] p-3 rounded-2xl ${m.sender_id === user.id ? "bg-green-500 text-black rounded-br-none" : "bg-white/10 text-white rounded-bl-none"}`}>
                            {isImageUrl(m.content) ? (
                              <div className="rounded-lg overflow-hidden max-w-sm cursor-pointer" onClick={() => window.open(m.content, '_blank')}>
                                <img src={m.content} alt="attachment" className="max-h-60 w-auto object-contain" />
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                            )}
                            <div className={`text-[10px] mt-1 text-right ${m.sender_id === user.id ? "text-green-800" : "text-zinc-400"}`}>
                              {formatTime(m.created_at)}
                            </div>
                            
                            {/* Кнопки редактирования и удаления (только для своих) */}
                            {m.sender_id === user.id && !isImageUrl(m.content) && (
                              <div className="absolute top-1/2 -translate-y-1/2 -left-16 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditMessage(m.id, m.content)} className="text-zinc-400 hover:text-white p-1" title="Редактировать">✎</button>
                                <button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1" title="Удалить">✕</button>
                              </div>
                            )}
                            {m.sender_id === user.id && isImageUrl(m.content) && (
                              <div className="absolute top-1/2 -translate-y-1/2 -left-10 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1 bg-black/50 rounded-full" title="Удалить">✕</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isFriendTyping && (
                      <div className="flex justify-start">
                        <div className="bg-white/10 text-white rounded-2xl rounded-bl-none p-3 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">
                    {previewUrl && (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-green-500 mb-2 group">
                        <img src={previewUrl} alt="preview" className="w-full h-full object-contain bg-black/50" />
                        <button onClick={() => { setAttachedFile(null); setPreviewUrl(null); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    )}
                    
                    <div className="flex gap-2 items-center relative">
                      {/* Панель эмодзи и гифок */}
                      {showEmojiPicker && (
                        <div className="absolute bottom-full mb-2 left-0 bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-72 animate-in slide-in-from-bottom-2">
                          <div className="flex gap-2 mb-3 border-b border-white/10 pb-2">
                            <button onClick={() => setEmojiTab("emojis")} className={`text-sm font-bold ${emojiTab === "emojis" ? "text-green-400" : "text-zinc-400"}`}>Эмодзи</button>
                            <button onClick={() => setEmojiTab("gifs")} className={`text-sm font-bold ${emojiTab === "gifs" ? "text-green-400" : "text-zinc-400"}`}>Гифки</button>
                          </div>
                          
                          {emojiTab === "emojis" ? (
                            <div className="grid grid-cols-6 gap-2">
                              {EMOJIS.map(e => (
                                <button key={e} onClick={() => setNewMessage(prev => prev + e)} className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {GIFFS.map((gif, i) => (
                                <div key={i} onClick={() => sendMessage(gif)} className="cursor-pointer hover:opacity-80 rounded-lg overflow-hidden border border-white/10 h-20">
                                  <img src={gif} alt="gif" className="w-full h-full object-cover" />
                                </div>
                              ))}
                              <button 
                                onClick={() => { setShowEmojiPicker(false); fileInputRef.current?.click(); }} 
                                className="h-20 border border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center text-xs text-zinc-400 hover:bg-white/5"
                              >
                                <span>+</span> Загрузить
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">
                        😊
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">
                        📎
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                      
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Написать..."
                        className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white"
                      />
                      <button onClick={() => sendMessage()} disabled={isSendingFile} className="bg-green-500 hover:bg-green-400 text-black px-4 md:px-6 py-3 rounded-xl font-bold disabled:opacity-50">
                        {isSendingFile ? "..." : "Отправить"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500">
                  Выберите друга, чтобы начать переписку
                </div>
              )}
            </div>
          </div>
        )}

        {view === "profile" && user && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
            <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl">
              
              {/* ЛЕВАЯ КОЛОНКА (ИНФОРМАЦИЯ) */}
              <div className="w-full lg:w-1/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center h-fit">
                
                <AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-40 h-40" />
                
                <div className="text-center mt-4 mb-8">
                  <h2 className="text-2xl font-black text-white">{profile?.username || "Игрок"}</h2>
                  <div className="mt-3 mb-2 flex justify-center">
                    <TitleBadge titleName={profile?.title || "Новичок"} size="lg" />
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 uppercase tracking-widest">{profile?.role === 'admin' ? 'Администратор' : profile?.role === 'moderator' ? 'Модератор' : 'Пользователь'}</div>
                </div>

                <div className="w-full space-y-4">
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
                    <label className="text-sm text-zinc-400 mb-1 block">Никнейм</label>
                    <input type="text" value={profile?.username || ""} onChange={(e) => setProfile({...profile, username: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" />
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">О себе</label>
                    <textarea value={profile?.bio || ""} onChange={(e) => setProfile({...profile, bio: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-24 resize-none" placeholder="Расскажите о себе..."></textarea>
                  </div>

                  <button onClick={() => saveProfile({ username: profile.username, bio: profile.bio })} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-colors mt-4">Сохранить изменения</button>
                </div>
              </div>

              {/* ПРАВАЯ КОЛОНКА (ИНВЕНТАРЬ) */}
              <div className="w-full lg:w-2/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col min-h-[500px]">
                <h3 className="text-2xl font-black text-white mb-6">Инвентарь</h3>
                
                {/* Вкладки */}
                <div className="flex gap-2 border-b border-white/10 mb-6 pb-2">
                  <button onClick={() => setProfileTab("frames")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "frames" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Рамки</button>
                  <button onClick={() => setProfileTab("titles")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "titles" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Титулы</button>
                  <button onClick={() => setProfileTab("items")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "items" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Предметы</button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {profileTab === "frames" && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {FRAMES.filter(f => f.id === "default" || user?.id === ADMIN_ID).map(f => (
                        <button 
                          key={f.id} 
                          onClick={() => { setProfile({...profile, frame: f.id}); saveProfile({ username: profile.username, frame: f.id }); }}
                          className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-4 ${profile?.frame === f.id ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`}
                          title={f.label}
                        >
                          {f.icon ? (
                            <div className="w-16 h-16 relative">
                              <Image src={f.icon} alt={f.label} fill className="object-contain" unoptimized />
                            </div>
                          ) : (
                            <div className="text-4xl opacity-50">🚫</div>
                          )}
                          <span className="text-xs text-zinc-400 mt-3 text-center leading-tight font-bold">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {profileTab === "titles" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TITLES.map(t => {
                        const isOwned = profile?.owned_titles?.includes(t.id) || (t.id === 'admin' && user.id === ADMIN_ID);
                        if (!isOwned) return null;
                        return (
                          <button
                            key={t.id}
                            onClick={() => saveProfile({ username: profile.username, title: t.name })}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${profile?.title === t.name ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`}
                          >
                            <TitleBadge titleName={t.name} />
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{(t as any).type}</div>
                          </button>
                        );
                      })}
                      {(!profile?.owned_titles || profile?.owned_titles.length === 0) && user.id !== ADMIN_ID && (
                        <div className="text-zinc-500 col-span-full">У вас пока нет титулов</div>
                      )}
                    </div>
                  )}

                  {profileTab === "items" && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
                      <div className="text-6xl mb-4">📦</div>
                      <p>Коллекционные предметы появятся здесь в будущих обновлениях.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==== АДМИН-ПАНЕЛЬ ==== */}
        {view === "admin" && user?.id === ADMIN_ID && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-3xl font-black text-red-500 drop-shadow-lg">Админ-панель</h2>
              <input 
                type="text" 
                placeholder="Поиск игрока..." 
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-red-500 text-white w-full md:w-auto"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {adminUsers.filter(u => u.username?.toLowerCase().includes(adminSearch.toLowerCase())).map(u => (
                <div key={u.id} className="bg-[#121214] p-6 rounded-3xl border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-12 h-12" />
                    <div>
                      <div className="font-bold text-lg text-white">{u.username || 'Без имени'}</div>
                      <div className="text-xs text-zinc-400">ID: {u.id.slice(0, 8)}...</div>
                      <div className="text-xs text-zinc-400">Роль: <span className="text-green-400 font-bold">{u.role || 'user'}</span></div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <label className="text-sm text-zinc-400 mb-2 block">Назначить роль</label>
                    <select 
                      value={u.role || 'user'} 
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white"
                    >
                      <option value="user">Пользователь</option>
                      <option value="moderator">Модератор</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>

                  <div className="border-t border-white/10 pt-3 flex-1">
                    <label className="text-sm text-zinc-400 mb-2 block">Выдать / Забрать титул</label>
                    <div className="flex flex-wrap gap-2">
                      {TITLES.map(t => {
                        const hasTitle = u.owned_titles?.includes(t.id);
                        return (
                          <button 
                            key={t.id}
                            onClick={() => toggleTitle(u.id, t.id)}
                            className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${hasTitle ? "bg-green-500/20 border-green-500/30 text-green-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/30"}`}
                            title={hasTitle ? "Нажмите, чтобы забрать" : "Нажмите, чтобы выдать"}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ПАНЕЛЬ МОЕЙ СБОРКИ (Мобильная - поверх всего) */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[28rem] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[60] transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Моя сборка</h2>
          <button onClick={() => setIsPackOpen(false)} className="bg-white/10 hover:bg-white/20 border border-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-white">✕</button>
        </div>
        
        <div className="p-4 border-b border-white/10 shrink-0">
            <input
                type="text"
                placeholder="Поиск по сборке..."
                value={packSearch}
                onChange={(e) => setPackSearch(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white"
            />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {filteredPackMods.map(mod => (
            <div key={mod.project_id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div>
                <span className="text-sm font-bold truncate text-white">{mod.title}</span>
              </div>
              <button onClick={() => removeArtifact(mod.project_id)} className="text-red-500 hover:text-red-400 p-2">✕</button>
            </div>
          ))}
          {filteredPackMods.length === 0 && <div className="text-center text-zinc-400 mt-10">Ничего не найдено</div>}
        </div>
        <div className="p-4 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button onClick={() => downloadModpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            {isDownloading ? "Скачивание..." : "Скачать .zip"}
          </button>
          <button onClick={() => exportMrpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
            {isDownloading ? "..." : "Экспорт в .mrpack"}
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
            
            <div className="absolute bottom-10 left-4 md:left-10 max-w-4xl">
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">{viewingPack.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-zinc-300">
                <div onClick={() => openUserProfile(viewingPack.user_id)} className="flex items-center gap-2 bg-black/40 hover:bg-black/60 cursor-pointer px-4 py-2 rounded-xl backdrop-blur-md transition-colors">
                  <AvatarWithFrame url={viewingPack.profiles?.avatar_url} frame={viewingPack.profiles?.frame} size="w-8 h-8" />
                  <span className="font-bold text-sm text-white hover:underline">{viewingPack.profiles?.username || "Игрок"}</span>
                  <TitleBadge titleName={viewingPack.profiles?.title || "Новичок"} />
                </div>
                <div className="bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold">
                  {viewingPack.game_version} • {viewingPack.loader.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingPack.screenshots.map((url, i) => (
                      <div key={i} className="w-full aspect-video rounded-2xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => window.open(url, '_blank')}>
                        <Image src={url} alt="screenshot" fill className="object-contain" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Описание</h3>
                <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-[#121214] p-6 md:p-8 rounded-3xl border border-white/5 shadow-xl leading-relaxed whitespace-pre-wrap">
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

              {/* БЛОК КОММЕНТАРИЕВ */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Комментарии</h3>
                
                {user ? (
                  <div className="flex gap-3 mb-6">
                    <AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" />
                    <div className="flex-1 flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Написать комментарий..." 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && postComment()}
                        className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" 
                      />
                      <button onClick={postComment} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-bold transition-colors">Отправить</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-500 mb-6 bg-white/5 p-4 rounded-xl text-center">Войдите, чтобы оставить комментарий</div>
                )}

                <div className="space-y-4">
                  {comments.length === 0 && <div className="text-zinc-500 text-sm">Пока нет комментариев. Будьте первым!</div>}
                  {comments.map(c => (
                    <div key={c.id} className="bg-[#121214] p-4 rounded-2xl border border-white/5 flex gap-3">
                      <AvatarWithFrame url={c.profiles?.avatar_url} frame={c.profiles?.frame} size="w-8 h-8" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-green-400">{c.profiles?.username || "Игрок"}</span>
                          <TitleBadge titleName={c.profiles?.title || "Новичок"} />
                          <span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.content}</p>
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

                {/* БЛОК РЕЙТИНГА */}
                <div className="mb-6 pb-6 border-b border-white/10 flex flex-col items-center gap-2">
                   <div className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Оценка сборки</div>
                   <div className="flex gap-1">
                     {[1, 2, 3, 4, 5].map(star => (
                       <button 
                         key={star} 
                         onClick={(e) => setRating(viewingPack.id, star, e)} 
                         className={`text-3xl transition-transform hover:scale-125 ${star <= (userRatings[viewingPack.id] || 0) ? "text-yellow-400" : "text-zinc-600 hover:text-yellow-400/50"}`}
                       >
                         ★
                       </button>
                     ))}
                   </div>
                   <div className="text-sm font-bold text-zinc-300 mt-1">
                     {Number(viewingPack.rating || 0) > 0 ? `${Number(viewingPack.rating).toFixed(1)} / 5` : "Нет оценок"}
                   </div>
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[80] flex items-center justify-center p-2 md:p-4" onClick={() => setSelectedMod(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            
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
                      <div key={i} className="w-full aspect-video rounded-2xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                        <Image src={img.url} alt={img.title || "Gallery image"} fill className="object-contain" unoptimized />
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
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-white truncate">{v.name}</div>
                            <div className="text-xs text-zinc-400 mt-1 truncate" title={v.game_versions.join(", ")}>
                              Загрузчик: {v.loaders.join(", ")} • Игра: {v.game_versions.slice(0, 5).join(", ")} {v.game_versions.length > 5 ? `и еще ${v.game_versions.length - 5}...` : ''}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleAddMod(selectedMod, v)} 
                            disabled={isAdding === selectedMod.project_id || !!activePack?.artifacts[selectedMod.project_id]}
                            className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isAdding === selectedMod.project_id ? "..." : activePack?.artifacts[selectedMod.project_id] ? "Добавлено" : "Добавить в сборку"}
                          </button>
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

      {viewingUser && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[80] flex items-center justify-center p-2 md:p-4" onClick={() => setViewingUser(null)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl p-6 md:p-10 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8 mt-4">
              <AvatarWithFrame url={viewingUser.avatar_url} frame={viewingUser.frame} size="w-32 h-32" />
              <div className="text-center md:text-left">
                <h2 className="text-3xl font-black text-white mb-2">{viewingUser.username}</h2>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                  <TitleBadge titleName={viewingUser.title || "Новичок"} size="lg" />
                  <span className="text-xs text-zinc-400 uppercase tracking-widest">{viewingUser.role === 'admin' ? 'Админ' : viewingUser.role === 'moderator' ? 'Модер' : 'Игрок'}</span>
                </div>
                <p className="text-zinc-300 text-sm max-w-lg whitespace-pre-wrap">{viewingUser.bio || "Этот пользователь еще не рассказал о себе."}</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xl font-bold text-white mb-4">Сборки пользователя ({viewingUserPacks.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {viewingUserPacks.length === 0 && <div className="text-zinc-500 col-span-full">У пользователя пока нет опубликованных сборок.</div>}
                {viewingUserPacks.map(pack => (
                  <div key={pack.id} onClick={() => { setViewingUser(null); setViewingPack(pack); }} className="bg-[#121214] border border-white/10 p-4 rounded-2xl hover:border-green-500/50 cursor-pointer transition-all flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-zinc-800 relative overflow-hidden shrink-0 border border-white/10">
                      {pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-20">🖼️</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">{pack.name}</div>
                      <div className="text-xs text-zinc-400 mt-1">{pack.game_version} • {pack.loader.toUpperCase()}</div>
                      <div className="text-xs text-green-400 mt-1">⬇ {pack.downloads || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setIsPublishModalOpen(false)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8" onClick={e => e.stopPropagation()}>
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
                    <div key={i} className="w-20 h-20 rounded-lg bg-black/50 relative overflow-hidden border border-white/10 group">
                      <Image src={url} alt="screenshot" fill className="object-contain" unoptimized />
                      <button 
                        onClick={() => {
                          const newScreens = activePack.screenshots?.filter((_, idx) => idx !== i);
                          updateActivePack({ screenshots: newScreens });
                        }}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
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