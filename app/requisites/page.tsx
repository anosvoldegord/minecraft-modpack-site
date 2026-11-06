export default function Requisites() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
      <div className="bg-[#121214] border border-white/10 p-8 rounded-3xl max-w-2xl w-full shadow-2xl">
        <h1 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">Реквизиты и контакты</h1>
        
        <div className="space-y-4 text-zinc-300">
          <p className="text-lg">
            Сайт <strong className="text-white">ModBuilder</strong> является платформой для сборки и публикации модов для Minecraft.
          </p>
          
          <div className="bg-black/50 p-6 rounded-2xl border border-white/10 space-y-3 mt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="text-zinc-500 w-32">Статус:</span>
              <span className="font-bold text-white">Плательщик налога на профессиональный доход (Самозанятый)</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="text-zinc-500 w-32">ИНН:</span>
              <span className="font-bold text-white text-xl">543405462054</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="text-zinc-500 w-32">Email:</span>
              <span className="font-bold text-white">anosvoldegord6@gmail.com</span>
            </div>
          </div>
          
          <p className="text-sm text-zinc-500 mt-8">
            По всем вопросам, связанным с работой платформы, оплатой или сотрудничеством, вы можете обратиться по указанному выше email. Ответ обычно занимает до 24 часов.
          </p>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/10">
          <a href="/" className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-6 rounded-xl transition-colors">
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
}