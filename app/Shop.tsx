"use client";

import { useState } from "react";

export default function Shop({ user, processPayment }: { user: any, processPayment: (amount: number) => void }) {
  const [activeTab, setActiveTab] = useState<"boosts" | "frames" | "titles">("boosts");

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 drop-shadow-lg">Магазин</h2>
        <p className="text-zinc-400 mt-2">Услуги и товары для твоего профиля и сборок.</p>
      </div>

      <div className="flex gap-2 border-b border-white/10 mb-6 pb-2">
        <button onClick={() => setActiveTab("boosts")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${activeTab === "boosts" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Бусты</button>
        <button onClick={() => setActiveTab("frames")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${activeTab === "frames" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Рамки</button>
        <button onClick={() => setActiveTab("titles")} className={`px-4 py-2 rounded-xl font-bold transition-colors ${activeTab === "titles" ? "bg-white/20 text-white" : "text-zinc-400 hover:text-white"}`}>Титулы</button>
      </div>

      {activeTab === "boosts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#121214] border border-yellow-500/30 p-6 rounded-3xl flex flex-col relative overflow-hidden group hover:border-yellow-500 transition-all">
            <div className="absolute top-0 right-0 bg-yellow-500 text-black px-3 py-1 rounded-bl-xl font-bold text-xs">ХИТ</div>
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-white mb-2">VIP-Буст сборки</h3>
            <p className="text-sm text-zinc-400 flex-1 mb-6">Твоя сборка будет висеть в самом верху каталога (VIP-Витрина) на 24 часа. Максимальный приток скачиваний.</p>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
              <span className="text-2xl font-black text-white">99 ₽</span>
              <button onClick={() => processPayment(99)} className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-xl font-bold transition-colors">Купить</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "frames" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#121214] border border-white/10 p-6 rounded-3xl flex flex-col hover:border-cyan-500/50 transition-all">
            <div className="w-20 h-20 rounded-full border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] mx-auto mb-4 flex items-center justify-center text-3xl">👨‍🚀</div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Космический Шлем</h3>
            <p className="text-sm text-zinc-400 text-center flex-1 mb-6">Эксклюзивная рамка для аватарки.</p>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
              <span className="text-xl font-bold text-white">199 ₽</span>
              <button onClick={() => processPayment(199)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-colors">Купить</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "titles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#121214] border border-white/10 p-6 rounded-3xl flex flex-col hover:border-purple-500/50 transition-all">
            <div className="text-center mb-4">
              <span className="inline-flex items-center px-4 py-1.5 rounded-lg font-black uppercase tracking-wider bg-gradient-to-b from-purple-500 to-purple-900 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)] text-white text-sm">Легенда</span>
            </div>
            <p className="text-sm text-zinc-400 text-center flex-1 mb-6">Уникальный титул, который будет виден всем в чате и профиле.</p>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
              <span className="text-xl font-bold text-white">299 ₽</span>
              <button onClick={() => processPayment(299)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-colors">Купить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}