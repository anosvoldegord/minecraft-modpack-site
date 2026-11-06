export default function Footer() {
  return (
    <footer className="w-full bg-black/80 backdrop-blur-md border-t border-white/10 py-4 px-6 flex flex-wrap justify-center items-center gap-6 text-xs text-zinc-500 z-50 relative">
      <span className="font-bold text-zinc-400">© 2026 ModBuilder</span>
      <a href="/docs/offer" className="hover:text-green-400 transition-colors">Публичная оферта</a>
      <a href="/docs/privacy" className="hover:text-green-400 transition-colors">Политика конфиденциальности</a>
      <a href="/docs/how-it-works" className="hover:text-green-400 transition-colors">Как это работает</a>
      <a href="/requisites" className="hover:text-green-400 transition-colors">Реквизиты</a>
    </footer>
  );
}