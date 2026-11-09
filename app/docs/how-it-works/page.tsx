import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-12 flex justify-center items-center">
      <div className="max-w-6xl w-full bg-[#121214] border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl">
        <h1 className="text-3xl md:text-5xl font-black text-center text-green-500 mb-12">Как работает ModBuilder</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-black/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">1. Выбирайте</h3>
            <p className="text-sm text-zinc-400">Ищите моды из базы Modrinth через наш удобный каталог.</p>
          </div>

          <div className="bg-black/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold mb-2">2. Собирайте</h3>
            <p className="text-sm text-zinc-400">Добавляйте моды в свою сборку в один клик. Библиотеки подтягиваются сами.</p>
          </div>

          <div className="bg-black/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center text-center hover:border-white/20 transition-colors">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">3. Играйте</h3>
            <p className="text-sm text-zinc-400">Скачивайте готовый .zip или .mrpack и запускайте игру!</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl flex flex-col items-center text-center hover:border-green-500/50 transition-colors">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2 text-green-400">4. Зарабатывайте</h3>
            <p className="text-sm text-zinc-300">Станьте автором! Подключите выплаты, и деньги с каждой продажи вашей сборки будут автоматически поступать на вашу карту.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/" className="bg-green-500 hover:bg-green-400 text-black px-8 py-4 rounded-xl font-bold transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)] inline-block">
            Попробовать сейчас
          </Link>
        </div>
      </div>
    </div>
  );
}