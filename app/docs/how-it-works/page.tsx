export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-[#121214] border border-white/10 p-10 rounded-3xl shadow-2xl">
        <h1 className="text-4xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Как работает ModBuilder</h1>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="bg-black/50 p-6 rounded-2xl border border-white/5">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-lg mb-2 text-white">1. Выбирайте</h3>
            <p className="text-sm text-zinc-400">Ищите моды из базы Modrinth через наш удобный каталог.</p>
          </div>
          <div className="bg-black/50 p-6 rounded-2xl border border-white/5">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="font-bold text-lg mb-2 text-white">2. Собирайте</h3>
            <p className="text-sm text-zinc-400">Добавляйте моды в свою сборку в один клик. Библиотеки подтягиваются сами.</p>
          </div>
          <div className="bg-black/50 p-6 rounded-2xl border border-white/5">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="font-bold text-lg mb-2 text-white">3. Играйте</h3>
            <p className="text-sm text-zinc-400">Скачивайте готовый .zip или .mrpack и запускайте игру!</p>
          </div>
        </div>
        <div className="mt-10 text-center">
          <a href="/" className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-8 rounded-xl transition-colors">Попробовать сейчас</a>
        </div>
      </div>
    </div>
  );
}