import { useState } from 'react';
import { PanelHeader } from '@/components/Panel';
import { Badge } from '@/components/Badge';
import { StatusDot } from '@/components/StatusDot';
import { Settings, Database, Globe, Shield, Bell, Check, Save } from 'lucide-react';
import { getApiBase, setApiBase, getHealth } from '@/lib/api';

interface SettingsProps {
  online: boolean;
}

export function SettingsPage({ online }: SettingsProps) {
  const [apiUrl, setApiUrl] = useState(getApiBase());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSaveUrl = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      setApiBase(apiUrl);
      const health = await getHealth();
      setSaveSuccess(true);
      setTestResult(`Connected! Backend version active. Tracking ${health.vessel_count || 0} vessels.`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e: any) {
      setTestResult(`Saved, but health check failed: ${e.message}. Verify backend is running.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl">
        <div className="glass-panel overflow-hidden">
          <PanelHeader title="System Settings" right={<Settings size={14} className="text-muted" />} />
          <div className="p-6 space-y-6">
            {/* API Status & Config */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-[#00D4FF]" />
                <span className="section-label">Backend API Configuration</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-[rgba(0,212,255,0.04)] border border-cyan-dim/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">Backend Endpoint URL</span>
                    <div className="flex items-center gap-2">
                      <StatusDot color={online ? '#00FF88' : '#FFA500'} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: online ? '#00FF88' : '#FFA500' }}
                      >
                        {online ? 'CONNECTED' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8001"
                      className="flex-1 px-3 py-1.5 rounded-md bg-[rgba(10,22,40,0.8)] border border-cyan-dim text-xs text-white focus:border-[#00D4FF] outline-none"
                    />
                    <button
                      onClick={handleSaveUrl}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-black text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                      {saving ? 'Testing...' : 'Save & Connect'}
                    </button>
                  </div>
                  {testResult && (
                    <div className="text-[0.6875rem] text-[#00D4FF] pt-1">{testResult}</div>
                  )}
                  <div className="text-[0.625rem] text-muted">
                    Tip: Default local backend URL is <code className="text-white">http://127.0.0.1:8001</code>.
                  </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                  <div>
                    <div className="text-sm text-white">Health Polling</div>
                    <div className="text-[0.625rem] text-muted">Every 30 seconds</div>
                  </div>
                  <Badge color="cyan">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                  <div>
                    <div className="text-sm text-white">Data Refresh</div>
                    <div className="text-[0.625rem] text-muted">Vessel data every 60 seconds</div>
                  </div>
                  <Badge color="cyan">ACTIVE</Badge>
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database size={14} className="text-[#00D4FF]" />
                <span className="section-label">Data Sources & ML Models</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Custom AIS Ingestion Engine', desc: 'CSV & JSON vessel trajectory parser', status: 'ACTIVE' },
                  { name: 'Isolation Forest Anomaly Model', desc: 'Kinematic & behavioral risk detection', status: 'ACTIVE' },
                  { name: 'Sentinel-1 SAR U-Net', desc: 'Oil slick segmentation pipeline', status: 'ACTIVE' },
                  { name: 'Hydrodynamic Drift Simulator', desc: 'Fay spreading & wind/current vectors', status: 'ACTIVE' },
                ].map((src) => (
                  <div key={src.name} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                    <div>
                      <div className="text-sm text-white">{src.name}</div>
                      <div className="text-[0.625rem] text-muted">{src.desc}</div>
                    </div>
                    <Badge color="success">{src.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-[#00D4FF]" />
                <span className="section-label">Security</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                  <div className="text-sm text-white">Local API & CORS Policy</div>
                  <Badge color="success">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                  <div className="text-sm text-white">Request Timeout</div>
                  <span className="metric-value text-xs text-white">20s</span>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-[#00D4FF]" />
                <span className="section-label">Notifications</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Anomaly Detection', desc: 'Alert when vessel anomaly detected', enabled: true },
                  { name: 'Prime Suspect Update', desc: 'Alert when attribution score changes', enabled: true },
                  { name: 'Backend Offline', desc: 'Alert when API connection lost', enabled: true },
                ].map((n) => (
                  <div key={n.name} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[rgba(0,212,255,0.04)]">
                    <div>
                      <div className="text-sm text-white">{n.name}</div>
                      <div className="text-[0.625rem] text-muted">{n.desc}</div>
                    </div>
                    <div
                      className={`w-9 h-5 rounded-full relative transition-colors ${
                        n.enabled ? 'bg-[#00D4FF]/30' : 'bg-[rgba(136,153,170,0.15)]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                          n.enabled ? 'left-4 bg-[#00D4FF]' : 'left-0.5 bg-muted'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
