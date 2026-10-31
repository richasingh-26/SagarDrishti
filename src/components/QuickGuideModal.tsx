import { useState } from 'react';
import {
  X,
  Satellite,
  Ship,
  Search,
  TrendingUp,
  AlertTriangle,
  Compass,
  Waves,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { PageId } from './Sidebar';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

export function QuickGuideModal({ isOpen, onClose, onNavigate }: QuickGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'workflow' | 'glossary' | 'faq'>('workflow');

  if (!isOpen) return null;

  const steps = [
    {
      step: '01',
      title: 'Satellite Radar Detection',
      tag: 'WHAT HAPPENED?',
      color: '#5FE38A',
      icon: Satellite,
      pageId: 'spill-detection' as PageId,
      pageLabel: 'Go to SAR AI Analysis',
      summary:
        'The Copernicus Sentinel-1 satellite flies over the ocean and uses radar to see through clouds and darkness.',
      details:
        'Because oil smooths out small ocean capillary waves, it reflects less radar back, appearing as a distinct dark patch. Our U-Net++ AI automatically detects and measures the spill (3.2 km² in this incident).',
    },
    {
      step: '02',
      title: 'Fleet Tracking (10,000+ Ships)',
      tag: 'WHO WAS THERE?',
      color: '#5BC0BE',
      icon: Ship,
      pageId: 'vessels' as PageId,
      pageLabel: 'Go to AIS Fleet Track',
      summary:
        'Every commercial ship broadcasts its GPS coordinates, speed, and heading over AIS radio signals.',
      details:
        'SagarDrishti tracks over 10,000 commercial vessels in real-time. Machine learning algorithms flag abnormal behaviors, such as a ship slowing down drastically or making sharp course changes near the spill.',
    },
    {
      step: '03',
      title: 'AI Forensic Attribution',
      tag: 'WHO CAUSED IT?',
      color: '#F59E0B',
      icon: Search,
      pageId: 'evidence' as PageId,
      pageLabel: 'Go to Evidence Dossier',
      summary:
        'By backtracking ocean currents from the spill to its starting location, AI identifies the guilty ship.',
      details:
        'In this incident, the tanker "MTT SENARI" is identified as the prime suspect (68% attribution score) after an unexplained speed drop and route deviation in the origin zone during dumping hours.',
    },
    {
      step: '04',
      title: 'Spill Forecast & Drift',
      tag: 'WHERE IS IT GOING?',
      color: '#A855F7',
      icon: TrendingUp,
      pageId: 'prediction' as PageId,
      pageLabel: 'Go to Spill Forecast',
      summary:
        'Physics-based ocean simulations predict where the oil slick will float over the next 48 hours.',
      details:
        'Using ECMWF surface currents and wind vectors, the system projects trajectory and potential coastal impact zones so port authorities can place containment booms before oil reaches land.',
    },
  ];

  const glossaryTerms = [
    {
      term: 'SAR (Synthetic Aperture Radar)',
      simple: 'Satellite Radar Imaging',
      explanation:
        'A radar sensor that shoots microwaves from space to take high-resolution sea surface images, day or night, and through thick storm clouds.',
    },
    {
      term: 'AIS (Automatic Identification System)',
      simple: 'Ship GPS Transponder',
      explanation:
        'A worldwide radio tracking system where ships broadcast their identity, position, course, and speed to satellite and shore stations.',
    },
    {
      term: 'TSS (Traffic Separation Scheme)',
      simple: 'Ocean Highway Lane',
      explanation:
        'Regulated maritime sea lanes (like in the Singapore Strait) that separate incoming and outgoing ship traffic to prevent collisions.',
    },
    {
      term: 'Kinematic Anomaly',
      simple: 'Suspicious Ship Movement',
      explanation:
        'When a ship behaves unusually—such as suddenly cutting engine power, drifting off course, or turning off beacons—frequently associated with illegal bilge dumping.',
    },
    {
      term: 'Damping Index (-22.4 dB)',
      simple: 'Wave Flattening Level',
      explanation:
        'Measures how heavily the oil layer has flattened the sea waves. A reading below -20 dB strongly confirms heavy crude hydrocarbons rather than clean water.',
    },
    {
      term: 'Attribution Score (68%)',
      simple: 'Guilt Probability',
      explanation:
        'The statistical likelihood computed by AI that a specific ship was the source of the oil spill, based on distance, trajectory, and timing.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#070D14] border border-white/[0.15] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-white/[0.1] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5FE38A]/10 border border-[#5FE38A]/30 flex items-center justify-center text-[#5FE38A]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>How SagarDrishti Works</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#5FE38A]/15 text-[#5FE38A] border border-[#5FE38A]/30 uppercase">
                  30-Second Guide
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Understand maritime oil spill intelligence without needing a technical degree
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.08] transition-colors"
            title="Close Guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-2.5 bg-black/40 border-b border-white/[0.08] flex items-center gap-2">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'workflow'
                ? 'bg-[#5FE38A] text-[#060B10] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Compass size={13} />
            <span>The 4-Step Process</span>
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'glossary'
                ? 'bg-[#5FE38A] text-[#060B10] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <BookOpen size={13} />
            <span>Plain-English Glossary</span>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'faq'
                ? 'bg-[#5FE38A] text-[#060B10] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Info size={13} />
            <span>Quick FAQ</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#5FE38A]/10 border border-[#5FE38A]/25 text-xs text-[#CBD5E1] flex items-start gap-2.5">
                <Info size={16} className="text-[#5FE38A] mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">Quick Summary:</strong> SagarDrishti solves an urgent real-world problem: ships illegally dump oil at night in open water to avoid port cleaning fees. We use <strong>satellites + ship tracking + AI</strong> to catch them and forecast where the oil will drift.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {steps.map((st) => {
                  const Icon = st.icon;
                  return (
                    <div
                      key={st.step}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.18] transition-all flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${st.color}18`,
                              color: st.color,
                              border: `1px solid ${st.color}40`,
                            }}
                          >
                            STEP {st.step} • {st.tag}
                          </span>
                          <Icon size={18} style={{ color: st.color }} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">{st.title}</h3>
                        <p className="text-xs text-[#94A3B8] leading-relaxed mb-2">
                          {st.summary}
                        </p>
                        <p className="text-[11px] text-[#CBD5E1] leading-normal bg-black/30 p-2.5 rounded-lg border border-white/[0.04]">
                          {st.details}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onNavigate(st.pageId);
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]"
                      >
                        <span>{st.pageLabel}</span>
                        <ArrowRight size={13} style={{ color: st.color }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'glossary' && (
            <div className="space-y-3">
              <p className="text-xs text-[#94A3B8]">
                Here is a simple cheat sheet translating technical maritime terms into plain language:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {glossaryTerms.map((g) => (
                  <div
                    key={g.term}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{g.term}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#5FE38A]/10 text-[#5FE38A] border border-[#5FE38A]/20">
                        {g.simple}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{g.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#5FE38A]" />
                  <span>How accurate is the prime suspect attribution?</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  The prime suspect (tanker MTT SENARI) is matched with an attribution score of 68%. This combines reverse drift backtracking, anomalous speed drops in the origin zone, and historic route records.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#5FE38A]" />
                  <span>Can I export reports for maritime law enforcement?</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Yes! Head to the <strong>SAR AI Analysis</strong> tab. Click "Analyze with Gemma 4 Vision" and then "Download Official Report (PDF)" to get a complete official dossier ready for port authority inspection.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#5FE38A]" />
                  <span>How do I test my own scenarios?</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Go to <strong>Custom Ship Studio</strong> to add or simulate new ships, and <strong>Drift Simulator</strong> or <strong>Spill Forecast</strong> to tweak wind speeds and tidal current vectors.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.1] bg-black/40 flex items-center justify-between">
          <div className="text-[11px] text-[#64748B]">
            Press ESC or click outside to dismiss guide at any time
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#5FE38A] text-[#060B10] hover:bg-[#5FE38A]/90 transition-all cursor-pointer shadow-lg"
          >
            Got it, Let's Explore!
          </button>
        </div>
      </div>
    </div>
  );
}
