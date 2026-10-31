import { useState, useCallback } from 'react';
import { CommandBar } from '@/components/CommandBar';
import { Sidebar, type PageId } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { VesselIntelligence } from '@/pages/VesselIntelligence';
import { ScenarioBuilder } from '@/pages/ScenarioBuilder';
import { Evidence } from '@/pages/Evidence';
import { FuturePrediction } from '@/pages/FuturePrediction';
import { SpillDetection } from '@/pages/SpillDetection';
import { FleetBuilder } from '@/pages/FleetBuilder';
import { Landing } from '@/pages/Landing';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Vessel } from '@/lib/api';

function App() {
  const [inLanding, setInLanding] = useState(false);
  const [page, setPage] = useState<PageId>('dashboard');
  const {
    online,
    health,
    vessels,
    totalVessels,
    anomalyCount,
    primeSuspect,
    spillDetection,
    marineStatus,
    windStatus,
    events,
    refresh,
  } = useDashboardData();

  const handleNavigate = useCallback((p: string) => {
    setPage(p as PageId);
  }, []);

  const handleInvestigate = useCallback(() => {
    refresh();
    setPage('dashboard');
  }, [refresh]);

  const handleVesselClick = useCallback((v: Vessel) => {
    setPage('vessels');
  }, []);

  if (inLanding) {
    return (
      <Landing
        onEnter={(targetPage?: string) => {
          if (targetPage) {
            setPage(targetPage as PageId);
          }
          setInLanding(false);
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      <CommandBar
        online={online}
        totalVessels={totalVessels}
        sarAvailable={health?.sar_available === true}
        unetLoaded={health?.unet === true}
        activePage={page}
        onNavigate={setPage}
        onInvestigate={handleInvestigate}
        onOpenLanding={() => setInLanding(true)}
      />
      <Sidebar
        active={page}
        onNavigate={setPage}
        anomalyCount={anomalyCount}
      />
      <main className="flex-1 ml-52 mt-14 overflow-hidden">
        <ErrorBoundary fallbackTitle={`Recovered view: ${page}`}>
          <div key={page} className="h-full animate-fade-in">
            {page === 'dashboard' && (
              <Dashboard
                vessels={vessels}
                totalVessels={totalVessels}
                anomalyCount={anomalyCount}
                primeSuspect={primeSuspect}
                spillDetection={spillDetection}
                marineStatus={marineStatus}
                windStatus={windStatus}
                events={events}
                online={online}
                health={health}
                onVesselClick={handleVesselClick}
                onRunSim={() => {}}
                onNavigate={handleNavigate}
              />
            )}
            {page === 'fleet-builder' && (
              <FleetBuilder
                vessels={vessels}
                onRefresh={refresh}
                onNavigateToDashboard={() => setPage('dashboard')}
              />
            )}
            {page === 'spill-detection' && <SpillDetection />}
            {page === 'vessels' && (
              <VesselIntelligence
                vessels={vessels}
                primeSuspect={primeSuspect}
                onRefresh={refresh}
              />
            )}
            {page === 'scenario-builder' && <ScenarioBuilder />}
            {page === 'evidence' && <Evidence />}
            {page === 'prediction' && <FuturePrediction />}
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
