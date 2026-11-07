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
  subscribers_count?: number;
  is_subscribed?: boolean;
  subscription_status?: string;
  role?: string;
};

type Announcement = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  created_at: string;
};

type GroupMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string; title: string };
};

const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🤩", "😎", "😭", "😡", "👍", "👎", "🔥", "💯", "❤️", "💔", "🎉", "💩", "👻", "💀", "🤖", "👾", "🎮", "🕹️", "💻"];

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
  const [groupTab, setGroupTab] = useState<"announcements" | "chat" | "staff" | "requests">("announcements");
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annDesc, setAnnDesc] = useState("");
  const [annVideo, setAnnVideo] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [requests, setRequests] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // Состояния для чата (смайлы, файлы, гифки)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<"emojis" | "gifs">("emojis");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [myGifs, setMyGifs] = useState<any[]>([]);

  useEffect(() => { fetchGroups(); fetchMyGifs(); }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      setIsOwner(selectedGroup.owner_id === user?.id);
      setIsMember(selectedGroup.role === 'member' || selectedGroup.owner_id === user?.id);
      fetchAnnouncements(selectedGroup.id);
      if (selectedGroup.owner_id === user?.id) fetchRequests(selectedGroup.id);
      
      if (groupTab === "chat" || groupTab === "staff") {
        fetchMessages(selectedGroup.id);
        const interval = setInterval(() => fetchMessages(selectedGroup.id), 3000);
        return () => clearInterval(interval);
      }
    }
  }, [selectedGroup, groupTab, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchMyGifs = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_gifs').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setMyGifs(data);
  };

  const fetchGroups = async () => {
    const { data: allGroups } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    if (allGroups) {
      const { data: subs } = await supabase.from("group_subscriptions").select("*");
      const mapped = allGroups.map((g: any) => {
        const mySub = subs?.find((s: any) => s.group_id === g.id && s.user_id === user?.id);
        return { 
          ...g, 
          subscribers_count: subs?.filter((s:any) => s.group_id === g.id).length || 0,
          is_subscribed: !!mySub,
          subscription_status: mySub?.status,
          role: mySub?.role
        };
      });
      setGroups(mapped);
      if (user) setMyGroups(mapped.filter((g: any) => g.owner_id === user.id || g.is_subscribed));
    }
  };

  const fetchAnnouncements = async (gId: string) => {
    const { data } = await supabase.from("group_announcements").select("*").eq("group_id", gId).order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  const fetchMessages = async (gId: string) => {
    const { data } = await supabase.from("group_messages").select("*, profiles(username, avatar_url, title)").eq("group_id", gId).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const fetchRequests = async (gId: string) => {
    const { data } = await supabase.from("group_subscriptions").select("*, profiles(*)").eq("group_id", gId).eq("status", "pending");
    if (data) setRequests(data);
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
    const { error } = await supabase.from("groups").insert({ owner_id: user.id, name: newGroupName.trim(), description: newGroupDesc.trim(), avatar_url: avatarUrl });
    if (error) { alert("Ошибка: " + error.message); setIsUploading(false); return; }
    setIsCreating(false); setIsUploading(false);
    window.location.reload();
  };

  const deleteGroup = async (gId: string) => {
    if (!confirm("Вы уверены, что хотите УДАЛИТЬ группу? Это действие необратимо.")) return;
    const { error } = await supabase.from("groups").delete().eq("id", gId);
    if (error) alert("Ошибка удаления: " + error.message);
    else { alert("Группа удалена!"); window.location.reload(); }
  };

  const handleSubscribe = async (g: Group) => {
    if (!user) return alert("Войдите в аккаунт!");
    if (g.owner_id === user.id) return;
    if (g.is_subscribed) {
      await supabase.from("group_subscriptions").delete().eq("group_id", g.id).eq("user_id", user.id);
      fetchGroups();
    } else {
      await supabase.from("group_subscriptions").insert({ group_id: g.id, user_id: user.id, status: "approved", role: "subscriber" });
      fetchGroups();
    }
  };

  const requestMembership = async () => {
    if (!user || !selectedGroup) return;
    const { error } = await supabase.from("group_subscriptions").upsert({ group_id: selectedGroup.id, user_id: user.id, status: "pending", role: "subscriber" }, { onConflict: 'group_id,user_id' });
    if (error) alert("Ошибка заявки: " + error.message);
    else {
      alert("Заявка в участники отправлена!");
      fetchGroups();
      setSelectedGroup({ ...selectedGroup, subscription_status: "pending" });
    }
  };

  const handleRequest = async (reqId: string, userId: string, approve: boolean) => {
    if (approve) await supabase.from("group_subscriptions").update({ status: "approved", role: "member" }).eq("id", reqId);
    else await supabase.from("group_subscriptions").delete().eq("id", reqId);
    if (selectedGroup) fetchRequests(selectedGroup.id);
    fetchGroups();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAttachedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const sendMessage = async (gifUrl?: string) => {
    if (!newMsg.trim() && !attachedFile && !gifUrl) return;
    if (!user || !selectedGroup) return;
    
    setIsSendingFile(true);
    let fileUrl = null;

    if (attachedFile) {
      const fileExt = attachedFile.name.split('.').pop();
      const fileName = `chat-${user.id}-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('chat_files').upload(fileName, attachedFile);
      if (!error) {
        const { data } = supabase.storage.from('chat_files').getPublicUrl(fileName);
        fileUrl = data.publicUrl;
      } else {
        alert("Ошибка загрузки файла"); setIsSendingFile(false); return;
      }
    }

    const content = gifUrl || fileUrl || newMsg.trim();
    setNewMsg(""); setAttachedFile(null); setPreviewUrl(null); setShowEmojiPicker(false);

    const { error } = await supabase.from("group_messages").insert({ group_id: selectedGroup.id, user_id: user.id, content });
    if (error) {
      console.error("Ошибка отправки:", error);
      alert("Не удалось отправить: " + error.message);
      setIsSendingFile(false);
      return;
    }
    fetchMessages(selectedGroup.id);
    setIsSendingFile(false);
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
    await supabase.from("group_announcements").insert({ group_id: selectedGroup.id, title: annTitle.trim(), description: annDesc.trim(), video_url: videoUrl });
    setAnnTitle(""); setAnnDesc(""); setAnnVideo(null); setIsCreatingAnn(false); setIsUploadingVideo(false);
    fetchAnnouncements(selectedGroup.id);
  };

  const isImageUrl = (text: string) => /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(text) || text.includes('tenor.com') || text.includes('giphy.com');

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
      {!selectedGroup && (
        <>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Гейм Студии</h2>
            {user && <button onClick={() => setIsCreating(true)} className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 rounded-2xl font-bold shadow-lg">+ Создать</button>}
          </div>
          <div className="flex gap-2 border-b border-white/10 mb-6 pb-2">
            <button onClick={() => setActiveTab("all")} className={`px-4 py-2 rounded-xl font-bold ${activeTab === "all" ? "bg-white/20 text-white" : "text-zinc-400"}`}>Все</button>
            {user && <button onClick={() => setActiveTab("my")} className={`px-4 py-2 rounded-xl font-bold ${activeTab === "my" ? "bg-white/20 text-white" : "text-zinc-400"}`}>Мои</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(activeTab === "all" ? groups : myGroups).map(group => (
              <div key={group.id} onClick={() => { setSelectedGroup(group); setGroupTab("announcements"); }} className="bg-[#121214] border border-white/10 p-6 rounded-3xl cursor-pointer hover:border-purple-500/50 transition-all">
                <div className="flex gap-4 items-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 relative overflow-hidden">{group.avatar_url && <Image src={group.avatar_url} alt="av" fill className="object-cover" unoptimized />}</div>
                  <div><h3 className="text-lg font-bold text-white">{group.name}</h3><div className="text-xs text-zinc-400">{group.subscribers_count} подписчиков</div></div>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2">{group.description || "Нет описания"}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {isCreating && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0c0c0e] p-8 rounded-3xl w-full max-w-md border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">Создать Группу</h2>
            <div className="flex justify-center mb-6">
              <label className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 hover:border-purple-500 flex items-center justify-center cursor-pointer relative overflow-hidden group transition-colors">
                {newGroupAvatar ? <Image src={newGroupAvatar} alt="preview" fill className="object-cover" unoptimized /> : <span className="text-3xl text-zinc-500 group-hover:text-purple-500">+</span>}
                <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(file) setNewGroupAvatar(URL.createObjectURL(file)); }} />
              </label>
            </div>
            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-purple-500" placeholder="Название" />
            <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white mb-4 h-24 focus:outline-none focus:border-purple-500 resize-none" placeholder="Описание" />
            <div className="flex gap-2">
              <button onClick={() => setIsCreating(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-colors">Отмена</button>
              <button onClick={handleCreateGroup} className="flex-1 bg-purple-500 hover:bg-purple-400 text-white py-3 rounded-xl font-bold transition-colors">Создать</button>
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="flex flex-col w-full">
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-6 md:p-10 mb-6 border border-white/10 relative">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              {isOwner && <button onClick={() => deleteGroup(selectedGroup.id)} className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">Удалить</button>}
              <button onClick={() => setSelectedGroup(null)} className="bg-black/50 hover:bg-black/80 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">← Назад</button>
            </div>
            
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mt-8 md:mt-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-zinc-800 relative overflow-hidden shrink-0 border-4 border-black/50">
                {selectedGroup.avatar_url && <Image src={selectedGroup.avatar_url} alt="av" fill className="object-cover" unoptimized />}
              </div>
              <div className="text-center md:text-left flex-1 min-w-0">
                <h1 className="text-2xl md:text-5xl font-black text-white truncate">{selectedGroup.name}</h1>
                <p className="text-zinc-300 mt-2 text-sm md:text-base line-clamp-2">{selectedGroup.description}</p>
              </div>
              
              {!isOwner && (
                <div className="flex flex-col gap-2 shrink-0 md:mb-1 w-full md:w-auto">
                  <button onClick={() => handleSubscribe(selectedGroup)} className={`px-6 py-3 rounded-xl font-bold transition-colors ${selectedGroup.is_subscribed ? "bg-white/10 text-white" : "bg-green-500 hover:bg-green-400 text-black"}`}>
                    {selectedGroup.is_subscribed ? "Отписаться" : "Подписаться"}
                  </button>
                  {!isMember && selectedGroup.subscription_status !== "pending" && (
                    <button onClick={requestMembership} className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors">Подать заявку в разрабы</button>
                  )}
                  {selectedGroup.subscription_status === "pending" && (
                    <div className="text-center text-xs text-yellow-400 font-bold bg-black/30 p-2 rounded-lg">Заявка на рассмотрении</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 mb-6 pb-2">
            <button onClick={() => setGroupTab("announcements")} className={`px-4 py-2 rounded-xl font-bold ${groupTab === "announcements" ? "bg-white/20 text-white" : "text-zinc-400"}`}>Анонсы</button>
            <button onClick={() => setGroupTab("chat")} className={`px-4 py-2 rounded-xl font-bold ${groupTab === "chat" ? "bg-white/20 text-white" : "text-zinc-400"}`}>Общий чат</button>
            {isMember && <button onClick={() => setGroupTab("staff")} className={`px-4 py-2 rounded-xl font-bold ${groupTab === "staff" ? "bg-red-500/20 text-red-400" : "text-zinc-400"}`}>Штаб (Разрабы)</button>}
            {isOwner && <button onClick={() => setGroupTab("requests")} className={`px-4 py-2 rounded-xl font-bold ${groupTab === "requests" ? "bg-white/20 text-white" : "text-zinc-400"}`}>Заявки ({requests.length})</button>}
          </div>

          {groupTab === "announcements" && (
            <div>
              {isOwner && <button onClick={() => setIsCreatingAnn(true)} className="bg-purple-500 text-white px-4 py-2 rounded-xl font-bold mb-4">+ Создать анонс</button>}
              {isCreatingAnn && (
                <div className="bg-[#121214] p-6 rounded-3xl mb-6 space-y-4 border border-white/10">
                  <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Заголовок" className="w-full bg-black/50 border border-white/20 p-3 rounded-xl text-white outline-none" />
                  <textarea value={annDesc} onChange={e => setAnnDesc(e.target.value)} placeholder="Описание" className="w-full bg-black/50 border border-white/20 p-3 rounded-xl text-white h-24 outline-none" />
                  <input type="file" ref={videoInputRef} accept="video/mp4" onChange={(e) => setAnnVideo(e.target.files?.[0]?.name || null)} className="text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-purple-500 file:text-white" />
                  <div className="flex gap-2">
                    <button onClick={() => setIsCreatingAnn(false)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors">Отмена</button>
                    <button onClick={handleCreateAnnouncement} disabled={isUploadingVideo} className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-bold transition-colors disabled:opacity-50">{isUploadingVideo ? "Загрузка..." : "Опубликовать"}</button>
                  </div>
                </div>
              )}
              {announcements.map(ann => (
                <div key={ann.id} className="bg-[#121214] border border-white/10 p-6 rounded-3xl mb-4">
                  <h3 className="text-xl font-bold text-white">{ann.title}</h3>
                  <p className="text-zinc-300 mt-2">{ann.description}</p>
                  {ann.video_url && <video src={ann.video_url} controls className="w-full max-w-2xl rounded-xl mt-4 border border-white/10" />}
                </div>
              ))}
            </div>
          )}

          {groupTab === "requests" && isOwner && (
             <div className="space-y-4">
               {requests.length === 0 && <div className="text-zinc-500">Нет активных заявок.</div>}
               {requests.map(req => (
                 <div key={req.id} className="bg-[#121214] p-4 rounded-2xl flex items-center justify-between border border-white/10">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-zinc-800 relative overflow-hidden">{req.profiles?.avatar_url && <Image src={req.profiles.avatar_url} alt="av" fill className="object-cover" unoptimized />}</div>
                     <span className="text-white font-bold">{req.profiles?.username || "Игрок"}</span>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => handleRequest(req.id, req.user_id, true)} className="bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg font-bold text-sm transition-colors">Принять</button>
                     <button onClick={() => handleRequest(req.id, req.user_id, false)} className="bg-red-500 hover:bg-red-400 text-white px-3 py-1 rounded-lg font-bold text-sm transition-colors">Отклонить</button>
                   </div>
                 </div>
               ))}
             </div>
          )}

          {(groupTab === "chat" || groupTab === "staff") && (
            <div className="bg-black/20 border border-white/10 rounded-3xl h-[65vh] flex flex-col overflow-hidden relative">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(m => (
                  <div key={m.id} className="flex gap-2 items-start">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 relative overflow-hidden shrink-0 mt-1">
                      {m.profiles?.avatar_url && <Image src={m.profiles.avatar_url} alt="av" fill className="object-cover" unoptimized />}
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none max-w-[80%]">
                      <div className="text-xs text-purple-400 font-bold mb-1">{m.profiles?.username || "Игрок"}</div>
                      {isImageUrl(m.content) ? (
                        <img src={m.content} alt="attachment" className="max-h-60 w-auto object-contain rounded-lg mt-1 cursor-pointer" />
                      ) : (
                        <div className="text-white text-sm whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              {previewUrl && (
                <div className="px-4 pb-2">
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-green-500 group">
                    <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setAttachedFile(null); setPreviewUrl(null); }} className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-100 transition-opacity">✕</button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-black/40 border-t border-white/10 flex gap-2 items-center relative">
                {showEmojiPicker && (
                  <div className="absolute bottom-full mb-2 left-0 bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-72 animate-in slide-in-from-bottom-2">
                    <div className="flex gap-2 mb-3 border-b border-white/10 pb-2">
                      <button onClick={() => setEmojiTab("emojis")} className={`text-sm font-bold ${emojiTab === "emojis" ? "text-green-400" : "text-zinc-400"}`}>Эмодзи</button>
                      <button onClick={() => setEmojiTab("gifs")} className={`text-sm font-bold ${emojiTab === "gifs" ? "text-green-400" : "text-zinc-400"}`}>Гифки</button>
                    </div>
                    {emojiTab === "emojis" ? (
                      <div className="grid grid-cols-6 gap-2">{EMOJIS.map(e => (<button key={e} onClick={() => setNewMsg(prev => prev + e)} className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</button>))}</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                        {myGifs.map(gif => (
                          <div key={gif.id} onClick={() => sendMessage(gif.url)} className="cursor-pointer hover:opacity-80 rounded-lg overflow-hidden border border-white/10 h-16 relative group">
                            <img src={gif.url} alt="gif" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors shrink-0">😊</button>
                <button onClick={() => fileInputRef.current?.click()} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors shrink-0">📎</button>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                
                <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Написать..." className="flex-1 bg-black/50 border border-white/20 p-3 rounded-xl text-white outline-none" />
                <button onClick={() => sendMessage()} disabled={isSendingFile || (!newMsg.trim() && !attachedFile)} className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shrink-0">{isSendingFile ? "..." : "Отправить"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}