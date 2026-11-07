"use client";

import { useState } from "react";
import Image from "next/image";

export default function Catalog({ 
  catalog, user, profile, likedPacks, userRatings, 
  toggleLike, setRating, openUserProfile, 
  deleteFromCatalog, setViewingPack, importPack, downloadModpack 
}: any) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogVersion, setCatalogVersion] = useState("all");
  const [catalogLoader, setCatalogLoader] = useState("all");
  const [catalogSort, setCatalogSort] = useState("newest");
  const [catalogPage, setCatalogPage] = useState(1);

  const CATALOG_PER_PAGE = 9;
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
  else if (catalogSort === "popularity") filteredCatalog.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));

  const totalPages = Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE);
  const paginated = filteredCatalog.slice((catalogPage - 1) * CATALOG_PER_PAGE, catalogPage * CATALOG_PER_PAGE);

  const formatTimeLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Истекло";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}ч ${m}м`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-lg">Каталог сборок</h2>
      
      <div className="flex flex-wrap gap-4 mb-8 bg-black/40 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
        <input type="text" placeholder="Поиск..." value={catalogSearch} onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 text-white flex-1 min-w-[200px]" />
        <select value={catalogVersion} onChange={(e) => { setCatalogVersion(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white"><option value="all">Все версии</option><option value="1.20.1">1.20.1</option><option value="1.16.5">1.16.5</option></select>
        <select value={catalogLoader} onChange={(e) => { setCatalogLoader(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white"><option value="all">Все</option><option value="forge">Forge</option><option value="fabric">Fabric</option></select>
        <select value={catalogSort} onChange={(e) => { setCatalogSort(e.target.value); setCatalogPage(1); }} className="bg-black/30 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white"><option value="newest">Новые</option><option value="downloads">Скачивания</option><option value="popularity">Популярные</option></select>
      </div>

      {vipPacks.length > 0 && (
        <div className="mb-10">
          <h3 className="text-xl font-bold text-yellow-400 mb-4">⭐ VIP-Витрина</h3>
          <div className="flex overflow-x-auto gap-6 pb-4">
            {vipPacks.map((pack: any, index: number) => (
              <div key={pack.id} onClick={() => setViewingPack(pack)} className="shrink-0 w-80 bg-[#121214]/90 border border-yellow-500/40 rounded-3xl overflow-hidden cursor-pointer">
                <div className="w-full h-40 relative">{pack.cover_url && <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized />}</div>
                <div className="p-5"><h3 className="text-xl font-bold text-white">{pack.name}</h3><div className="text-green-400 font-bold mt-2">⬇ {pack.downloads || 0}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {paginated.map((pack: any) => (
          <div key={pack.id} onClick={() => setViewingPack(pack)} className="bg-[#121214]/80 border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-green-500/50 transition-all">
            <div className="w-full h-48 relative">{pack.cover_url && <Image src={pack.cover_url} alt="cover" fill className="object-cover" unoptimized />}</div>
            <div className="p-5 flex flex-col gap-2">
              <h3 className="text-xl font-bold text-white">{pack.name}</h3>
              <div className="text-sm text-zinc-400">{pack.game_version} • {pack.loader.toUpperCase()}</div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                <span className="text-green-400 font-bold">⬇ {pack.downloads || 0}</span>
                {pack.price > 0 ? (
                  <button onClick={(e) => { e.stopPropagation(); alert("Тут будет оплата через ЮKassa"); }} className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold">Купить за {pack.price} ₽</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); importPack(pack); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold">Скачать</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage === 1} className="bg-white/10 px-4 py-2 rounded-xl text-white disabled:opacity-30">← Назад</button>
          <span className="text-white py-2">Стр. {catalogPage} из {totalPages}</span>
          <button onClick={() => setCatalogPage(p => Math.min(totalPages, p + 1))} disabled={catalogPage === totalPages} className="bg-white/10 px-4 py-2 rounded-xl text-white disabled:opacity-30">Вперед →</button>
        </div>
      )}
    </div>
  );
}