import { Hero } from './components/Hero';
import { OrchestrationFlow } from './components/OrchestrationFlow';
import { SiteHeader } from './components/SiteHeader';
import { homeKo } from './content/home.ko';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <SiteHeader navigation={homeKo.navigation} wordmarkUrl={homeKo.assets.wordmarkUrl} />
      <main id="main-content">
        <Hero content={homeKo.hero} />
        <OrchestrationFlow steps={homeKo.lifecycle} protections={homeKo.protections} />
      </main>
    </>
  );
}
