"use client";

import { useState } from "react";

export default function Shop({ user, processPayment }: { user: any, processPayment: (amount: number) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 drop-shadow-lg">Магазин</h2>
        <p className="text-zinc-400 mt-2">Услуги и товары для твоего профиля и сборок.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#121214] border border-yellow-500/30 p-8 rounded-3xl flex flex-col relative overflow-hidden group hover:border-yellow-500 transition-all shadow-2xl">
          <div className="absolute top-0 right-0 bg-yellow-500 text-black px-4 py-1.5 rounded-bl-2xl font-black text-xs tracking-wider">ХИТ ПРОДАЖ</div>
          
          <h3 className="text-2xl font-black text-white mb-2">VIP-Буст сборки</h3>
          <p className="text-sm text-zinc-400 flex-1 mb-8 leading-relaxed">
            Твоя сборка будет закреплена в самом верху каталога (VIP-Витрина) на 24 часа. Это даст максимальный приток скачиваний и лайков.
          </p>
          
          <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/10">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white">99 ₽</span>
              <span className="text-xs text-zinc-500">за 24 часа</span>
            </div>
            <button onClick={() => processPayment(99)} className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(250,204,21,0.3)]">
              Купить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}