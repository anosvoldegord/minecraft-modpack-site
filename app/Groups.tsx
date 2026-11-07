"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "./supabase";

type Group = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  avatar_url: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string };
  subscribers_count?: number;
  is_subscribed?: boolean;
};

type Announcement = {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  video_url: string;
  created_at: string;
};

export default function Groups({ user, profile }: { user: any, profile: any }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annDesc, setAnnDesc] = useState("");
  const [annVideo, setAnnVideo] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    const { data: allGroups } = await supabase.from("groups").select("*, profiles(username, avatar_url)").order("created_at", { ascending: false });
    if (allGroups) {
      const { data: subs } = await supabase.from("group_subscriptions").select("*");
      
      const mappedGroups = allGroups.map((g: any) => {
        const groupSubs = subs?.filter((s: any) => s.group_id === g.id) || [];
        const isSub = user ? groupSubs.some((s: any) => s.user_id === user.id) : false;
        
        return {
          ...g,
          subscribers_count: groupSubs.length,
          is_subscribed: isSub
        };
      });
      setGroups(mappedGroups);

      if (user) {
        setMyGroups(mappedGroups.filter((g: any) => g.owner_id === user.id || g.is_subscribed));
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    setIsUploading(true);
    let avatarUrl = "";
    
    if (newGroupAvatar) {
      const file = avatarInputRef.current?.files?.[0];
      if (file) {
        const fileName = `group-${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('avatars').upload(fileName, file);
        if (!error) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        }
      }
    }

    const { error } = await supabase.from("groups").insert({
      owner_id: user.id,
      name: newGroupName.trim(),
      description: newGroupDesc.trim(),
      avatar_url: avatarUrl
    });

    if (error) {
      alert("Ошибка при создании: " + error.message);
      setIsUploading(false);
      return;
    }

    setNewGroupName("");
    setNewGroupDesc("");
    setNewGroupAvatar(null);
    setIsCreating(false);
    setIsUploading(false);
    
    // Принудительно перезагружаем страницу, чтобы группа точно появилась
    window.location.reload();
  };

  const toggleSubscription = async (groupId: string, isSubbed: boolean) => {
    if (!user) return;
    if (isSubbed) {
      await supabase.from("group_subscriptions").delete().eq("group_id", groupId).eq("user_id", user.id);
    } else {
      await supabase.from("group_subscriptions").insert({ group_id: groupId, user_id: user.id });
    }
    fetchGroups();
  };

  const openGroup = async (group: Group) => {
    setSelectedGroup(group);
    const { data } = await supabase.from("group_announcements").select("*").eq("group_id", group.id).order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  const handleCreateAnnouncement = async () => {
    if (!selectedGroup || !annTitle.trim()) return;
    setIsUploadingVideo(true);
    let videoUrl = "";

    const file = videoInputRef.current?.files?.[0];
    if (file) {
      const fileName = `ann-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('announcement_videos').upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from('announcement_videos').getPublicUrl(fileName);
        videoUrl = data.publicUrl;
      }
    }

    await supabase.from("group_announcements").insert({
      group_id: selectedGroup.id,
      title: annTitle.trim(),
      description: annDesc.trim(),
      video_url: videoUrl
    });

    setAnnTitle("");
    setAnnDesc("");
    setAnnVideo(null);
    setIsCreatingAnn(false);
    setIsUploadingVideo(false);
    
    const { data } = await supabase.from("group_announcements").select("*").eq("group_id", selectedGroup.id).order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-lg">
            Гейм Студии
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Создавайте группы, публикуйте анонсы и собирайте подписчиков.</p>
        </div>
        {user && (
          <button onClick={() => setIsCreating(true)} className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            + Создать группу
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-white/10 mb-6 pb-2">
        <button onClick={() => setActiveTab("all")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${activeTab === "all" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Все группы</button>
        {user && <button onClick={() => setActiveTab("my")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${activeTab === "my" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Мои подписки</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {(activeTab === "all" ? groups : myGroups).map(group => (
          <div key={group.id} className="bg-[#121214]/80 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col shadow-xl text-white relative group overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all hover:-translate-y-1" onClick={() => openGroup(group)}>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800 relative overflow-hidden border border-white/10 shrink-0">
                  {group.avatar_url ? <Image src={group.avatar_url} alt="avatar" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-2xl">👥</div>}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{group.name}</h3>
                  <div className="text-xs text-zinc-400">Автор: {group.profiles?.username || "Игрок"}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-2">{group.description || "Без описания"}</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                <div className="text-xs text-zinc-400">
                  <span className="text-purple-400 font-bold">{group.subscribers_count}</span> подписчиков
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleSubscription(group.id, !!group.is_subscribed); }} 
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${group.is_subscribed ? "bg-white/10 hover:bg-white/20 text-zinc-300" : "bg-purple-500 hover:bg-purple-400 text-white"}`}
                >
                  {group.is_subscribed ? "Отписаться" : "Подписаться"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setIsCreating(false)}>
          <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-md p-6 md:p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white mb-6">Создать Гейм Студию</h2>
            <div className="space-y-4">
              <div className="flex justify-center">
                <label className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 hover:border-purple-500 flex items-center justify-center cursor-pointer relative overflow-hidden group">
                  {newGroupAvatar ? <Image src={newGroupAvatar} alt="preview" fill className="object-cover" unoptimized /> : <span className="text-3xl text-zinc-500 group-hover:text-purple-500">+</span>}
                  <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(file) setNewGroupAvatar(URL.createObjectURL(file)); }} />
                </label>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Название</label>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white" placeholder="Например: Крутые Мододелы" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Описание</label>
                <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white h-24 resize-none" placeholder="О чем ваша студия?" />
              </div>
              <button onClick={handleCreateGroup} disabled={isUploading || !newGroupName.trim()} className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 mt-4">
                {isUploading ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 bg-[#09090b] z-[90] overflow-y-auto w-full h-full flex flex-col animate-in fade-in duration-200">
          <div className="w-full h-64 relative shrink-0 bg-gradient-to-r from-purple-900 to-indigo-900">
             <div className="absolute inset-0 bg-black/40"></div>
             <button onClick={() => setSelectedGroup(null)} className="absolute top-6 right-6 text-white bg-black/50 hover:bg-black/80 w-10 h-10 rounded-full flex items-center justify-center transition-colors backdrop-blur-md z-10">✕</button>
             <div className="absolute bottom-6 left-6 md:left-10 flex items-end gap-6">
                <div className="w-32 h-32 rounded-full bg-zinc-800 relative overflow-hidden border-4 border-[#09090b] shadow-2xl shrink-0">
                  {selectedGroup.avatar_url ? <Image src={selectedGroup.avatar_url} alt="avatar" fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-4xl">👥</div>}
                </div>
                <div className="mb-2">
                  <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl">{selectedGroup.name}</h1>
                  <p className="text-zinc-300 text-sm md:text-base mt-2 max-w-2xl">{selectedGroup.description}</p>
                </div>
             </div>
          </div>
          
          <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-10 flex-1">
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-bold text-white">Анонсы и Новости</h2>
              {(user?.id === selectedGroup.owner_id) && (
                <button onClick={() => setIsCreatingAnn(true)} className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl font-bold transition-colors text-sm">+ Создать анонс</button>
              )}
            </div>

            {isCreatingAnn && (
              <div className="bg-[#121214] border border-white/10 p-6 rounded-3xl mb-8 space-y-4">
                <h3 className="text-lg font-bold text-white">Новый анонс</h3>
                <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white" placeholder="Заголовок (Наша сборка вышла!)" />
                <textarea value={annDesc} onChange={e => setAnnDesc(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white h-24 resize-none" placeholder="Описание сборки..." />
                
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Видео-обзор (MP4)</label>
                  <input type="file" accept="video/mp4" ref={videoInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(file) setAnnVideo(file.name); }} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400" />
                  {annVideo && <div className="text-xs text-green-400 mt-2">Выбрано: {annVideo}</div>}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setIsCreatingAnn(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">Отмена</button>
                  <button onClick={handleCreateAnnouncement} disabled={isUploadingVideo || !annTitle.trim()} className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">{isUploadingVideo ? "Загрузка..." : "Опубликовать"}</button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-[#121214] border border-white/10 p-6 rounded-3xl flex flex-col gap-4">
                  <h3 className="text-2xl font-bold text-white">{ann.title}</h3>
                  <p className="text-zinc-300 whitespace-pre-wrap">{ann.description}</p>
                  {ann.video_url && (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black mt-2">
                      <video src={ann.video_url} controls className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="text-xs text-zinc-500 mt-2 border-t border-white/5 pt-4">{new Date(ann.created_at).toLocaleString()}</div>
                </div>
              ))}
              {announcements.length === 0 && <div className="text-zinc-500 text-center py-10">В этой группе пока нет анонсов.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}