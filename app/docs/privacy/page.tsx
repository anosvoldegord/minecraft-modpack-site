export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8">
      <div className="max-w-4xl mx-auto bg-[#121214] border border-white/10 p-8 rounded-3xl">
        <h1 className="text-3xl font-black mb-6 text-green-400">Политика конфиденциальности</h1>
        <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
          <p>Мы уважаем вашу приватность и собираем только те данные, которые необходимы для работы сайта.</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">1. Какие данные мы собираем</h2>
          <p>1.1. Email (при авторизации через Google/GitHub).</p>
          <p>1.2. Никнейм, аватар и статистику сборок.</p>
          <p>1.3. История сообщений в чате (хранится на серверах Supabase).</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">2. Как мы используем данные</h2>
          <p>2.1. Для отображения вашего профиля и сборок.</p>
          <p>2.2. Для обработки платежей (передача данных в ЮKassa).</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">3. Защита данных</h2>
          <p>3.1. Мы не передаем ваши данные третьим лицам, кроме платежных систем (ЮKassa) для проведения оплаты.</p>
          <a href="/" className="inline-block mt-8 text-green-400 hover:underline">← Вернуться на главную</a>
        </div>
      </div>
    </div>
  );
}