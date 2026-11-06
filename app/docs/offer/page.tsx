export default function Offer() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8">
      <div className="max-w-4xl mx-auto bg-[#121214] border border-white/10 p-8 rounded-3xl">
        <h1 className="text-3xl font-black mb-6 text-green-400">Публичная оферта</h1>
        <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
          <p>Настоящий документ является официальным предложением (публичной офертой) о заключении договора на использование платформы ModBuilder.</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">1. Термины</h2>
          <p>1.1. Платформа — сайт ModBuilder, предназначенный для сборки модов Minecraft.</p>
          <p>1.2. Пользователь — любое лицо, использующее Платформу.</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">2. Предмет договора</h2>
          <p>2.1. Платформа предоставляет возможность создавать сборки модов, публиковать их и скачивать.</p>
          <p>2.2. Оплата услуг (например, VIP-размещение или платные сборки) производится через платежный сервис ЮKassa.</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">3. Оплата и возврат</h2>
          <p>3.1. Все платежи проводятся в российских рублях.</p>
          <p>3.2. Возврат средств возможен только в случае технической ошибки Платформы. Цифровые товары (сборки) возврату не подлежат после скачивания.</p>
          <h2 className="text-xl font-bold text-white mt-6 mb-2">4. Ответственность</h2>
          <p>4.1. Платформа не несёт ответственности за контент, загруженный пользователями (моды, сборки).</p>
          <p>4.2. Пользователь обязуется не загружать вредоносное ПО и не нарушать авторские права.</p>
          <a href="/" className="inline-block mt-8 text-green-400 hover:underline">← Вернуться на главную</a>
        </div>
      </div>
    </div>
  );
}