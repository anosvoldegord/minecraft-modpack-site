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
type PublishedPack = { id: string; user_id: string; name: string; game_version: string; loader: string; artifacts: Record<string, Artifact>; downloads: number; likes: number; rating?: number; cover_url?: string; description?: string; screenshots?: string[]; video_url?: string; bumped_until?: string; created_at?: string; profiles: { username: string; avatar_url: string; title: string; frame?: string } };
type UserProfile = { id: string; username: string; avatar_url: string; title: string; frame?: string; role?: string; owned_titles?: string[]; bio?: string; owned_items?: string[]; coins?: number; last_gacha_pull?: string; };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; };
type GachaItem = { id: string; name: string; type: "frame" | "item" | "boost"; rarity: number; chance: number; img: string; emoji: string; style?: string; bonus: string; };
type MarketItem = { id: string; seller_id: string; item_id: string; price: number; created_at: string; profiles: { username: string; avatar_url: string; title: string; frame?: string } };

const CATEGORIES = [{ id: "adventure", label: "РџСЂРёРєР»СЋС‡РµРЅРёСЏ" }, { id: "technology", label: "РўРµС…РЅРѕР»РѕРіРёРё" }, { id: "magic", label: "РњР°РіРёСЏ" }, { id: "mobs", label: "Р–РёРІРѕС‚РЅС‹Рµ Рё РњРѕР±С‹" }, { id: "worldgen", label: "Р“РµРЅРµСЂР°С†РёСЏ РјРёСЂР°" }, { id: "equipment", label: "РЎРЅР°СЂСЏР¶РµРЅРёРµ" }, { id: "decoration", label: "Р”РµРєРѕСЂ" }, { id: "optimization", label: "РћРїС‚РёРјРёР·Р°С†РёСЏ" }, { id: "storage", label: "РҐСЂР°РЅРµРЅРёРµ" }, { id: "food", label: "Р•РґР°" }, { id: "library", label: "Р‘РёР±Р»РёРѕС‚РµРєРё" }, { id: "utility", label: "РЈС‚РёР»РёС‚С‹" }, { id: "quests", label: "РљРІРµСЃС‚С‹" }, { id: "game-mechanics", label: "РњРµС…Р°РЅРёРєРё" }];

const TITLES = [
  { id: "novice", name: "РќРѕРІРёС‡РѕРє", type: "standard", bg: "bg-gradient-to-b from-zinc-600 to-zinc-800 border border-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "player", name: "РРіСЂРѕРє", type: "standard", bg: "bg-gradient-to-b from-blue-500 to-blue-800 border border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)]" },
  { id: "master", name: "РњР°СЃС‚РµСЂ", type: "standard", bg: "bg-gradient-to-b from-purple-500 to-purple-900 border border-purple-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_10px_rgba(168,85,247,0.4)]" },
  { id: "vip", name: "VIP", type: "donate", bg: "bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 border border-yellow-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_0_15px_rgba(250,204,21,0.5)]" },
  { id: "admin", name: "РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ", type: "exclusive", bg: "bg-gradient-to-b from-red-600 via-red-900 to-black border border-red-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_0_30px_rgba(220,38,38,0.8)]" },
];

const GACHA_BANNERS = [
  {
    id: "standard", name: "РЎС‚Р°РЅРґР°СЂС‚РЅС‹Р№", desc: "РљР»Р°СЃСЃРёС‡РµСЃРєРёРµ РїСЂРµРґРјРµС‚С‹ Рё СЂР°РјРєРё.", color: "from-zinc-700 to-zinc-900", bannerImg: "/gacha/banner_standard.png",
    pool: [
      { id: "cat_mage", name: "РњСѓСЂР»С‹РєР°-Р§Р°СЂРѕРґРµР№", type: "item" as const, rarity: 5, chance: 1, img: "/gacha/cat_mage.png", emoji: "рџђ±", bonus: "РџСЂРёРЅРѕСЃРёС‚ СѓРґР°С‡Сѓ РІ РєСЂСѓС‚РєР°С…" },
      { id: "mushroom_house", name: "Р“СЂРёР±РЅРѕР№ РҐРѕР±Р±РёС‚", type: "item" as const, rarity: 4, chance: 5, img: "/gacha/mushroom_house.png", emoji: "рџЌ„", bonus: "РЈСЋС‚РЅС‹Р№ РґРѕРјРёРє РІ РёРЅРІРµРЅС‚Р°СЂРµ" },
      { id: "sky_whale", name: "РћР±Р»Р°С‡РЅС‹Р№ РЎС‚СЂР°РЅРЅРёРє", type: "item" as const, rarity: 4, chance: 10, img: "/gacha/sky_whale.png", emoji: "рџђі", bonus: "РџР»Р°РІР°РµС‚ РІ РѕР±Р»Р°РєР°С…" },
      { id: "dragon_fruit", name: "Р”СЂР°РєРѕРЅРёР№ РџР»РѕРґ", type: "item" as const, rarity: 3, chance: 30, img: "/gacha/dragon_fruit.png", emoji: "рџђ‰", bonus: "РЎР»Р°РґРєРёР№ Рё РїРѕР»РµР·РЅС‹Р№" },
      { id: "sleepy_fox", name: "РЎРѕРЅРЅС‹Р№ Р›РёСЃРµРЅРѕРє", type: "item" as const, rarity: 3, chance: 54, img: "/gacha/sleepy_fox.png", emoji: "рџ¦Љ", bonus: "РЎРїРёС‚ РІ СЂСЋРєР·Р°РєРµ" },
    ]
  },
  {
    id: "halloween", name: "РҐСЌР»Р»РѕСѓРёРЅ", desc: "Р–СѓС‚РєРёРµ СЂР°РјРєРё Рё СЂРµРґРєРёРµ РїСЂРµРґРјРµС‚С‹.", color: "from-orange-800 to-purple-900", bannerImg: "/gacha/banner_halloween.png",
    pool: [
      { id: "ghost_teapot", name: "Р§Р°Р№РЅРёРє Р”СѓС…РѕРІ", type: "item" as const, rarity: 5, chance: 1, img: "/gacha/ghost_teapot.png", emoji: "рџ«–", bonus: "Р—Р°РІР°СЂРёРІР°РµС‚ РїСЂРёР·СЂР°С‡РЅС‹Р№ С‡Р°Р№" },
      { id: "winged_lantern", name: "РЎРІРµС‚ РќРµР±РµСЃ", type: "frame" as const, rarity: 4, chance: 5, img: "/gacha/winged_lantern.png", emoji: "рџЏ®", bonus: "РћСЃРІРµС‰Р°РµС‚ РїСѓС‚СЊ" },
      { id: "pumpkin_slime", name: "РўС‹РєРІРµРЅРЅС‹Р№ РЎР»Р°Р№Рј", type: "item" as const, rarity: 4, chance: 15, img: "/gacha/pumpkin_slime.png", emoji: "рџЋѓ", bonus: "РџСЂС‹РіР°РµС‚ РїРѕ РєРѕРјРЅР°С‚Рµ" },
      { id: "witch_cauldron", name: "Р’РµРґСЊРјРёРЅ РљРѕС‚РµР»", type: "item" as const, rarity: 3, chance: 30, img: "/gacha/witch_cauldron.png", emoji: "рџЌІ", bonus: "Р’Р°СЂРёС‚ Р·РµР»СЊСЏ" },
      { id: "cute_bat", name: "Р›РµС‚СѓС‡Р°СЏ РњС‹С€РєР°", type: "item" as const, rarity: 3, chance: 49, img: "/gacha/cute_bat.png", emoji: "рџ¦‡", bonus: "Р›РµС‚Р°РµС‚ РїРѕ РЅРѕС‡Р°Рј" },
    ]
  },
  {
    id: "space", name: "РљРѕСЃРјРѕСЃ", desc: "Р“Р°Р»Р°РєС‚РёС‡РµСЃРєРёРµ СЂРµРґРєРѕСЃС‚Рё Рё Р°СЃС‚СЂРѕ-СЂР°РјРєРё.", color: "from-indigo-900 via-purple-900 to-black", bannerImg: "",
    pool: [
      { id: "space_helmet", name: "РљРѕСЃРјРёС‡РµСЃРєРёР№ РЁР»РµРј", type: "frame" as const, rarity: 5, chance: 1, img: "/gacha/space_helmet.png", emoji: "рџ‘ЁвЂЌрџљЂ", bonus: "РџРѕР·РІРѕР»СЏРµС‚ РґС‹С€Р°С‚СЊ РІ РєРѕСЃРјРѕСЃРµ" },
      { id: "star_crystal", name: "Р—РІРµР·РґРЅС‹Р№ РљСЂРёСЃС‚Р°Р»Р»", type: "item" as const, rarity: 5, chance: 4, img: "/gacha/star_crystal.png", emoji: "рџЊџ", bonus: "РЎРІРµС‚РёС‚СЃСЏ РєР°Рє Р·РІРµР·РґР°" },
      { id: "magic_comet", name: "РњР°РіРёС‡РµСЃРєР°СЏ РљРѕРјРµС‚Р°", type: "item" as const, rarity: 4, chance: 10, img: "/gacha/magic_comet.png", emoji: "в„пёЏ", bonus: "РћСЃС‚Р°РІР»СЏРµС‚ СЂР°РґСѓР¶РЅС‹Р№ СЃР»РµРґ" },
      { id: "forest_amulet", name: "Р›РµСЃРЅРѕР№ РђРјСѓР»РµС‚", type: "item" as const, rarity: 4, chance: 15, img: "/gacha/forest_amulet.png", emoji: "рџЊї", bonus: "Р—Р°С‰РёС‰Р°РµС‚ РѕС‚ СЃРіР»Р°Р·Р°" },
      { id: "moon_rabbit", name: "Р›СѓРЅРЅС‹Р№ РљСЂРѕР»РёРє", type: "item" as const, rarity: 3, chance: 70, img: "/gacha/moon_rabbit.png", emoji: "рџђ°", bonus: "Р–РёРІРµС‚ РЅР° Р›СѓРЅРµ" },
    ]
  }
];

const ALL_ITEMS: GachaItem[] = GACHA_BANNERS.flatMap((b: any) => b.pool).filter((v: any, i: number, a: any[]) => a.findIndex((v2: any) => v2.id === v.id) === i);
const ITEMS_PER_PAGE = 40;
const CATALOG_PER_PAGE = 9;
const EMOJIS = ["рџЂ", "рџ‚", "рџ¤Ј", "рџЉ", "рџЌ", "рџ¤©", "рџЋ", "рџ­", "рџЎ", "рџ‘Ќ", "рџ‘Ћ", "рџ”Ґ", "рџ’Ї", "вќ¤пёЏ", "рџ’”", "рџЋ‰", "рџ’©", "рџ‘»", "рџ’Ђ", "рџ¤–", "рџ‘ѕ", "рџЋ®", "рџ•№пёЏ", "рџ’»"];
const GIFFS = ["https://media.tenor.com/2e0gS8t6c3AAAAAC/pepe-pepe-the-frog.gif","https://media.tenor.com/8vJj2k4k5jAAAAAC/cat-cat-meme.gif","https://media.tenor.com/5Fk4J3k2k1AAAAAC/dog-dog-meme.gif"];

const getItemCount = (ownedItems: string[] | undefined, itemId: string) => {
  if (!ownedItems) return 0;
  const found = ownedItems.find((s: string) => s === itemId || s.startsWith(`${itemId}:`));
  if (!found) return 0;
  if (found.includes(":")) return parseInt(found.split(":")[1]) || 1;
  return 1;
};

const isItemLocked = (ownedItems: string[] | undefined, itemId: string) => {
  if (!ownedItems) return false;
  return ownedItems.some((s: string) => s.startsWith(`${itemId}:locked`));
};

const getCleanItems = (ownedItems: string[] | undefined) => {
  if (!ownedItems) return [];
  return [...new Set(ownedItems.map((s: string) => s.split(":")[0]))];
};

