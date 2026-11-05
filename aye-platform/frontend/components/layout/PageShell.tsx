import { Navbar, MobileTabBar } from "./Navbar";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 pb-24 md:pb-8 pt-6 relative z-10">
        {children}
      </main>
      <MobileTabBar />
    </>
  );
}
