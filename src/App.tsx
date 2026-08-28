import { EcosystemDiagram } from './components/EcosystemDiagram';
import { Hero } from './components/Hero';
import { OrchestrationFlow } from './components/OrchestrationFlow';
import { PilotContact } from './components/PilotContact';
import { Roadmap } from './components/Roadmap';
import { InstitutionalModels } from './components/InstitutionalModels';
import { ScenarioStories } from './components/ScenarioStories';
import { SafetyLayers } from './components/SafetyLayers';
import { SettlementNetwork } from './components/SettlementNetwork';
import { SiteFooter } from './components/SiteFooter';
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
        <ScenarioStories stories={homeKo.scenarios} />
        <InstitutionalModels models={homeKo.institutions} />
        <SafetyLayers layers={homeKo.safety} boundaries={homeKo.safetyBoundaries} />
        <EcosystemDiagram layers={homeKo.ecosystem} />
        <SettlementNetwork settlement={homeKo.settlement} />
        <Roadmap phases={homeKo.roadmap} />
        <PilotContact contact={homeKo.contact} whitepaperUrl={homeKo.contact.whitepaperHref} />
      </main>
      <SiteFooter
        wordmarkUrl={homeKo.assets.wordmarkUrl}
        whitepaperUrl={homeKo.assets.whitepaperUrl}
        photoManifestUrl={homeKo.assets.photoManifestUrl}
      />
    </>
  );
}
