import { Header } from "@/components/header";
import { HeroFinder } from "@/components/hero-finder";
import { CampusContent } from "@/components/campus-content";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroFinder />
        <CampusContent />
      </main>
    </>
  );
}