const ItemImage = ({ src, emoji, alt, className, silhouette = false }: { src: string, emoji: string, alt: string, className?: string, silhouette?: boolean }) => {
  const [error, setError] = useState(false);
  if (error || !src) return <div className={`flex items-center justify-center ${className}`}><span className="text-4xl md:text-5xl drop-shadow-md">{emoji}</span></div>;
  return <img src={src} alt={alt} className={`${className} ${silhouette ? "brightness-0 opacity-40" : ""}`} onError={() => setError(true)} />;
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
  const equippedFrame = ALL_ITEMS.find((i: any) => i.id === frame && i.type === "frame");
  const frameStyle = equippedFrame?.style || "border-white/10";
  return (
    <div className={`relative ${size} shrink-0 rounded-full border-2 ${frameStyle} bg-zinc-900 overflow-hidden group`}>
      <div className="absolute inset-0.5 rounded-full overflow-hidden">
        {url ? <Image src={url} alt="avatar" fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-lg">рџ‘¤</div>}
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  const borderColor = type === 'success' ? 'border-l-green-500' : type === 'error' ? 'border-l-red-500' : 'border-l-blue-500';
  return (
    <div className={`fixed top-6 right-6 px-5 py-3 rounded-r-xl rounded-l-md bg-[#121214]/95 border border-white/10 border-l-4 ${borderColor} shadow-2xl z-[100] animate-in slide-in-from-top-5 flex items-center gap-3 font-medium text-sm text-zinc-200 backdrop-blur-xl`}>
      {type === 'success' && <span className="text-green-500 text-lg">вњ“</span>}
      {type === 'error' && <span className="text-red-500 text-lg">вњ•</span>}
      {message}
    </div>
  );
};

export default function Home() {
  const [view, setView] = useState<"mods" | "catalog" | "profile" | "friends" | "admin" | "market">("mods");
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
  const [isGachaOpen, setIsGachaOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState<any>(GACHA_BANNERS[0]);
  const [isPulling, setIsPulling] = useState(false);
  const [gachaAnim, setGachaAnim] = useState<"idle" | "spinning" | "result">("idle");
  const [gachaResult, setGachaResult] = useState<any>(null);

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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");
  const [packSearch, setPackSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [profileTab, setProfileTab] = useState<"frames" | "titles" | "items">("frames");
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [viewingUserPacks, setViewingUserPacks] = useState<PublishedPack[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

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

  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [sellModalItem, setSellModalItem] = useState<{ itemId: string, price: string } | null>(null);

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

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);
  useEffect(() => { if (viewingPack) fetchComments(viewingPack.id); }, [viewingPack]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isFriendTyping]);
  useEffect(() => { if (activeChat) { fetchMessages(activeChat.id); const interval = setInterval(() => fetchMessages(activeChat.id), 3000); const channel = supabase.channel(`typing-${[user.id, activeChat.id].sort().join('-')}`); channel.on('broadcast', { event: 'typing' }, (payload: any) => { if (payload.payload.user_id !== user.id) { setIsFriendTyping(true); setTimeout(() => setIsFriendTyping(false), 2000); } }).subscribe(); channelRef.current = channel; return () => { clearInterval(interval); supabase.removeChannel(channel); }; } }, [activeChat]);
  useEffect(() => { if (user) { fetchFriends(); fetchSuggestedUsers(); const interval = setInterval(fetchFriends, 5000); return () => clearInterval(interval); } }, [user]);
  useEffect(() => { if (user && user.id === ADMIN_ID && view === "admin") { supabase.from('profiles').select('*').then(({ data }) => { if (data) setAdminUsers(data); }); } }, [user, view]);
  useEffect(() => { if (user) fetchFromDB(); else { const saved = localStorage.getItem("modbuilder_packs"); if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) { setModpacks(parsed); setActivePackId(parsed[0].id); } } catch(e) {} } else { createNewPack(true, null); } setIsLoaded(true); } fetchCatalog(); fetchMarket(); }, [user]);
  useEffect(() => { if (isLoaded && view === "mods") fetchMods(currentPage); }, [query, selectedCategories, activePack?.gameVersion, activePack?.loader, currentPage, view, isLoaded]);
  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setIsLoggingIn(false); if(session?.user) { fetchProfile(session.user.id); fetchUserLikes(session.user.id); fetchUserRatings(session.user.id); } }); const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => { setUser(session?.user ?? null); if (event === 'SIGNED_IN') { setIsLoggingIn(false); fetchProfile(session!.user.id); fetchUserLikes(session!.user.id); fetchUserRatings(session!.user.id); } }); return () => authListener.subscription.unsubscribe(); }, []);
  useEffect(() => { if (!user) return; const checkUnread = async () => { const { data } = await supabase.from('messages').select('sender_id, created_at').eq('receiver_id', user.id); if (data) { let count = 0; const readState = JSON.parse(localStorage.getItem('read_state') || '{}'); data.forEach((msg: any) => { if (!readState[msg.sender_id] || new Date(msg.created_at) > new Date(readState[msg.sender_id])) count++; }); setUnreadCount(count); } }; checkUnread(); const interval = setInterval(checkUnread, 5000); return () => clearInterval(interval); }, [user]);

  const fetchMarket = async () => {
    const { data, error } = await supabase.from('market_items').select('*, profiles(username, avatar_url, title, frame)').order('created_at', { ascending: false });
    if (data) setMarketItems(data as any);
  };

  const handleOpenChat = (friend: UserProfile) => { setActiveChat(friend); const readState = JSON.parse(localStorage.getItem('read_state') || '{}'); readState[friend.id] = new Date().toISOString(); localStorage.setItem('read_state', JSON.stringify(readState)); setUnreadCount(0); };
  const translateDescription = async (markdown: string) => { try { const rawHtml = marked.parse(markdown) as string; const tempDiv = document.createElement("div"); tempDiv.innerHTML = DOMPurify.sanitize(rawHtml); const textNodes: Node[] = []; const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null); let node; while (node = walker.nextNode()) { if (node.textContent?.trim()) textNodes.push(node); } if (!textNodes.length) return; const combined = textNodes.map((n: any) => n.textContent?.trim() || "").join(" ||| "); const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(combined.substring(0, 4000))}`); const data = await res.json(); const parts = data[0].map((i: any) => i[0]).join("").split(" ||| "); textNodes.forEach((n: any, i: number) => { if (parts[i]) n.textContent = parts[i].trim(); }); setTranslatedDesc(DOMPurify.sanitize(tempDiv.innerHTML)); } catch { showToast("РћС€РёР±РєР° РїРµСЂРµРІРѕРґР°", "error"); } };

  const fetchFriends = async () => { if (!user) return; try { const { data: sent } = await supabase.from('friendships').select('*').eq('sender_id', user.id); const { data: received } = await supabase.from('friendships').select('*').eq('receiver_id', user.id); const relations = [...(sent || []), ...(received || [])]; const accepted = relations.filter((r: any) => r.status === 'accepted'); const pending = relations.filter((r: any) => r.status === 'pending' && r.receiver_id === user.id); const friendIds = accepted.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id); if (friendIds.length > 0) { const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds); setFriends(friendIds.map((id: string) => profiles?.find((pr: any) => pr.id === id) || { id, username: 'РќРµРёР·РІРµСЃС‚РЅС‹Р№', avatar_url: null, title: 'РќРѕРІРёС‡РѕРє', frame: 'default' })); } else setFriends([]); const reqIds = pending.map((r: any) => r.sender_id); if (reqIds.length > 0) { const { data: profs } = await supabase.from('profiles').select('*').in('id', reqIds); setRequests(pending.map((req: any) => ({ ...req, profile: profs?.find((pr: any) => pr.id === req.sender_id) || { id: req.sender_id, username: 'РќРµРёР·РІРµСЃС‚РЅС‹Р№', avatar_url: null, title: 'РќРѕРІРёС‡РѕРє', frame: 'default' } }))); } else setRequests([]); } catch(e) {} };
  const fetchSuggestedUsers = async () => { if (!user) return; const { data } = await supabase.from('profiles').select('*').neq('id', user.id).limit(20); if (data) setSuggestedUsers(data); };
  const searchUsers = async (q: string) => { setSearchQuery(q); if (q.length < 2) { setSearchResults([]); return; } const { data } = await supabase.from('profiles').select('*').ilike('username', `%${q}%`).neq('id', user?.id).limit(10); setSearchResults(data || []); };
  const sendFriendRequest = async (receiverId: string) => { await supabase.from('friendships').insert({ sender_id: user.id, receiver_id: receiverId, status: 'pending' }); showToast("Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР°!", "success"); setSearchQuery(""); setSearchResults([]); };
  const acceptRequest = async (id: string) => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id); showToast("РўРµРїРµСЂСЊ РІС‹ РґСЂСѓР·СЊСЏ!", "success"); await fetchFriends(); };
  const removeFriend = async (friendId: string, e: React.MouseEvent) => { e.stopPropagation(); if (!confirm("РЈРґР°Р»РёС‚СЊ РёР· РґСЂСѓР·РµР№?")) return; await supabase.from('friendships').delete().eq('sender_id', user.id).eq('receiver_id', friendId); await supabase.from('friendships').delete().eq('sender_id', friendId).eq('receiver_id', user.id); if (activeChat?.id === friendId) setActiveChat(null); fetchFriends(); showToast("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»РµРЅ", "success"); };
  const clearChat = async () => { if (!activeChat || !user) return; if (!confirm("РћС‡РёСЃС‚РёС‚СЊ С‡Р°С‚?")) return; await supabase.from('messages').delete().eq('sender_id', user.id).eq('receiver_id', activeChat.id); await supabase.from('messages').delete().eq('sender_id', activeChat.id).eq('receiver_id', user.id); setMessages([]); showToast("Р§Р°С‚ РѕС‡РёС‰РµРЅ", "success"); };
  const fetchMessages = async (friendId: string) => { const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`).order('created_at', { ascending: true }); setMessages(data || []); };
  const sendMessage = async (gifUrl?: string) => { if (!newMessage.trim() && !attachedFile && !gifUrl) return; if (!activeChat) return; setIsSendingFile(true); let fileUrl = null; if (attachedFile) { const fileExt = attachedFile.name.split('.').pop(); const fileName = `${user.id}-${Date.now()}.${fileExt}`; const { error } = await supabase.storage.from('chat_files').upload(fileName, attachedFile); if (!error) { const { data } = supabase.storage.from('chat_files').getPublicUrl(fileName); fileUrl = data.publicUrl; } else { showToast("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё", "error"); setIsSendingFile(false); return; } } const content = gifUrl || fileUrl || newMessage.trim(); setNewMessage(""); setAttachedFile(null); setPreviewUrl(null); setShowEmojiPicker(false); await supabase.from('messages').insert({ sender_id: user.id, receiver_id: activeChat.id, content }); fetchMessages(activeChat.id); setIsSendingFile(false); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setAttachedFile(file); setPreviewUrl(URL.createObjectURL(file)); } };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); const file = e.dataTransfer.files?.[0]; if (file) { setAttachedFile(file); setPreviewUrl(URL.createObjectURL(file)); } };
  const deleteMessage = async (id: string) => { if (!confirm("РЈРґР°Р»РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ?")) return; await supabase.from('messages').delete().eq('id', id); setMessages(prev => prev.filter((m: any) => m.id !== id)); };
  const startEditMessage = (id: string, content: string) => { setEditingMessageId(id); setEditMessageContent(content); };
  const cancelEditMessage = () => { setEditingMessageId(null); setEditMessageContent(""); };
  const saveEditMessage = async (id: string) => { if (!editMessageContent.trim()) return; await supabase.from('messages').update({ content: editMessageContent.trim() }).eq('id', id); setMessages(prev => prev.map((m: any) => m.id === id ? { ...m, content: editMessageContent.trim() } : m)); setEditingMessageId(null); setEditMessageContent(""); showToast("РЎРѕРѕР±С‰РµРЅРёРµ РѕР±РЅРѕРІР»РµРЅРѕ", "success"); };

  const fetchProfile = async (userId: string) => { const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(); if (error) return; if (data) setProfile(data); else { const newProfile = { id: userId, username: "РРіСЂРѕРє", title: "РќРѕРІРёС‡РѕРє", avatar_url: null, frame: "default", role: "user", owned_titles: ["novice"], bio: "", coins: 500, owned_items: [] }; await supabase.from('profiles').insert(newProfile); setProfile(newProfile); } };
  const fetchUserLikes = async (userId: string) => { const { data } = await supabase.from('pack_likes').select('pack_id').eq('user_id', userId); if (data) setLikedPacks(data.map((d: any) => d.pack_id)); };
  const fetchUserRatings = async (userId: string) => { const { data } = await supabase.from('pack_ratings').select('pack_id, rating').eq('user_id', userId); if (data) { const ratingsMap: Record<string, number> = {}; data.forEach((r: any) => { ratingsMap[r.pack_id] = r.rating; }); setUserRatings(ratingsMap); } };
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !user) return; setIsUploading(true); try { const fileExt = file.name.split('.').pop(); const fileName = `${user.id}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('avatars').getPublicUrl(fileName); await supabase.from('profiles').upsert({ id: user.id, avatar_url: data.publicUrl, username: profile?.username || "РРіСЂРѕРє", title: profile?.title || "РќРѕРІРёС‡РѕРє", frame: profile?.frame || "default" }); setProfile((prev: any) => ({ ...prev, avatar_url: data.publicUrl })); fetchProfile(user.id); showToast("РђРІР°С‚Р°СЂРєР° РѕР±РЅРѕРІР»РµРЅР°!", "success"); } catch (error: any) { showToast(error.message || "РћС€РёР±РєР°", "error"); } finally { setIsUploading(false); } };
  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => { const file = e.target.files?.[0]; if (!file || !user) return; try { const fileExt = file.name.split('.').pop(); const fileName = `cover-${packId}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('covers').getPublicUrl(fileName); const newPacks = modpacks.map((p: any) => p.id === packId ? { ...p, cover_url: data.publicUrl } : p); setModpacks(newPacks); await saveToDB(newPacks, packId); if (activePack?.id === packId && activePack.published_id) { await supabase.from('published_packs').update({ cover_url: data.publicUrl }).eq('id', activePack.published_id); fetchCatalog(); } showToast("РћР±Р»РѕР¶РєР° Р·Р°РіСЂСѓР¶РµРЅР°!", "success"); } catch (error: any) { showToast("РћС€РёР±РєР°: " + error.message, "error"); } };
  const uploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>, packId: string) => { const file = e.target.files?.[0]; if (!file || !user) return; try { const fileExt = file.name.split('.').pop(); const fileName = `screen-${packId}-${Math.random()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file); if (uploadError) throw uploadError; const { data } = supabase.storage.from('covers').getPublicUrl(fileName); const pack = modpacks.find((p: any) => p.id === packId); const newScreens = [...(pack?.screenshots || []), data.publicUrl]; const newPacks = modpacks.map((p: any) => p.id === packId ? { ...p, screenshots: newScreens } : p); setModpacks(newPacks); await saveToDB(newPacks, packId); if (activePack?.id === packId && activePack.published_id) { await supabase.from('published_packs').update({ screenshots: newScreens }).eq('id', activePack.published_id); fetchCatalog(); } showToast("РЎРєСЂРёРЅС€РѕС‚ РґРѕР±Р°РІР»РµРЅ!", "success"); } catch (error: any) { showToast("РћС€РёР±РєР°: " + error.message, "error"); } };

  const saveProfile = async (updates: any) => { if (!user) return; const { error } = await supabase.from('profiles').upsert({ id: user.id, username: updates.username || profile?.username || "РРіСЂРѕРє", title: updates.title || profile?.title || "РќРѕРІРёС‡РѕРє", avatar_url: profile?.avatar_url || null, frame: updates.frame !== undefined ? updates.frame : profile?.frame || "default", bio: updates.bio !== undefined ? updates.bio : profile?.bio || "", owned_items: updates.owned_items !== undefined ? updates.owned_items : profile?.owned_items || [], coins: updates.coins !== undefined ? updates.coins : profile?.coins || 500 }); if (error) showToast("РћС€РёР±РєР°: " + error.message, "error"); else { setProfile((prev: any) => ({ ...prev, ...updates })); fetchProfile(user.id); showToast("РЎРѕС…СЂР°РЅРµРЅРѕ!", "success"); } };
  const toggleTitle = async (targetUserId: string, titleId: string) => { const targetUser = adminUsers.find((u: any) => u.id === targetUserId); if (!targetUser) return; const currentOwned = targetUser.owned_titles || ['novice']; const hasTitle = currentOwned.includes(titleId); const newOwned = hasTitle ? currentOwned.filter((id: string) => id !== titleId) : [...currentOwned, titleId]; await supabase.from('profiles').update({ owned_titles: newOwned }).eq('id', targetUserId); showToast(hasTitle ? "Р—Р°Р±СЂР°РЅ!" : "Р’С‹РґР°РЅ!", "success"); setAdminUsers(prev => prev.map((u: any) => u.id === targetUserId ? { ...u, owned_titles: newOwned } : u)); };
  const updateRole = async (targetUserId: string, newRole: string) => { await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId); showToast("Р РѕР»СЊ РѕР±РЅРѕРІР»РµРЅР°!", "success"); setAdminUsers(prev => prev.map((u: any) => u.id === targetUserId ? { ...u, role: newRole } : u)); };

  const toggleLike = async (packId: string, e: React.MouseEvent) => { e.stopPropagation(); if (!user) return showToast("Р’РѕР№РґРёС‚Рµ", "error"); const isLiked = likedPacks.includes(packId); if (isLiked) { await supabase.from('pack_likes').delete().eq('pack_id', packId).eq('user_id', user.id); setLikedPacks(prev => prev.filter((id: string) => id !== packId)); if (viewingPack) setViewingPack({ ...viewingPack, likes: Math.max(0, (viewingPack?.likes || 1) - 1) }); } else { await supabase.from('pack_likes').insert({ pack_id: packId, user_id: user.id }); setLikedPacks(prev => [...prev, packId]); if (viewingPack) setViewingPack({ ...viewingPack, likes: (viewingPack?.likes || 0) + 1 }); } fetchCatalog(); };
  const setRating = async (packId: string, score: number, e: React.MouseEvent) => { e.stopPropagation(); if (!user || (viewingPack && viewingPack.user_id === user.id)) return; await supabase.from('pack_ratings').upsert({ pack_id: packId, user_id: user.id, rating: score }, { onConflict: 'pack_id,user_id' }); const { data } = await supabase.from('published_packs').select('rating').eq('id', packId).single(); if (data && viewingPack) setViewingPack({ ...viewingPack, rating: data.rating }); setUserRatings(prev => ({ ...prev, [packId]: score })); fetchCatalog(); };
  const openUserProfile = async (userId: string) => { const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single(); if (prof) setViewingUser(prof); const { data: packs } = await supabase.from('published_packs').select('*').eq('user_id', userId).order('created_at', { ascending: false }); if (packs) setViewingUserPacks(packs as any); };
  const fetchComments = async (packId: string) => { const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url, title, frame)').eq('pack_id', packId).order('created_at', { ascending: true }); if (data) setComments(data); };
  const postComment = async () => { if (!newComment.trim() || !user || !viewingPack) return; await supabase.from('comments').insert({ pack_id: viewingPack.id, user_id: user.id, content: newComment.trim() }); setNewComment(""); fetchComments(viewingPack.id); showToast("РљРѕРјРјРµРЅС‚Р°СЂРёР№ РґРѕР±Р°РІР»РµРЅ", "success"); };

  const fetchCatalog = async () => { setCatalogError(null); const { data: packs, error } = await supabase.from('published_packs').select('*').order('created_at', { ascending: false }); if (error) { setCatalogError(error.message); return; } if (!packs) return; const userIds = [...new Set(packs.map((p: any) => p.user_id))]; const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, title, frame').in('id', userIds); setCatalog(packs.map((pack: any) => ({ ...pack, profiles: profiles?.find((pr: any) => pr.id === pack.user_id) || { username: 'РќРµРёР·РІРµСЃС‚РЅС‹Р№', avatar_url: '', title: 'РќРѕРІРёС‡РѕРє', frame: 'default' } })) as any); };
  const fetchFromDB = async () => { if (!user) return; const { data } = await supabase.from('modpacks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }); if (data && data.length > 0) { setModpacks(data.map((d: any) => ({ id: d.id, name: d.name, gameVersion: d.game_version, loader: d.loader, artifacts: d.artifacts || {}, cover_url: d.cover_url || undefined, description: d.description || undefined, screenshots: d.screenshots || [], video_url: d.video_url || undefined, published_id: d.published_id || undefined }))); setActivePackId(data[0].id); } else createNewPack(true, user); setIsLoaded(true); };
  const saveToDB = async (newPacks: Modpack[], currentId: string): Promise<any> => { if (!user) { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); return true; } const pack = newPacks.find((p: any) => p.id === currentId); if (!pack) return false; const { error } = await supabase.from('modpacks').upsert({ id: pack.id, user_id: user.id, name: pack.name, game_version: pack.gameVersion, loader: pack.loader, artifacts: JSON.parse(JSON.stringify(pack.artifacts || {})), description: pack.description || null, screenshots: pack.screenshots || [], cover_url: pack.cover_url || null, video_url: pack.video_url || null, published_id: pack.published_id || null }); if (error) { showToast("РћС€РёР±РєР° Р‘Р”: " + error.message, "error"); return false; } return true; };
  const createNewPack = async (isInitial = false, currentUser = user) => { const newId = crypto.randomUUID(); const newPack = { id: newId, name: isInitial ? "РњРѕСЏ СЃР±РѕСЂРєР°" : "РќРѕРІР°СЏ СЃР±РѕСЂРєР°", gameVersion: "1.16.5", loader: "forge", artifacts: {}, screenshots: [], cover_url: undefined, description: "", video_url: "" }; setModpacks(prev => [...prev, newPack]); setActivePackId(newId); setIsSidebarOpen(true); if (currentUser) await supabase.from('modpacks').insert({ id: newId, user_id: currentUser.id, name: newPack.name, game_version: newPack.gameVersion, loader: newPack.loader, artifacts: {}, description: "", screenshots: [] }); else localStorage.setItem("modbuilder_packs", JSON.stringify([newPack])); };
  const publishPack = async () => { if (!user || !activePack || Object.keys(activePack.artifacts).length === 0) return showToast("РЎРЅР°С‡Р°Р»Р° РґРѕР±Р°РІСЊС‚Рµ РјРѕРґС‹!", "error"); try { if (activePack.published_id) { const { error } = await supabase.from('published_packs').update({ name: activePack.name, game_version: activePack.gameVersion, loader: activePack.loader, artifacts: activePack.artifacts, cover_url: activePack.cover_url, description: activePack.description, screenshots: activePack.screenshots || [], video_url: activePack.video_url }).eq('id', activePack.published_id); if (error) throw error; showToast("РЎР±РѕСЂРєР° РѕР±РЅРѕРІР»РµРЅР°!", "success"); } else { const { data: insertedData, error } = await supabase.from('published_packs').insert({ user_id: user.id, name: activePack.name, game_version: activePack.gameVersion, loader: activePack.loader, artifacts: activePack.artifacts, cover_url: activePack.cover_url, description: activePack.description, screenshots: activePack.screenshots || [], video_url: activePack.video_url }).select(); if (error) throw error; if (insertedData && (insertedData as any)[0]) { const pubId = (insertedData as any)[0].id; const newPacks = modpacks.map((p: any) => p.id === activePackId ? { ...p, published_id: pubId } : p); setModpacks(newPacks); await saveToDB(newPacks, activePackId); } showToast("РЎР±РѕСЂРєР° РѕРїСѓР±Р»РёРєРѕРІР°РЅР°!", "success"); } setIsPublishModalOpen(false); fetchCatalog(); } catch(e: any) { showToast("РћС€РёР±РєР°: " + e.message, "error"); } };
  const importPack = async (pack: PublishedPack) => { const newId = crypto.randomUUID(); const newPack = { id: newId, name: `РљРѕРїРёСЏ: ${pack.name}`, gameVersion: pack.game_version, loader: pack.loader, artifacts: pack.artifacts, cover_url: pack.cover_url, description: pack.description, screenshots: pack.screenshots, video_url: pack.video_url }; const newPacks = [...modpacks, newPack]; setModpacks(newPacks); setActivePackId(newId); saveToDB(newPacks, newId); try { const userId = getUserId(); if (pack.user_id !== userId) { const { data: isNew } = await supabase.rpc('register_pack_download', { p_pack_id: pack.id, p_user_id: userId }); if (isNew) { setViewingPack(prev => prev ? { ...prev, downloads: (prev.downloads || 0) + 1 } : null); fetchCatalog(); } } } catch(e) { console.error(e); } showToast("РЎР±РѕСЂРєР° РґРѕР±Р°РІР»РµРЅР° РІ Р»РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚!", "success"); setView("mods"); };
  const deleteFromCatalog = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirm("РЈРґР°Р»РёС‚СЊ РёР· РєР°С‚Р°Р»РѕРіР°?")) { try { const { error } = await supabase.from('published_packs').delete().eq('id', id); if (error) throw error; const packToUpdate = modpacks.find((p: any) => p.published_id === id); if (packToUpdate) { const newPacks = modpacks.map((p: any) => p.id === packToUpdate.id ? { ...p, published_id: undefined } : p); setModpacks(newPacks); await saveToDB(newPacks, packToUpdate.id); } fetchCatalog(); showToast("РЈРґР°Р»РµРЅРѕ РёР· РєР°С‚Р°Р»РѕРіР°", "success"); } catch (e: any) { showToast("РћС€РёР±РєР°: " + e.message, "error"); } } };
  const deletePack = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (modpacks.length === 1) return showToast("РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ РїРѕСЃР»РµРґРЅСЋСЋ СЃР±РѕСЂРєСѓ", "error"); if (confirm("РЈРґР°Р»РёС‚СЊ СЌС‚Сѓ СЃР±РѕСЂРєСѓ?")) { const newPacks = modpacks.filter((p: any) => p.id !== id); setModpacks(newPacks); if (activePackId === id) setActivePackId(newPacks[0].id); if (user) { await supabase.from('modpacks').delete().eq('id', id); } else { localStorage.setItem("modbuilder_packs", JSON.stringify(newPacks)); } showToast("РЎР±РѕСЂРєР° СѓРґР°Р»РµРЅР°", "success"); } };
  const startRenaming = (id: string, currentName: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPackId(id); setEditNameValue(currentName); };
  const saveRename = () => { if (editingPackId && editNameValue.trim()) { const newPacks = modpacks.map((p: any) => p.id === editingPackId ? { ...p, name: editNameValue.trim() } : p); setModpacks(newPacks); saveToDB(newPacks, activePackId); } setEditingPackId(null); };
  const updateActivePack = (updates: Partial<Modpack>) => { const newPacks = modpacks.map((p: any) => p.id === activePackId ? { ...p, ...updates } : p); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const toggleCategory = (catId: string) => { setSelectedCategories(prev => prev.includes(catId) ? prev.filter((c: string) => c !== catId) : [...prev, catId]); setCurrentPage(1); };
  const fetchMods = async (page: number) => { setIsLoading(true); try { const facets = [[`versions:${activePack?.gameVersion || "1.16.5"}`], [`categories:${activePack?.loader || "forge"}`], ["project_type:mod"]]; if (selectedCategories.length > 0) facets.push(selectedCategories.map((c: string) => `categories:${c}`)); let url = `https://api.modrinth.com/v2/search?offset=${(page - 1) * ITEMS_PER_PAGE}&limit=${ITEMS_PER_PAGE}`; if (!query.trim() && selectedCategories.length === 0) url += `&query=&index=downloads`; else if (query.trim()) url += `&query=${encodeURIComponent(query)}`; url += `&facets=${encodeURIComponent(JSON.stringify(facets))}`; const res = await fetch(url); const data = await res.json(); setResults(data.hits || []); setTotalHits(data.total_hits || 0); } catch(e) {} setIsLoading(false); };
  const openModModal = async (mod: ModInfo) => { setIsModalLoading(true); setSelectedMod({ ...mod, body: "", gallery: [] }); setTranslatedDesc(null); try { const [projRes, verRes] = await Promise.all([ fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`), fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`) ]); const projData = await projRes.json(); const verData = await verRes.json(); setSelectedMod({ ...mod, body: projData.body || "", gallery: projData.gallery || [] }); setModVersions(verData || []); if (projData.body) translateDescription(projData.body); } catch(e) {} finally { setIsModalLoading(false); } };
  const handleAddMod = async (mod: ModInfo, specificVersion?: any) => { setIsAdding(mod.project_id); try { let verRes: any = specificVersion; if (!verRes) { const versionsData = await (await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json(); verRes = versionsData[0]; } if (!verRes) return showToast("Р’РµСЂСЃРёСЏ РЅРµ РЅР°Р№РґРµРЅР°", "error"); const newArtifacts: Record<string, Artifact> = { [mod.project_id]: { project_id: mod.project_id, version_id: verRes.id, title: mod.title, isLibrary: false, icon_url: mod.icon_url || "", file_url: verRes.files[0]?.url || "", file_name: verRes.files[0]?.filename || "", version_number: verRes.version_number || "" } }; if (verRes.dependencies) { for (const dep of verRes.dependencies) { if (dep.dependency_type === "required" && dep.project_id) { const libProj = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}`)).json(); const libVersions = await (await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${activePack.gameVersion}"]&loaders=["${activePack.loader}"]`)).json(); const libVer = libVersions[0]; if (libVer) newArtifacts[dep.project_id] = { project_id: dep.project_id, version_id: libVer.id, title: libProj.title, isLibrary: true, icon_url: libProj.icon_url || "", file_url: libVer.files[0]?.url || "", file_name: libVer.files[0]?.filename || "", version_number: libVer.version_number || "" }; } } } const newPacks = modpacks.map((p: any) => { if (p.id !== activePackId) return p; return { ...p, artifacts: { ...p.artifacts, ...newArtifacts } }; }); setModpacks(newPacks); const success = await saveToDB(newPacks, activePackId); if (success) { setSelectedMod(null); showToast("РњРѕРґ РґРѕР±Р°РІР»РµРЅ", "success"); } } catch(e) {} finally { setIsAdding(null); } };
  const removeArtifact = (id: string) => { const newPacks = modpacks.map((p: any) => { if (p.id !== activePackId) return p; const copy = { ...p.artifacts }; delete copy[id]; return { ...p, artifacts: copy }; }); setModpacks(newPacks); saveToDB(newPacks, activePackId); };
  const downloadModpack = async (pack: any) => { const list = Object.values(pack.artifacts) as any[]; if (list.length === 0) return; setIsDownloading(true); const zip = new JSZip(); const modsFolder = zip.folder("mods"); try { for (const item of list) { if (item.file_url && item.file_name) { const res = await fetch(item.file_url); modsFolder?.file(item.file_name, await res.blob()); } } const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.zip`; a.click(); if (pack.id && pack.downloads !== undefined) { const userId = getUserId(); if (pack.user_id !== userId) { const { data: isNew } = await supabase.rpc('register_pack_download', { p_pack_id: pack.id, p_user_id: userId }); if (isNew) { if (viewingPack && viewingPack.id === pack.id) setViewingPack({ ...viewingPack, downloads: (viewingPack.downloads || 0) + 1 }); fetchCatalog(); } } } } catch(e) { console.error(e); } finally { setIsDownloading(false); } };
  const exportMrpack = async (pack: Modpack) => { if (!pack || Object.keys(pack.artifacts).length === 0) return; setIsDownloading(true); const zip = new JSZip(); const files = Object.values(pack.artifacts).map((mod: any) => ({ path: `mods/${mod.file_name}`, hashes: {}, env: { client: "required", server: "required" }, downloads: [mod.file_url] })); const mrpackIndex = { formatVersion: 1, game: "minecraft", versionId: "1.0.0", name: pack.name || "Modpack", files: files, dependencies: { minecraft: pack.gameVersion, [pack.loader]: "latest" } }; zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 2)); try { const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = `${pack.name}.mrpack`; a.click(); } catch(e) { console.error(e); } finally { setIsDownloading(false); } };
  const login = (provider: 'github' | 'google' = 'github') => { setIsLoggingIn(true); supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }); };
  const logout = () => supabase.auth.signOut();

  const useBoost = async () => {
    if (!user || !activePack?.published_id) return showToast("РЎРЅР°С‡Р°Р»Р° РѕРїСѓР±Р»РёРєСѓР№С‚Рµ СЃР±РѕСЂРєСѓ", "error");
    if (!profile?.owned_items?.includes("vip_ticket")) return showToast("РЈ РІР°СЃ РЅРµС‚ VIP-Р‘РёР»РµС‚Р°", "error");
    const { data, error } = await supabase.rpc('use_boost_item', { p_item_id: 'vip_ticket', p_pack_id: activePack.published_id });
    if (error) return showToast(error.message, "error");
    const res = data as any;
    if (res?.success) { showToast(res.message, "success"); fetchProfile(user.id); fetchCatalog(); fetchFromDB(); }
    else showToast(res?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРёРјРµРЅРёС‚СЊ Р±СѓСЃС‚", "error");
  };

  const canFreePull = (() => {
    if (!profile?.last_gacha_pull) return true;
    return (Date.now() - new Date(profile.last_gacha_pull).getTime()) > 24 * 60 * 60 * 1000;
  })();

  const pullGacha = async (isFree = false) => {
    if (!user || !profile) return showToast("Р’РѕР№РґРёС‚Рµ", "error");
    if (isFree && !canFreePull) return showToast("Р‘РµСЃРїР»Р°С‚РЅР°СЏ РєСЂСѓС‚РєР° СѓР¶Рµ РёСЃРїРѕР»СЊР·РѕРІР°РЅР°", "error");
    if (!isFree && (profile.coins || 0) < 100) return showToast("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚", "error");
    setIsPulling(true); setGachaAnim("spinning"); setGachaResult(null);
    
    const roll = Math.random() * 100;
    let currentChance = 0;
    let selectedItem = activeBanner.pool[0];
    
    for (const item of activeBanner.pool) {
      currentChance += item.chance;
      if (roll <= currentChance) {
        selectedItem = item;
        break;
      }
    }

    setTimeout(async () => {
      const currentOwned = profile.owned_items || [];
      const currentCount = getItemCount(currentOwned, selectedItem.id);
      const newCount = currentCount + 1;
      
      let newOwned = currentOwned.filter((s: string) => !s.startsWith(selectedItem.id) && s !== selectedItem.id);
      newOwned.push(newCount > 1 ? `${selectedItem.id}:${newCount}` : selectedItem.id);

      const cost = isFree ? 0 : 100;
      const newCoins = (profile.coins || 0) - cost;
      const updates: any = { owned_items: newOwned, coins: newCoins, last_gacha_pull: new Date().toISOString() };
      await supabase.from('profiles').update(updates).eq('id', user.id);
      setProfile((p: any) => ({ ...p, ...updates }));
      setGachaResult({ ...selectedItem, count: newCount });
      setGachaAnim("result"); setIsPulling(false);
      
      showToast(currentCount > 0 ? `Р’С‹Р±РёС‚Рѕ: ${selectedItem.name} (x${newCount})` : `РќРѕРІС‹Р№ РїСЂРµРґРјРµС‚: ${selectedItem.name}`, 'success');
    }, 1800);
  };

  const sellItem = async (itemId: string) => {
    if (!user || !profile) return;
    const currentCount = getItemCount(profile.owned_items, itemId);
    if (currentCount === 0) return;

    const newCount = currentCount - 1;
    let newOwned = (profile.owned_items || []).filter((s: string) => !s.startsWith(itemId) && s !== itemId);
    
    if (newCount > 0) {
      newOwned.push(newCount > 1 ? `${itemId}:${newCount}` : itemId);
    }

    const newCoins = (profile.coins || 0) + 50;
    const updates = { owned_items: newOwned, coins: newCoins };
    
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile((p: any) => ({ ...p, ...updates }));
    showToast(`РџСЂРµРґРјРµС‚ РїСЂРѕРґР°РЅ Р·Р° 50 РјРѕРЅРµС‚!`, 'success');
  };

  const toggleLock = async (itemId: string) => {
    if (!user || !profile) return;
    const isLocked = isItemLocked(profile.owned_items, itemId);
    const currentCount = getItemCount(profile.owned_items, itemId);
    if (currentCount === 0) return;

    let newOwned = (profile.owned_items || []).filter((s: string) => !s.startsWith(itemId) && s !== itemId);
    
    if (isLocked) {
      newOwned.push(currentCount > 1 ? `${itemId}:${currentCount}` : itemId);
      showToast("РџСЂРµРґРјРµС‚ СЂР°Р·Р±Р»РѕРєРёСЂРѕРІР°РЅ", "success");
    } else {
      newOwned.push(currentCount > 1 ? `${itemId}:${currentCount}:locked` : `${itemId}:1:locked`);
      showToast("РџСЂРµРґРјРµС‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ РѕС‚ РїСЂРѕРґР°Р¶Рё", "success");
    }

    const updates = { owned_items: newOwned };
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile((p: any) => ({ ...p, ...updates }));
  };

  const listItemOnMarket = async (itemId: string, price: number) => {
    if (!user || !profile) return;
    const currentCount = getItemCount(profile.owned_items, itemId);
    if (currentCount === 0) return;

    const newCount = currentCount - 1;
    let newOwned = (profile.owned_items || []).filter((s: string) => !s.startsWith(itemId) && s !== itemId);
    if (newCount > 0) newOwned.push(newCount > 1 ? `${itemId}:${newCount}` : itemId);

    const updates = { owned_items: newOwned };
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile((p: any) => ({ ...p, ...updates }));
    await supabase.from('market_items').insert({ seller_id: user.id, item_id: itemId, price });
    fetchMarket();
    showToast(`Р’С‹СЃС‚Р°РІР»РµРЅРѕ РЅР° СЂС‹РЅРѕРє Р·Р° ${price} рџЄ™!`, 'success');
  };

  const buyMarketItem = async (marketId: string, itemId: string, price: number, sellerId: string) => {
    if (!user || !profile) return showToast("Р’РѕР№РґРёС‚Рµ", "error");
    if (profile.coins < price) return showToast("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚", "error");
    if (sellerId === user.id) return showToast("РќРµР»СЊР·СЏ РєСѓРїРёС‚СЊ СЃРІРѕР№ РїСЂРµРґРјРµС‚", "error");

    const newCoins = (profile.coins || 0) - price;
    const currentOwned = profile.owned_items || [];
    const currentCount = getItemCount(currentOwned, itemId);
    const newCount = currentCount + 1;
    let newOwned = currentOwned.filter((s: string) => !s.startsWith(itemId) && s !== itemId);
    newOwned.push(newCount > 1 ? `${itemId}:${newCount}` : itemId);

    const updates = { owned_items: newOwned, coins: newCoins };
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile((p: any) => ({ ...p, ...updates }));

    await supabase.from('market_items').delete().eq('id', marketId);

    const { data: sellerProfile } = await supabase.from('profiles').select('coins').eq('id', sellerId).single();
    if (sellerProfile) {
      await supabase.from('profiles').update({ coins: (sellerProfile.coins || 0) + price }).eq('id', sellerId);
    }

    fetchMarket();
    showToast("РџСЂРµРґРјРµС‚ СѓСЃРїРµС€РЅРѕ РєСѓРїР»РµРЅ!", "success");
  };

  if (!isLoaded) return <div className="h-dvh bg-[#09090b] text-white flex items-center justify-center">Р—Р°РіСЂСѓР·РєР°...</div>;

  const artifactList = activePack ? Object.values(activePack.artifacts) : [];
  const modsList = artifactList.filter((a: any) => !a.isLibrary);
  const filteredPackMods = modsList.filter((m: any) => m.title.toLowerCase().includes(packSearch.toLowerCase()));
  const totalPages = Math.ceil(totalHits / ITEMS_PER_PAGE);
  const now = Date.now();
  const vipPacks = catalog.filter((p: any) => p.bumped_until && new Date(p.bumped_until).getTime() > now).sort((a: any,b: any) => new Date(b.bumped_until!).getTime() - new Date(a.bumped_until!).getTime());
  let filteredCatalog = catalog.filter((pack: any) => {
    const matchVersion = catalogVersion === "all" || pack.game_version === catalogVersion;
    const matchLoader = catalogLoader === "all" || pack.loader === catalogLoader;
    const matchSearch = pack.name.toLowerCase().includes(catalogSearch.toLowerCase());
    const notVip = !pack.bumped_until || new Date(pack.bumped_until).getTime() <= now;
    return matchVersion && matchLoader && matchSearch && notVip;
  });
  if (catalogSort === "downloads") filteredCatalog.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
  else if (catalogSort === "popularity") filteredCatalog.sort(calculateTopScore);
  const totalCatalogPages = Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE);
  const paginatedCatalog = filteredCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE);

  const formatTimeLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "РСЃС‚РµРєР»Рѕ";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}С‡ ${m}Рј`;
  };

  return (
    <div className="flex h-dvh text-white font-sans overflow-hidden relative selection:bg-green-500/30">
      <style jsx global>{`
        @keyframes spinMagic {
          0% { transform: rotate(0deg) scale(0.8); opacity: 0; }
          20% { opacity: 1; scale: 1; }
          80% { transform: rotate(720deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(1080deg) scale(0); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px 10px rgba(168,85,247,0.4); }
          50% { box-shadow: 0 0 60px 30px rgba(168,85,247,0.8); }
        }
        @keyframes particlesFly {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        @keyframes textGlow {
          0%, 100% { text-shadow: 0 0 10px #fff, 0 0 20px #a855f7; }
          50% { text-shadow: 0 0 20px #fff, 0 0 40px #a855f7; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes swirl {
          0% { transform: rotate(0deg) translateX(80px) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: rotate(360deg) translateX(80px) rotate(-360deg); opacity: 0; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 z-0"><div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg.png')" }}></div><div className="absolute inset-0 bg-black/60"></div></div>
      {isLoggingIn && <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center"><div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-6"></div><h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Р’С…РѕРґ...</h2></div>}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`bg-black/90 md:bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 transition-transform duration-300 z-40 fixed inset-y-0 left-0 md:relative md:translate-x-0 w-72 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"}`}>
        <div className="p-6 flex justify-between items-center"><h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-md">ModBuilder</h1><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-white p-2">вњ•</button></div>
        <div className="px-4 space-y-1 mb-4">
          <button onClick={() => { setView("mods"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "mods" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>РЎР±РѕСЂС‰РёРє</button>
          <button onClick={() => { setView("catalog"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "catalog" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>РљР°С‚Р°Р»РѕРі СЃР±РѕСЂРѕРє</button>
          <button onClick={() => { setView("market"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "market" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>рџ›’ Р С‹РЅРѕРє РїСЂРµРґРјРµС‚РѕРІ</button>
          <button onClick={() => { setView("friends"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-colors ${view === "friends" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>РЎРѕРѕР±С‰РµСЃС‚РІРѕ {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}</button>
          <button onClick={() => { setIsGachaOpen(true); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors text-purple-300 hover:bg-purple-500/20`}>рџЋ° Р“Р°С‡Р°-РњР°С€РёРЅР°</button>
          <button onClick={() => { setView("profile"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "profile" ? "bg-green-500 text-black" : "hover:bg-white/10 text-white"}`}>РњРѕР№ РїСЂРѕС„РёР»СЊ</button>
          {user?.id === ADMIN_ID && <button onClick={() => { setView("admin"); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${view === "admin" ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-500/10"}`}>рџ‘‘ РђРґРјРёРЅ-РїР°РЅРµР»СЊ</button>}
        </div>
        {view === "mods" && (<><div className="px-6 pb-2 flex justify-between items-center text-sm font-bold text-zinc-400"><span>РњРѕРё СЃР±РѕСЂРєРё</span><button onClick={() => createNewPack()} className="text-white hover:text-green-400 text-lg" title="РЎРѕР·РґР°С‚СЊ">+</button></div><div className="flex-1 overflow-y-auto px-3 space-y-2">{modpacks.map((pack: any) => (<div key={pack.id} onClick={() => { setActivePackId(pack.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`relative group p-4 rounded-2xl cursor-pointer border border-transparent transition-all ${activePackId === pack.id ? "bg-white/20 border-white/20 shadow-lg" : "hover:bg-white/10"}`}>{editingPackId === pack.id ? <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={saveRename} onKeyDown={(e) => e.key === "Enter" && saveRename()} className="bg-black/50 border border-green-500/50 rounded-lg px-2 py-1 text-sm w-full outline-none text-white" /> : <div className="font-bold text-sm truncate pr-14 text-white">{pack.name}</div>}<div className="text-xs text-zinc-300 mt-1">{pack.gameVersion} вЂў {pack.loader.toUpperCase()}</div><div className="absolute top-4 right-3 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => startRenaming(pack.id, pack.name, e)} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/20">вњЋ</button><button onClick={(e) => deletePack(pack.id, e)} className="text-zinc-400 hover:text-red-500 p-1 rounded-md hover:bg-white/20">вњ•</button></div></div>))}</div></>)}
        <div className="p-5 mt-auto">{user ? (<div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center gap-3"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" /><div className="flex-1 min-w-0"><div className="text-green-400 text-xs mb-0.5">Р’С‹ РІРѕС€Р»Рё:</div><div className="truncate font-bold text-sm text-white">{profile?.username || user.email}</div><div className="text-xs text-yellow-400 font-bold">рџЄ™ {profile?.coins ?? 500}</div></div><button onClick={logout} className="text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-xs transition-colors">Р’С‹Р№С‚Рё</button></div>) : (<div className="flex flex-col gap-2"><button onClick={() => login('github')} className="bg-[#24292e] hover:bg-[#2f363d] border border-white/20 text-white px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Р’РѕР№С‚Рё С‡РµСЂРµР· GitHub</button><button onClick={() => login('google')} className="bg-white hover:bg-gray-200 text-black border border-white/20 px-4 py-3 rounded-xl font-bold w-full shadow-lg transition-colors">Р’РѕР№С‚Рё С‡РµСЂРµР· Google</button></div>)}</div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10 w-full">
        {view === "mods" && (<><header className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4 bg-black/30 backdrop-blur-xl z-20"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4 w-full md:w-auto"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/10 hover:bg-white/20 border border-white/20 p-3 rounded-xl shrink-0 transition-colors text-white">РњРµРЅСЋ</button><input type="text" placeholder="РџРѕРёСЃРє РјРѕРґРѕРІ..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 md:flex-none md:w-96 bg-black/30 border border-white/20 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:border-green-500/50 focus:bg-black/50 transition-all text-white placeholder-zinc-400" /></div><div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto"><CustomSelect value={activePack?.gameVersion || "1.16.5"} onChange={(val) => updateActivePack({ gameVersion: val, artifacts: {} })} options={[{ value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} /><CustomSelect value={activePack?.loader || "forge"} onChange={(val) => updateActivePack({ loader: val, artifacts: {} })} options={[{ value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} /><button onClick={() => setIsPackOpen(true)} className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] flex-1 md:flex-none">РЎР±РѕСЂРєР° ({modsList.length})</button></div></div><div className="flex flex-wrap gap-2">{CATEGORIES.map(cat => (<button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${selectedCategories.includes(cat.id) ? "bg-green-500/30 border-green-500/60 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{cat.label}</button>))}</div></header><div className="flex-1 overflow-y-auto p-4 md:p-6">{isLoading ? <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div></div> : (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">{results.map(mod => (<div key={mod.project_id} onClick={() => openModModal(mod)} className="bg-black/50 backdrop-blur-md border border-white/10 p-5 rounded-3xl hover:border-green-500/50 hover:bg-black/60 cursor-pointer flex flex-col gap-4 shadow-xl hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all duration-300 hover:-translate-y-1 group"><div className="flex items-center gap-4 relative z-10"><div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden relative shadow-lg group-hover:scale-105 transition-transform border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div><div className="min-w-0"><h3 className="font-bold text-lg truncate pr-2 text-white">{mod.title}</h3><div className="text-xs text-zinc-400 mt-1">в¬‡ {mod.downloads.toLocaleString()}</div></div></div><p className="text-sm text-zinc-300 line-clamp-3 flex-1 relative z-10">{mod.description}</p><button onClick={(e) => { e.stopPropagation(); handleAddMod(mod); }} disabled={isAdding === mod.project_id || !!activePack?.artifacts[mod.project_id]} className="bg-white/10 hover:bg-green-500 hover:text-black py-2.5 rounded-xl font-bold text-sm transition-colors relative z-10 border border-white/10 hover:border-green-500">{isAdding === mod.project_id ? "..." : activePack?.artifacts[mod.project_id] ? "Р”РѕР±Р°РІР»РµРЅРѕ" : "+ Р’ СЃР±РѕСЂРєСѓ"}</button></div>))}</div>)}{totalPages > 1 && (<div className="flex flex-wrap justify-center items-center gap-2 mt-8 mb-4"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">в†ђ РќР°Р·Р°Рґ</button><div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-2"><span className="text-sm text-zinc-400">РЎС‚СЂ.</span><input type="number" min="1" max={totalPages} value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const val = parseInt(pageInput); if (val >= 1 && val <= totalPages) { setCurrentPage(val); } } }} className="w-16 bg-black/50 border border-white/20 rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="text-sm text-zinc-400">РёР· {totalPages}</span></div><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Р’РїРµСЂРµРґ в†’</button></div>)}</div></>)}
        {view === "catalog" && (<div className="flex-1 overflow-y-auto p-4 md:p-8"><h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">РљР°С‚Р°Р»РѕРі СЃР±РѕСЂРѕРє</h2><div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md relative z-20"><div className="flex-1 min-w-[200px] flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">РџРѕРёСЃРє</span><input type="text" placeholder="РќР°Р·РІР°РЅРёРµ СЃР±РѕСЂРєРё..." value={catalogSearch} onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 text-white placeholder-zinc-400" /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Р’РµСЂСЃРёСЏ</span><CustomSelect value={catalogVersion} onChange={(v) => { setCatalogVersion(v); setCatalogPage(1); }} options={[{ value: "all", label: "Р’СЃРµ РІРµСЂСЃРёРё" }, { value: "1.20.1", label: "1.20.1" }, { value: "1.19.2", label: "1.19.2" }, { value: "1.16.5", label: "1.16.5" }, { value: "1.12.2", label: "1.12.2" }]} /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">Р—Р°РіСЂСѓР·С‡РёРє</span><CustomSelect value={catalogLoader} onChange={(v) => { setCatalogLoader(v); setCatalogPage(1); }} options={[{ value: "all", label: "Р’СЃРµ" }, { value: "forge", label: "Forge" }, { value: "fabric", label: "Fabric" }, { value: "quilt", label: "Quilt" }]} /></div><div className="flex flex-col gap-1"><span className="text-xs text-zinc-400 font-bold ml-1">РЎРѕСЂС‚РёСЂРѕРІРєР°</span><CustomSelect value={catalogSort} onChange={(v) => { setCatalogSort(v); setCatalogPage(1); }} options={[{ value: "newest", label: "РЎРЅР°С‡Р°Р»Р° РЅРѕРІС‹Рµ" }, { value: "downloads", label: "РџРѕ СЃРєР°С‡РёРІР°РЅРёСЏРј" }, { value: "popularity", label: "РџРѕ РїРѕРїСѓР»СЏСЂРЅРѕСЃС‚Рё" }]} /></div></div>{catalogError && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">РћС€РёР±РєР°: {catalogError}</div>}{vipPacks.length > 0 && (<div className="mb-10"><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-yellow-400">в­ђ VIP-Р’РёС‚СЂРёРЅР° <span className="text-sm font-normal text-zinc-500 ml-2">Р—Р°РЅСЏС‚Рѕ {vipPacks.length} РёР· 30</span></h3></div><div className="flex overflow-x-auto gap-6 pb-4 snap-x scrollbar-thin scrollbar-thumb-yellow-500/50 scrollbar-track-transparent">{vipPacks.map((pack, index) => (<div key={pack.id} onClick={() => setViewingPack(pack)} className="snap-start shrink-0 w-80 bg-[#121214]/90 backdrop-blur-md border border-yellow-500/40 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-yellow-400 transition-all hover:-translate-y-1"><div className="w-full h-40 bg-zinc-800 relative border-b border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-5xl opacity-10">рџ–јпёЏ</div>}<div className="absolute top-3 left-3 bg-yellow-500 text-black px-3 py-1 rounded-xl font-black text-sm flex items-center gap-1">{index === 0 ? "рџҐ‡ 1" : index === 1 ? "рџҐ€ 2" : index === 2 ? "рџҐ‰ 3" : "VIP"}</div><div className="absolute top-3 right-3 bg-black/70 text-yellow-300 px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-md">{formatTimeLeft(pack.bumped_until!)}</div></div><div className="p-5"><h3 className="text-xl font-bold">{pack.name}</h3><div className="text-sm text-zinc-400 mt-1">{pack.game_version} вЂў {pack.loader.toUpperCase()}</div><div className="flex justify-between mt-3 text-sm"><span className="text-green-400 font-bold">в¬‡ {pack.downloads || 0}</span><span className="text-pink-400">вќ¤пёЏ {pack.likes || 0}</span></div></div></div>))}</div></div>)}<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{paginatedCatalog.map(pack => (<div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/80 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-green-500/50 transition-all hover:-translate-y-1"><div className="w-full h-48 bg-zinc-800 relative border-b border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">рџ–јпёЏ</div>}{user && user.id === pack.user_id && (<button onClick={(e) => deleteFromCatalog(pack.id, e)} className="absolute top-4 right-4 text-zinc-300 hover:text-red-500 bg-black/60 hover:bg-black/90 p-2.5 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100 z-10" title="РЈРґР°Р»РёС‚СЊ РёР· РєР°С‚Р°Р»РѕРіР°">вњ•</button>)}</div><div className="p-5 flex flex-col gap-3 flex-1"><div className="flex items-center gap-3 border-b border-white/10 pb-3"><AvatarWithFrame url={pack.profiles?.avatar_url} frame={pack.profiles?.frame} size="w-10 h-10" /><div><div className="font-bold text-xs text-green-400 flex items-center gap-2 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); openUserProfile(pack.user_id); }}>{pack.profiles?.username || "РРіСЂРѕРє"}<TitleBadge titleName={pack.profiles?.title || "РќРѕРІРёС‡РѕРє"} /></div><div className="text-[10px] text-zinc-400">{pack.profiles?.title || "РќРѕРІРёС‡РѕРє"}</div></div></div><h3 className="text-xl font-bold pr-6 leading-tight">{pack.name}</h3><div className="text-sm text-zinc-400">{pack.game_version} вЂў {pack.loader.toUpperCase()}</div><div className="text-sm text-zinc-300 flex justify-between items-center mt-auto pt-2 border-t border-white/5"><div className="flex gap-3 text-xs"><span className="text-zinc-400">РњРѕРґРѕРІ: {Object.keys(pack.artifacts).length}</span><span className="text-pink-400">вќ¤пёЏ {pack.likes || 0}</span><span className="text-yellow-400">в… {Number(pack.rating || 0).toFixed(1)}</span></div><span className="text-green-400 font-bold">в¬‡ {pack.downloads || 0}</span></div></div></div>))}{filteredCatalog.length === 0 && !catalogError && <div className="text-zinc-500 col-span-full">РџРѕ РІР°С€РµРјСѓ Р·Р°РїСЂРѕСЃСѓ РЅРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ.</div>}</div>{totalCatalogPages > 1 && (<div className="flex justify-center items-center gap-2 mt-8"><button onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage === 1} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">в†ђ РќР°Р·Р°Рґ</button><span className="text-sm text-zinc-400 mx-4 font-bold">РЎС‚СЂ. {catalogPage} РёР· {totalCatalogPages}</span><button onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))} disabled={catalogPage === totalCatalogPages} className="bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-30">Р’РїРµСЂРµРґ в†’</button></div>)}</div>)}

        {view === "market" && user && (<div className="flex-1 overflow-y-auto p-4 md:p-8"><h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">рџ›’ Р С‹РЅРѕРє РїСЂРµРґРјРµС‚РѕРІ</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{marketItems.map(mItem => { const baseItem = ALL_ITEMS.find((i: any) => i.id === mItem.item_id); if (!baseItem) return null; return (<div key={mItem.id} className="bg-[#121214] border border-white/10 rounded-3xl p-5 flex flex-col shadow-xl relative"><div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2"><div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(mItem.seller_id)}><AvatarWithFrame url={mItem.profiles?.avatar_url} frame={mItem.profiles?.frame} size="w-8 h-8" /><span className="text-xs font-bold text-green-400 hover:underline">{mItem.profiles?.username || "РРіСЂРѕРє"}</span></div><span className="text-sm font-black text-yellow-400">{mItem.price} рџЄ™</span></div><div className="flex-1 flex flex-col items-center justify-center py-4"><ItemImage src={baseItem.img} emoji={baseItem.emoji} alt={baseItem.name} className="w-24 h-24 object-contain" /><div className="font-bold text-lg text-white mt-3">{baseItem.name}</div><div className="text-xs text-zinc-400 text-center mt-1">{baseItem.bonus}</div></div><button onClick={() => buyMarketItem(mItem.id, mItem.item_id, mItem.price, mItem.seller_id)} disabled={profile.coins < mItem.price || mItem.seller_id === user.id} className="w-full mt-2 bg-green-500 hover:bg-green-400 text-black py-2 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{mItem.seller_id === user.id ? "Р’Р°С€ Р»РѕС‚" : `РљСѓРїРёС‚СЊ (${mItem.price} рџЄ™)`}</button></div>); })}{marketItems.length === 0 && <div className="text-zinc-500 col-span-full text-center py-20">Р С‹РЅРѕРє РїРѕРєР° РїСѓСЃС‚. РќРёРєС‚Рѕ РЅРµ РІС‹СЃС‚Р°РІРёР» РїСЂРµРґРјРµС‚С‹ РЅР° РїСЂРѕРґР°Р¶Сѓ.</div>}</div></div>)}

        {view === "friends" && user && (<div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-transparent"><div className={`w-full md:w-80 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md shrink-0 ${activeChat ? 'hidden md:flex' : 'flex'}`}><div className="p-4 border-b border-white/10"><h2 className="text-xl font-bold mb-4">РЎРѕРѕР±С‰РµСЃС‚РІРѕ</h2><input type="text" placeholder="РџРѕРёСЃРє РёРіСЂРѕРєРѕРІ..." value={searchQuery} onChange={(e) => searchUsers(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" />{searchResults.length > 0 && (<div className="mt-2 bg-[#121214] border border-white/10 rounded-xl overflow-hidden">{searchResults.map(u => (<div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 border-b border-white/5 last:border-0"><div className="flex items-center gap-2 cursor-pointer" onClick={() => openUserProfile(u.id)}><AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-6 h-6" /><span className="text-sm truncate hover:underline">{u.username}</span></div><button onClick={() => sendFriendRequest(u.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">+</button></div>))}</div>)}</div>{requests.length > 0 && (<div className="p-4 border-b border-white/10"><h3 className="text-sm font-bold text-zinc-400 mb-2">Р—Р°СЏРІРєРё</h3>{requests.map(req => (<div key={req.id} className="flex items-center justify-between mb-2 bg-white/5 p-2 rounded-lg"><div className="flex items-center gap-2"><AvatarWithFrame url={req.profile?.avatar_url} frame={req.profile?.frame} size="w-8 h-8" /><span className="text-sm truncate">{req.profile?.username}</span></div><button onClick={() => acceptRequest(req.id)} className="text-xs bg-green-500 text-black px-2 py-1 rounded hover:bg-green-400">РџСЂРёРЅСЏС‚СЊ</button></div>))}</div>)}<div className="flex-1 overflow-y-auto p-4"><div className="flex justify-between items-center mb-2"><h3 className="text-sm font-bold text-zinc-400">РњРѕРё РґСЂСѓР·СЊСЏ</h3><button onClick={fetchFriends} className="text-xs text-green-500 hover:text-green-400">РћР±РЅРѕРІРёС‚СЊ</button></div>{friends.length === 0 && <div className="text-zinc-500 text-sm">РџРѕРєР° РЅРµС‚ РґСЂСѓР·РµР№</div>}{friends.map(f => (<div key={f.id} onClick={() => handleOpenChat(f)} className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${activeChat?.id === f.id ? "bg-white/10" : "hover:bg-white/5"}`}><div className="flex items-center gap-3 truncate"><AvatarWithFrame url={f.avatar_url} frame={f.frame} size="w-10 h-10" /><div className="truncate font-bold text-sm">{f.username}</div></div><button onClick={(e) => removeFriend(f.id, e)} className="text-zinc-500 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" title="РЈРґР°Р»РёС‚СЊ">вњ•</button></div>))}</div></div><div className={`flex-1 flex flex-col bg-black/10 backdrop-blur-sm relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>{activeChat ? (<><div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40"><div className="flex items-center gap-3"><button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-400 hover:text-white mr-2 text-xl">в†ђ</button><AvatarWithFrame url={activeChat.avatar_url} frame={activeChat.frame} size="w-10 h-10" /><div><h3 className="font-bold text-lg leading-tight flex items-center gap-2">{activeChat.username}<TitleBadge titleName={activeChat.title || "РќРѕРІРёС‡РѕРє"} /></h3>{isFriendTyping && <span className="text-xs text-green-400 animate-pulse">РџРµС‡Р°С‚Р°РµС‚...</span>}</div></div><button onClick={clearChat} className="text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">РћС‡РёСЃС‚РёС‚СЊ</button></div><div className={`flex-1 overflow-y-auto p-6 space-y-4 relative transition-colors ${isDraggingOver ? "bg-green-500/10 border-2 border-dashed border-green-500" : ""}`} onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={handleDrop}>{messages.length === 0 && <div className="text-center text-zinc-500 mt-10">РќР°С‡РЅРёС‚Рµ РѕР±С‰РµРЅРёРµ!</div>}{messages.map(m => (<div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"} group`}>{editingMessageId === m.id ? (<div className="flex flex-col gap-2 max-w-[70%] w-full items-end"><input autoFocus value={editMessageContent} onChange={e => setEditMessageContent(e.target.value)} className="w-full bg-black/50 border border-green-500 rounded-xl px-4 py-2 text-white outline-none" onKeyDown={(e) => e.key === 'Enter' && saveEditMessage(m.id)} /><div className="flex gap-2"><button onClick={() => cancelEditMessage()} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">РћС‚РјРµРЅР°</button><button onClick={() => saveEditMessage(m.id)} className="text-xs bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg">РЎРѕС…СЂР°РЅРёС‚СЊ</button></div></div>) : (<div className={`relative max-w-[85%] md:max-w-[70%] p-3 rounded-2xl ${m.sender_id === user.id ? "bg-green-500 text-black rounded-br-none" : "bg-white/10 text-white rounded-bl-none"}`}>{isImageUrl(m.content) ? (<div className="rounded-lg overflow-hidden max-w-sm cursor-pointer" onClick={() => window.open(m.content, '_blank')}><img src={m.content} alt="attachment" className="max-h-60 w-auto object-contain" /></div>) : (<p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>)}<div className={`text-[10px] mt-1 text-right ${m.sender_id === user.id ? "text-green-800" : "text-zinc-400"}`}>{formatTime(m.created_at)}</div>{m.sender_id === user.id && !isImageUrl(m.content) && (<div className="absolute top-1/2 -translate-y-1/2 -left-16 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEditMessage(m.id, m.content)} className="text-zinc-400 hover:text-white p-1" title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ">вњЋ</button><button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1" title="РЈРґР°Р»РёС‚СЊ">вњ•</button></div>)}{m.sender_id === user.id && isImageUrl(m.content) && (<div className="absolute top-1/2 -translate-y-1/2 -left-10 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => deleteMessage(m.id)} className="text-zinc-400 hover:text-red-500 p-1 bg-black/50 rounded-full" title="РЈРґР°Р»РёС‚СЊ">вњ•</button></div>)}</div>)}</div>))}{isFriendTyping && (<div className="flex justify-start"><div className="bg-white/10 text-white rounded-2xl rounded-bl-none p-3 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span></div></div>)}<div ref={chatEndRef} /></div><div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">{previewUrl && (<div className="relative w-32 h-32 rounded-xl overflow-hidden border border-green-500 mb-2 group"><img src={previewUrl} alt="preview" className="w-full h-full object-contain bg-black/50" /><button onClick={() => { setAttachedFile(null); setPreviewUrl(null); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">вњ•</button></div>)}<div className="flex gap-2 items-center relative">{showEmojiPicker && (<div className="absolute bottom-full mb-2 left-0 bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-72 animate-in slide-in-from-bottom-2"><div className="flex gap-2 mb-3 border-b border-white/10 pb-2"><button onClick={() => setEmojiTab("emojis")} className={`text-sm font-bold ${emojiTab === "emojis" ? "text-green-400" : "text-zinc-400"}`}>Р­РјРѕРґР·Рё</button><button onClick={() => setEmojiTab("gifs")} className={`text-sm font-bold ${emojiTab === "gifs" ? "text-green-400" : "text-zinc-400"}`}>Р“РёС„РєРё</button></div>{emojiTab === "emojis" ? (<div className="grid grid-cols-6 gap-2">{EMOJIS.map(e => (<button key={e} onClick={() => setNewMessage(prev => prev + e)} className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</button>))}</div>) : (<div className="grid grid-cols-3 gap-2">{GIFFS.map((gif, i) => (<div key={i} onClick={() => sendMessage(gif)} className="cursor-pointer hover:opacity-80 rounded-lg overflow-hidden border border-white/10 h-20"><img src={gif} alt="gif" className="w-full h-full object-cover" /></div>))}<button onClick={() => { setShowEmojiPicker(false); fileInputRef.current?.click(); }} className="h-20 border border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center text-xs text-zinc-400 hover:bg-white/5"><span>+</span> Р—Р°РіСЂСѓР·РёС‚СЊ</button></div>)}</div>)}<button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">рџЉ</button><button onClick={() => fileInputRef.current?.click()} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors hidden md:block">рџ“Ћ</button><input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" /><input type="text" value={newMessage} onChange={(e) => { setNewMessage(e.target.value); }} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="РќР°РїРёСЃР°С‚СЊ..." className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" /><button onClick={() => sendMessage()} disabled={isSendingFile} className="bg-green-500 hover:bg-green-400 text-black px-4 md:px-6 py-3 rounded-xl font-bold disabled:opacity-50">{isSendingFile ? "..." : "РћС‚РїСЂР°РІРёС‚СЊ"}</button></div></div></>) : (<div className="flex-1 flex items-center justify-center text-zinc-500">Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіР°, С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ РїРµСЂРµРїРёСЃРєСѓ</div>)}</div></div>)}

        {view === "profile" && user && (<div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center"><div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl"><div className="w-full lg:w-1/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center h-fit"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-40 h-40" /><div className="text-center mt-4 mb-6"><h2 className="text-2xl font-black text-white">{profile?.username || "РРіСЂРѕРє"}</h2><div className="mt-3 mb-2 flex justify-center"><TitleBadge titleName={profile?.title || "РќРѕРІРёС‡РѕРє"} size="lg" /></div><div className="text-xs text-zinc-400 mt-1 uppercase tracking-widest">{profile?.role === 'admin' ? 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ' : profile?.role === 'moderator' ? 'РњРѕРґРµСЂР°С‚РѕСЂ' : 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}</div><div className="mt-3 text-yellow-400 font-bold text-lg">рџЄ™ {profile?.coins ?? 500}</div></div><div className="w-full space-y-4"><div><label className="text-sm text-zinc-400 mb-1 block">РђРІР°С‚Р°СЂРєР°</label><input type="file" id="avatar-upload" accept="image/*" onChange={uploadAvatar} className="hidden" /><label htmlFor="avatar-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block">{isUploading ? "Р—Р°РіСЂСѓР·РєР°..." : "Р’С‹Р±СЂР°С‚СЊ С„РѕС‚Рѕ"}</label></div><div><label className="text-sm text-zinc-400 mb-1 block">РќРёРєРЅРµР№Рј</label><input type="text" value={profile?.username || ""} onChange={(e) => setProfile({...profile, username: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white" /></div><div><label className="text-sm text-zinc-400 mb-1 block">Рћ СЃРµР±Рµ</label><textarea value={profile?.bio || ""} onChange={(e) => setProfile({...profile, bio: e.target.value})} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-24 resize-none" placeholder="Р Р°СЃСЃРєР°Р¶РёС‚Рµ Рѕ СЃРµР±Рµ..."></textarea></div><button onClick={() => saveProfile({ username: profile.username, bio: profile.bio })} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-colors mt-4">РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ</button></div></div><div className="w-full lg:w-2/3 bg-black/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col min-h-[500px]"><h3 className="text-2xl font-black text-white mb-6">РРЅРІРµРЅС‚Р°СЂСЊ</h3><div className="flex gap-2 border-b border-white/10 mb-6 pb-2"><button onClick={() => setProfileTab("frames")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "frames" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Р Р°РјРєРё</button><button onClick={() => setProfileTab("titles")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "titles" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>РўРёС‚СѓР»С‹</button><button onClick={() => setProfileTab("items")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${profileTab === "items" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>РџСЂРµРґРјРµС‚С‹</button></div><div className="flex-1 overflow-y-auto">{profileTab === "frames" && (<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"><button onClick={() => { setProfile({...profile, frame: "default"}); saveProfile({ username: profile.username, frame: "default" }); }} className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-4 ${profile?.frame === "default" || !profile?.frame ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`} title="Р‘РµР· СЂР°РјРєРё"><div className="w-16 h-16 rounded-full border-2 border-white/10 bg-zinc-800 flex items-center justify-center text-3xl mb-3">рџљ«</div><span className="text-xs text-zinc-400 text-center leading-tight font-bold">Р‘РµР· СЂР°РјРєРё</span></button>{ALL_ITEMS.filter((i: any) => i.type === "frame" && (getCleanItems(profile?.owned_items).includes(i.id) || i.id === "f_wood")).map((f: any) => (<button key={f.id} onClick={() => { setProfile({...profile, frame: f.id}); saveProfile({ username: profile.username, frame: f.id }); }} className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-4 ${profile?.frame === f.id ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`} title={f.name}><ItemImage src={f.img} emoji={f.emoji} alt={f.name} className="w-16 h-16 object-contain" /><span className="text-xs text-zinc-400 mt-3 text-center leading-tight font-bold">{f.name}</span></button>))}</div>)}{profileTab === "titles" && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{TITLES.map((t: any) => { const isOwned = profile?.owned_titles?.includes(t.id) || (t.id === 'admin' && user.id === ADMIN_ID); if (!isOwned) return null; return (<button key={t.id} onClick={() => saveProfile({ username: profile.username, title: t.name })} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${profile?.title === t.name ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30"}`}><TitleBadge titleName={t.name} /><div className="text-[10px] text-zinc-500 uppercase tracking-widest">{(t as any).type}</div></button>); })}{(!profile?.owned_titles || profile?.owned_titles.length === 0) && user.id !== ADMIN_ID && (<div className="text-zinc-500 col-span-full">РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ С‚РёС‚СѓР»РѕРІ</div>)}</div>)}{profileTab === "items" && (<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{ALL_ITEMS.filter((i: any) => i.type !== "frame" && getCleanItems(profile?.owned_items).includes(i.id)).map((item: any) => { const count = getItemCount(profile?.owned_items, item.id); const locked = isItemLocked(profile?.owned_items, item.id); return (<div key={item.id} className={`relative border rounded-2xl p-4 flex flex-col items-center gap-2 transition-all ${locked ? 'border-red-500/50 bg-black/60 opacity-60 grayscale-[0.5]' : 'border-white/10 bg-black/40 hover:border-white/30'}`}><div className="absolute top-2 right-2 bg-purple-500 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-lg">x{count}</div><ItemImage src={item.img} emoji={item.emoji} alt={item.name} className="w-20 h-20 object-contain" /><div className="font-bold text-sm text-center">{item.name}</div><div className="text-[10px] text-zinc-400 text-center">{item.bonus}</div>{item.type === "boost" && <div className="text-[10px] text-yellow-400 text-center mb-1">РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ В«РњРѕРµР№ СЃР±РѕСЂРєРµВ»</div>}<div className="w-full flex gap-1.5 mt-2"><button onClick={() => !locked && sellItem(item.id)} disabled={locked} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${locked ? 'bg-white/5 border-white/5 text-zinc-600 cursor-not-allowed' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_10px_rgba(239,68,68,0.4)]'}`}><span>РџСЂРѕРґР°С‚СЊ</span><span className="text-[9px] opacity-70">50 рџЄ™</span></button><button onClick={() => { if (!locked) setSellModalItem({ itemId: item.id, price: "100" }); }} disabled={locked} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${locked ? 'bg-white/5 border-white/5 text-zinc-600 cursor-not-allowed' : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:shadow-[0_0_10px_rgba(59,130,246,0.4)]'}`}><span>РќР° СЂС‹РЅРѕРє</span><span className="text-[9px] opacity-70">РўРѕСЂРі</span></button></div><button onClick={() => toggleLock(item.id)} className={`w-full mt-1.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1 ${locked ? 'bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'}`}>{locked ? "рџ”“ Р Р°Р·Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ" : "рџ”’ Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ"}</button></div>); })}{ALL_ITEMS.filter((i: any) => i.type !== "frame" && getCleanItems(profile?.owned_items).includes(i.id)).length === 0 && <div className="text-zinc-500 col-span-full text-center py-10">РџРѕРєР° РЅРµС‚ РїСЂРµРґРјРµС‚РѕРІ. РљСЂСѓС‚РёС‚Рµ Р“Р°С‡Сѓ!</div>}</div>)}</div></div></div></div>)}

        {view === "admin" && user?.id === ADMIN_ID && (<div className="flex-1 overflow-y-auto p-4 md:p-8"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"><h2 className="text-3xl font-black text-red-500 drop-shadow-lg">РђРґРјРёРЅ-РїР°РЅРµР»СЊ</h2><input type="text" placeholder="РџРѕРёСЃРє РёРіСЂРѕРєР°..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-red-500 text-white w-full md:w-auto" /></div><div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{adminUsers.filter((u: any) => u.username?.toLowerCase().includes(adminSearch.toLowerCase())).map((u: any) => (<div key={u.id} className="bg-[#121214] p-6 rounded-3xl border border-white/10 flex flex-col gap-4"><div className="flex items-center gap-3"><AvatarWithFrame url={u.avatar_url} frame={u.frame} size="w-12 h-12" /><div><div className="font-bold text-lg text-white">{u.username || 'Р‘РµР· РёРјРµРЅРё'}</div><div className="text-xs text-zinc-400">ID: {u.id.slice(0, 8)}...</div><div className="text-xs text-zinc-400">Р РѕР»СЊ: <span className="text-green-400 font-bold">{u.role || 'user'}</span></div></div></div><div className="border-t border-white/10 pt-3"><label className="text-sm text-zinc-400 mb-2 block">РќР°Р·РЅР°С‡РёС‚СЊ СЂРѕР»СЊ</label><select value={u.role || 'user'} onChange={(e) => updateRole(u.id, e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white"><option value="user">РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ</option><option value="moderator">РњРѕРґРµСЂР°С‚РѕСЂ</option><option value="admin">РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ</option></select></div><div className="border-t border-white/10 pt-3 flex-1"><label className="text-sm text-zinc-400 mb-2 block">РўРёС‚СѓР»С‹</label><div className="flex flex-wrap gap-2">{TITLES.map((t: any) => { const hasTitle = u.owned_titles?.includes(t.id); return (<button key={t.id} onClick={() => toggleTitle(u.id, t.id)} className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${hasTitle ? "bg-green-500/20 border-green-500/30 text-green-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/30"}`} title={hasTitle ? "Р—Р°Р±СЂР°С‚СЊ" : "Р’С‹РґР°С‚СЊ"}>{t.name}</button>); })}</div></div></div>))}</div></div>)}
      </main>

      <div className={`fixed inset-y-0 right-0 w-full md:w-[28rem] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[60] transform transition-transform duration-300 ease-out flex flex-col ${isPackOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center"><h2 className="text-2xl font-black text-white">РњРѕСЏ СЃР±РѕСЂРєР°</h2><button onClick={() => setIsPackOpen(false)} className="bg-white/10 hover:bg-white/20 border border-white/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-white">вњ•</button></div>
        <div className="p-4 border-b border-white/10 shrink-0"><input type="text" placeholder="РџРѕРёСЃРє РїРѕ СЃР±РѕСЂРєРµ..." value={packSearch} onChange={(e) => setPackSearch(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" /></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">{filteredPackMods.map((mod: any) => (<div key={mod.project_id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden relative border border-white/10"><Image src={mod.icon_url || '/placeholder.png'} alt={mod.title} fill className="object-cover" unoptimized /></div><span className="text-sm font-bold truncate text-white">{mod.title}</span></div><button onClick={() => removeArtifact(mod.project_id)} className="text-red-500 hover:text-red-400 p-2">вњ•</button></div>))}{filteredPackMods.length === 0 && <div className="text-center text-zinc-400 mt-10">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>}</div>
        <div className="p-4 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <button onClick={() => downloadModpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.4)]">{isDownloading ? "РЎРєР°С‡РёРІР°РЅРёРµ..." : "РЎРєР°С‡Р°С‚СЊ .zip"}</button>
          <button onClick={() => exportMrpack(activePack)} disabled={isDownloading || modsList.length === 0} className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">{isDownloading ? "..." : "Р­РєСЃРїРѕСЂС‚ РІ .mrpack"}</button>
          <button onClick={() => setIsPublishModalOpen(true)} disabled={modsList.length === 0 || !user} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">{activePack?.published_id ? "РћР±РЅРѕРІРёС‚СЊ РІ РєР°С‚Р°Р»РѕРіРµ" : "РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ РІ РєР°С‚Р°Р»РѕРіРµ"}</button>
          {activePack?.published_id && <button onClick={useBoost} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold transition-colors">рџљЂ Р‘СѓСЃС‚Р°РЅСѓС‚СЊ РІ VIP (VIP-Р‘РёР»РµС‚)</button>}
        </div>
      </div>

      {viewingPack && (<div className="fixed inset-0 bg-[#09090b] z-[70] overflow-y-auto w-full h-full flex flex-col animate-in fade-in duration-200"><div className="w-full h-[40vh] min-h-[300px] relative shrink-0">{viewingPack.cover_url ? <Image src={viewingPack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-8xl opacity-10 bg-zinc-900">рџ–јпёЏ</div>}<div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent"></div><button onClick={() => setViewingPack(null)} className="absolute top-8 right-8 text-white bg-black/50 hover:bg-black/80 w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md z-10">вњ•</button><div className="absolute bottom-10 left-4 md:left-10 max-w-4xl"><h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">{viewingPack.name}</h1><div className="flex flex-wrap items-center gap-4 text-zinc-300"><div onClick={() => openUserProfile(viewingPack.user_id)} className="flex items-center gap-2 bg-black/40 hover:bg-black/60 cursor-pointer px-4 py-2 rounded-xl backdrop-blur-md transition-colors"><AvatarWithFrame url={viewingPack.profiles?.avatar_url} frame={viewingPack.profiles?.frame} size="w-8 h-8" /><span className="font-bold text-sm text-white hover:underline">{viewingPack.profiles?.username || "РРіСЂРѕРє"}</span><TitleBadge titleName={viewingPack.profiles?.title || "РќРѕРІРёС‡РѕРє"} /></div><div className="bg-black/40 px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold">{viewingPack.game_version} вЂў {viewingPack.loader.toUpperCase()}</div></div></div></div><div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12"><div className="lg:col-span-2 space-y-12">{viewingPack.video_url && getYouTubeID(viewingPack.video_url) && (<div className="w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeID(viewingPack.video_url)}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>)}{viewingPack.screenshots && viewingPack.screenshots.length > 0 && (<div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">РЎРєСЂРёРЅС€РѕС‚С‹</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{viewingPack.screenshots.map((url, i) => (<div key={i} className="w-full aspect-video rounded-2xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-colors cursor-pointer" onClick={() => window.open(url, '_blank')}><Image src={url} alt="screenshot" fill className="object-contain" unoptimized /></div>))}</div></div>)}<div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">РћРїРёСЃР°РЅРёРµ</h3><div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-[#121214] p-6 md:p-8 rounded-3xl border border-white/5 shadow-xl leading-relaxed whitespace-pre-wrap">{viewingPack.description || "РђРІС‚РѕСЂ РїРѕРєР° РЅРµ РґРѕР±Р°РІРёР» РѕРїРёСЃР°РЅРёРµ."}</div></div><div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">РњРѕРґС‹ ({Object.keys(viewingPack.artifacts).length})</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.values(viewingPack.artifacts).map((mod: any) => (<div key={mod.project_id} className="flex items-center gap-3 bg-[#121214] p-3 rounded-2xl border border-white/5"><div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden relative border border-white/10 shrink-0">{mod.icon_url ? <Image src={mod.icon_url} alt="icon" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl">рџ§©</div>}</div><div className="min-w-0"><div className="text-sm font-bold truncate text-white">{mod.title}</div><div className="text-xs text-zinc-500 truncate">{mod.isLibrary ? "Р‘РёР±Р»РёРѕС‚РµРєР°" : "РњРѕРґ"}</div></div></div>))}</div></div><div><h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">РљРѕРјРјРµРЅС‚Р°СЂРёРё</h3>{user ? (<div className="flex gap-3 mb-6"><AvatarWithFrame url={profile?.avatar_url} frame={profile?.frame} size="w-10 h-10" /><div className="flex-1 flex gap-2"><input type="text" placeholder="РќР°РїРёСЃР°С‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && postComment()} className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 text-white" /><button onClick={postComment} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-bold transition-colors">РћС‚РїСЂР°РІРёС‚СЊ</button></div></div>) : (<div className="text-zinc-500 mb-6 bg-white/5 p-4 rounded-xl text-center">Р’РѕР№РґРёС‚Рµ, С‡С‚РѕР±С‹ РѕСЃС‚Р°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№</div>)}<div className="space-y-4">{comments.length === 0 && <div className="text-zinc-500 text-sm">РџРѕРєР° РЅРµС‚ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ.</div>}{comments.map((c: any) => (<div key={c.id} className="bg-[#121214] p-4 rounded-2xl border border-white/5 flex gap-3"><AvatarWithFrame url={c.profiles?.avatar_url} frame={c.profiles?.frame} size="w-8 h-8" /><div><div className="flex items-center gap-2 mb-1"><span className="font-bold text-sm text-green-400">{c.profiles?.username || "РРіСЂРѕРє"}</span><TitleBadge titleName={c.profiles?.title || "РќРѕРІРёС‡РѕРє"} /><span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.content}</p></div></div>))}</div></div></div><div className="space-y-6"><div className="bg-[#121214] p-6 rounded-3xl border border-white/10 shadow-xl sticky top-8"><div className="flex items-center justify-between mb-6"><div className="flex flex-col"><span className="text-3xl font-black text-green-400">{viewingPack.downloads || 0}</span><span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">РЎРєР°С‡РёРІР°РЅРёР№</span></div><button onClick={(e) => toggleLike(viewingPack.id, e)} className={`flex flex-col items-center gap-1 group transition-transform hover:scale-110 ${likedPacks.includes(viewingPack.id) ? "text-pink-500" : "text-zinc-400 hover:text-pink-400"}`}><span className="text-3xl">{likedPacks.includes(viewingPack.id) ? "вќ¤пёЏ" : "рџ¤Ќ"}</span><span className="text-xs font-bold">{viewingPack.likes || 0} Р»Р°Р№РєРѕРІ</span></button></div><div className={`mb-6 pb-6 border-b border-white/10 flex flex-col items-center gap-2 ${isOwnPack ? "opacity-50" : ""}`}><div className="text-sm text-zinc-400 font-bold uppercase tracking-widest">РћС†РµРЅРєР° СЃР±РѕСЂРєРё</div><div className="flex gap-1">{[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={(e) => !isOwnPack && setRating(viewingPack.id, star, e)} disabled={isOwnPack} className={`text-3xl transition-transform ${isOwnPack ? "cursor-not-allowed" : "hover:scale-125"} ${star <= (userRatings[viewingPack.id] || 0) ? "text-yellow-400" : "text-zinc-600 hover:text-yellow-400/50"}`}>в…</button>))}</div><div className="text-sm font-bold text-zinc-300 mt-1">{Number(viewingPack.rating || 0) > 0 ? `${Number(viewingPack.rating).toFixed(1)} / 5` : "РќРµС‚ РѕС†РµРЅРѕРє"}</div></div><button onClick={() => { importPack(viewingPack); }} className="w-full bg-green-500 hover:bg-green-400 text-black py-4 rounded-xl font-bold text-lg transition-colors shadow-[0_0_20px_rgba(34,197,94,0.4)] mb-3">РЎРєР°С‡Р°С‚СЊ СЃРµР±Рµ</button><button onClick={() => { downloadModpack(viewingPack); }} disabled={isDownloading} className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">{isDownloading ? "..." : "РЎРєР°С‡Р°С‚СЊ .zip"}</button><div className="mt-8 pt-6 border-t border-white/10 space-y-3 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Р—Р°РіСЂСѓР·С‡РёРє:</span><span className="font-bold text-white">{viewingPack.loader.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-zinc-500">Р’РµСЂСЃРёСЏ РёРіСЂС‹:</span><span className="font-bold text-white">{viewingPack.game_version}</span></div><div className="flex justify-between"><span className="text-zinc-500">РњРѕРґРѕРІ:</span><span className="font-bold text-white">{Object.keys(viewingPack.artifacts).length}</span></div></div></div></div></div></div>)}

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
            <button onClick={() => setSelectedMod(null)} className="text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0">вњ•</button>
        </div>

        <div className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
            <div className="flex border-b border-white/10 mb-8 gap-4 shrink-0">
                <button onClick={() => setActiveTab("description")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "description" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>РћРїРёСЃР°РЅРёРµ</button>
                <button onClick={() => setActiveTab("gallery")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "gallery" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Р“Р°Р»РµСЂРµСЏ</button>
                <button onClick={() => setActiveTab("files")} className={`pb-4 px-2 text-lg font-bold border-b-2 transition-colors ${activeTab === "files" ? "border-green-500 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Р¤Р°Р№Р»С‹</button>
            </div>

            {activeTab === "description" && (
                <div className="w-full">
                    {selectedMod.body ? (
                        <div className="prose prose-invert prose-base md:prose-lg max-w-none text-zinc-300 bg-[#121214] p-6 md:p-10 rounded-3xl border border-white/5 whitespace-pre-wrap">
                            {!translatedDesc ? <span className="text-green-500 animate-pulse text-xl">РџРµСЂРµРІРѕРґ РѕРїРёСЃР°РЅРёСЏ...</span> : <div dangerouslySetInnerHTML={{ __html: translatedDesc }} />}
                        </div>
                    ) : (
                        <div className="text-center text-zinc-500 py-20 text-xl">РћРїРёСЃР°РЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚</div>
                    )}
                </div>
            )}

            {activeTab === "gallery" && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedMod.gallery && selectedMod.gallery.length > 0 ? (
                        selectedMod.gallery.map((img, i) => (
                            <div key={i} className="w-full aspect-video rounded-3xl bg-black/50 relative overflow-hidden border border-white/10 hover:border-green-500/50 transition-all cursor-pointer shadow-xl" onClick={() => window.open(img.url, '_blank')}>
                                <Image src={img.url} alt={img.title || "Gallery image"} fill className="object-cover" unoptimized />
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-zinc-500 py-20 col-span-full text-xl">Р“Р°Р»РµСЂРµСЏ РїСѓСЃС‚Р°</div>
                    )}
                </div>
            )}

            {activeTab === "files" && (
                <div className="w-full max-w-3xl mx-auto space-y-6">
                    <h3 className="text-2xl font-bold text-white mb-6">Р”РѕСЃС‚СѓРїРЅС‹Рµ РІРµСЂСЃРёРё</h3>
                    {isModalLoading ? (
                        <div className="text-center text-green-500 py-10 text-xl">Р—Р°РіСЂСѓР·РєР°...</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {modVersions.map(v => (
                                <div key={v.id} className="bg-[#121214] p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                                    <div className="min-w-0 flex-1 w-full">
                                        <div className="font-bold text-lg text-white truncate">{v.name}</div>
                                        <div className="text-sm text-zinc-400 mt-2 truncate" title={v.game_versions.join(", ")}>Р—Р°РіСЂСѓР·С‡РёРє: {v.loaders.join(", ")} вЂў РРіСЂР°: {v.game_versions.slice(0, 5).join(", ")} {v.game_versions.length > 5 ? `Рё РµС‰Рµ ${v.game_versions.length - 5}...` : ''}</div>
                                    </div>
                                    <button onClick={() => handleAddMod(selectedMod, v)} disabled={isAdding === selectedMod.project_id || !!activePack?.artifacts[selectedMod.project_id]} className="bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-xl text-sm font-bold transition-all w-full md:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                        {isAdding === selectedMod.project_id ? "..." : activePack?.artifacts[selectedMod.project_id] ? "Р”РѕР±Р°РІР»РµРЅРѕ" : "Р”РѕР±Р°РІРёС‚СЊ РІ СЃР±РѕСЂРєСѓ"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div></div>)}

      {viewingUser && (<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[80] flex items-center justify-center p-2 md:p-4" onClick={() => setViewingUser(null)}><div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl p-6 md:p-10 relative" onClick={e => e.stopPropagation()}><button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors">вњ•</button><div className="flex flex-col md:flex-row items-center gap-6 mb-8 mt-4"><AvatarWithFrame url={viewingUser.avatar_url} frame={viewingUser.frame} size="w-32 h-32" /><div className="text-center md:text-left"><h2 className="text-3xl font-black text-white mb-2">{viewingUser.username}</h2><div className="flex items-center justify-center md:justify-start gap-3 mb-3"><TitleBadge titleName={viewingUser.title || "РќРѕРІРёС‡РѕРє"} size="lg" /><span className="text-xs text-zinc-400 uppercase tracking-widest">{viewingUser.role === 'admin' ? 'РђРґРјРёРЅ' : viewingUser.role === 'moderator' ? 'РњРѕРґРµСЂ' : 'РРіСЂРѕРє'}</span></div><p className="text-zinc-300 text-sm max-w-lg whitespace-pre-wrap">{viewingUser.bio || "Р­С‚РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РµС‰Рµ РЅРµ СЂР°СЃСЃРєР°Р·Р°Р» Рѕ СЃРµР±Рµ."}</p></div></div><div className="border-t border-white/10 pt-6"><h3 className="text-xl font-bold text-white mb-4">РЎР±РѕСЂРєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ({viewingUserPacks.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{viewingUserPacks.length === 0 && <div className="text-zinc-500 col-span-full">РЈ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕРєР° РЅРµС‚ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹С… СЃР±РѕСЂРѕРє.</div>}{viewingUserPacks.map(pack => (<div key={pack.id} onClick={() => { setViewingUser(null); setViewingPack(pack); }} className="bg-[#121214] border border-white/10 p-4 rounded-2xl hover:border-green-500/50 cursor-pointer transition-all flex items-center gap-4"><div className="w-16 h-16 rounded-xl bg-zinc-800 relative overflow-hidden shrink-0 border border-white/10">{pack.cover_url ? <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-xl opacity-20">рџ–јпёЏ</div>}</div><div className="min-w-0 flex-1"><div className="font-bold text-white truncate">{pack.name}</div><div className="text-xs text-zinc-400 mt-1">{pack.game_version} вЂў {pack.loader.toUpperCase()}</div><div className="text-xs text-green-400 mt-1">в¬‡ {pack.downloads || 0}</div></div></div>))}</div></div></div></div>)}

      {isGachaOpen && user && (<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-2 md:p-4" onClick={() => setIsGachaOpen(false)}><div className="bg-[#0c0c0e] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[92vh] overflow-y-auto p-4 md:p-8 relative" onClick={e => e.stopPropagation()}><button onClick={() => setIsGachaOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10">вњ•</button><h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">Р“Р°С‡Р°-РњР°С€РёРЅР°</h2><p className="text-zinc-400 mb-6">РњРѕРЅРµС‚С‹: <span className="text-yellow-400 font-bold">рџЄ™ {profile?.coins ?? 500}</span></p><div className="flex flex-wrap gap-2 mb-6">{(GACHA_BANNERS as any[]).map(b => (<button key={b.id} onClick={() => { setActiveBanner(b); setGachaAnim("idle"); setGachaResult(null); }} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeBanner.id === b.id ? `bg-gradient-to-r ${b.color} text-white border border-white/30` : "bg-white/5 text-zinc-300 hover:bg-white/10"}`}>{b.name}</button>))}</div><div className={`rounded-3xl p-6 md:p-8 mb-6 text-center bg-gradient-to-br ${activeBanner.color} border border-white/10 relative overflow-hidden`}>{activeBanner.bannerImg && <div className="absolute inset-0 opacity-60" style={{ backgroundImage: `url(${activeBanner.bannerImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>}<div className="absolute inset-0 bg-black/40"></div><div className="relative z-10"><h3 className="text-2xl font-black text-white mb-2 drop-shadow-md">{activeBanner.name}</h3><p className="text-zinc-200 text-sm mb-6 drop-shadow-md">{activeBanner.desc}</p><div className="h-40 flex items-center justify-center relative">{gachaAnim === "spinning" && (<div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/60"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-transparent to-transparent animate-pulse" />{[...Array(12)].map((_, i) => (<div key={i} className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full blur-[1px]" style={{ animation: `swirl 1.5s linear infinite`, animationDelay: `${i * 0.1}s`, left: '50%', top: '50%', transformOrigin: '0 0' }} />))}<div className="relative z-10 w-24 h-24 border-2 border-dashed border-purple-500 rounded-full animate-[spin_4s_linear_infinite] flex items-center justify-center"><div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-fuchsia-400 rounded-full blur-md animate-pulse" /></div><div className="absolute bottom-8 text-purple-300 font-black tracking-[0.3em] text-sm uppercase animate-pulse drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">РџСЂРёР·С‹РІ...</div></div>)}{gachaAnim === "result" && gachaResult && (<div className="flex flex-col items-center animate-in zoom-in duration-500"><div className="relative"><div className="absolute inset-0 bg-white blur-2xl opacity-50 rounded-full animate-pulse"></div><ItemImage src={gachaResult.img} emoji={gachaResult.emoji} alt={gachaResult.name} className="relative z-10 w-40 h-40 object-contain drop-shadow-[0_0_35px_rgba(255,255,255,0.8)] animate-float" /></div><div className="mt-2 font-black text-white text-lg drop-shadow-lg">{gachaResult.name} {gachaResult.count > 1 && <span className="text-purple-400 font-black text-xl ml-2">x{gachaResult.count}</span>}</div></div>)}{gachaAnim === "idle" && (<div className="text-white/60 text-sm font-bold drop-shadow-md">РќР°Р¶РјРё В«РљСЂСѓС‚РёС‚СЊВ», С‡С‚РѕР±С‹ РёСЃРїС‹С‚Р°С‚СЊ СѓРґР°С‡Сѓ</div>)}</div><div className="flex flex-col sm:flex-row gap-3 justify-center mt-6"><button onClick={() => pullGacha(true)} disabled={isPulling || !canFreePull} className="bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white px-6 py-3 rounded-xl font-bold transition-colors drop-shadow-md">{canFreePull ? "рџЋЃ Р‘РµСЃРїР»Р°С‚РЅРѕ (1/СЃСѓС‚РєРё)" : "Р‘РµСЃРїР»Р°С‚РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРѕ"}</button><button onClick={() => pullGacha(false)} disabled={isPulling || (profile?.coins || 0) < 100} className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black px-6 py-3 rounded-xl font-bold transition-colors shadow-[0_0_20px_rgba(250,204,21,0.4)]">РљСЂСѓС‚РёС‚СЊ Р·Р° 100 рџЄ™</button></div></div></div><div><h3 className="text-lg font-bold text-white mb-3">Р’РѕР·РјРѕР¶РЅС‹Рµ РїСЂРµРґРјРµС‚С‹</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{(activeBanner.pool as GachaItem[]).map(item => { const isOwned = getItemCount(profile?.owned_items, item.id) > 0; return (<div key={item.id} className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col items-center relative"><ItemImage src={item.img} emoji={item.emoji} alt={item.name} className="w-20 h-20 object-contain drop-shadow-md" silhouette={!isOwned && item.chance <= 5} /><div className="text-xs font-bold text-white mt-2 text-center">{!isOwned && item.chance <= 5 ? "???" : item.name}</div><div className="text-[10px] text-zinc-400 text-center mt-1">{item.chance}%</div></div>); })}</div></div></div></div>)}

      {isPublishModalOpen && (<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setIsPublishModalOpen(false)}><div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8" onClick={e => e.stopPropagation()}><h2 className="text-2xl font-black text-white mb-6">РџСѓР±Р»РёРєР°С†РёСЏ СЃР±РѕСЂРєРё</h2><div className="space-y-6"><div><label className="text-sm text-zinc-400 mb-2 block font-bold">РћР±Р»РѕР¶РєР°</label><div className="flex items-center gap-4"><div className="w-32 h-20 rounded-xl bg-zinc-800 relative overflow-hidden border border-white/10 shrink-0">{activePack?.cover_url ? <Image src={activePack.cover_url} alt="cover" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">рџ–јпёЏ</div>}</div><div className="flex-1"><input type="file" id="publish-cover-upload" accept="image/*" onChange={(e) => uploadCover(e, activePackId)} className="hidden" /><label htmlFor="publish-cover-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">Р—Р°РіСЂСѓР·РёС‚СЊ РѕР±Р»РѕР¶РєСѓ</label></div></div></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">РЎСЃС‹Р»РєР° РЅР° YouTube-РІРёРґРµРѕ</label><input type="text" placeholder="https://youtube.com/watch?v=..." value={activePack?.video_url || ""} onChange={(e) => updateActivePack({ video_url: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm" /></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">РћРїРёСЃР°РЅРёРµ</label><textarea placeholder="Р Р°СЃСЃРєР°Р¶РёС‚Рµ Рѕ СЃРІРѕРµР№ СЃР±РѕСЂРєРµ..." value={activePack?.description || ""} onChange={(e) => updateActivePack({ description: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 text-white text-sm h-32 resize-none" /></div><div><label className="text-sm text-zinc-400 mb-2 block font-bold">РЎРєСЂРёРЅС€РѕС‚С‹</label><div className="flex flex-wrap gap-2 mb-3">{activePack?.screenshots?.map((url, i) => (<div key={i} className="w-20 h-20 rounded-lg bg-black/50 relative overflow-hidden border border-white/10 group"><Image src={url} alt="screenshot" fill className="object-contain" unoptimized /><button onClick={() => { const newScreens = activePack.screenshots?.filter((_, idx) => idx !== i); updateActivePack({ screenshots: newScreens }); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">вњ•</button></div>))}</div><input type="file" id="publish-screenshot-upload" accept="image/*" onChange={(e) => uploadScreenshot(e, activePackId)} className="hidden" /><label htmlFor="publish-screenshot-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full text-center border border-white/20 block text-sm">+ Р”РѕР±Р°РІРёС‚СЊ СЃРєСЂРёРЅС€РѕС‚</label></div><div className="flex gap-3 pt-4"><button onClick={() => setIsPublishModalOpen(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">РћС‚РјРµРЅР°</button><button onClick={publishPack} className="flex-1 bg-green-500 hover:bg-green-400 text-black py-3 rounded-xl font-bold transition-colors">РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ</button></div></div></div></div>)}

      {sellModalItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSellModalItem(null)}>
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-xs p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
            <h2 className="text-lg font-black text-white mb-2">Р’С‹СЃС‚Р°РІРёС‚СЊ РЅР° СЂС‹РЅРѕРє</h2>
            <p className="text-xs text-zinc-400 mb-3">РЈРєР°Р¶РёС‚Рµ С†РµРЅСѓ РІ РјРѕРЅРµС‚Р°С…:</p>
            <div className="relative mb-4">
              <input autoFocus type="number" value={sellModalItem.price} onChange={(e) => setSellModalItem({ ...sellModalItem, price: e.target.value })} className="w-full bg-black/50 border border-white/20 rounded-xl pl-4 pr-10 py-2.5 text-white focus:outline-none focus:border-green-500 font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-400 text-lg">рџЄ™</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSellModalItem(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2.5 rounded-xl font-bold text-sm transition-colors">РћС‚РјРµРЅР°</button>
              <button onClick={() => { listItemOnMarket(sellModalItem.itemId, Number(sellModalItem.price)); setSellModalItem(null); }} className="flex-1 bg-green-500 hover:bg-green-400 text-black py-2.5 rounded-xl font-bold text-sm transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)]">Р’С‹СЃС‚Р°РІРёС‚СЊ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}