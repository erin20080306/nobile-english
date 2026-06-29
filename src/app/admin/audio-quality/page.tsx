import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface AudioAsset {
  id: string;
  languageCode: string;
  normalizedText: string;
  audioFormat: string;
  audioPath: string | null;
  processedAudioPath: string | null;
  audioVersionString: string;
  integratedLufs: number | null;
  truePeakDbtp: number | null;
  loudnessRangeLu: number | null;
  processingStatus: string;
  status: string;
  durationMs: number | null;
}

export default function AdminAudioQualityPage() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AudioAsset | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "v1" | "v2_loud">("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await fetch("/api/admin/audio/quality-report");
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to fetch audio assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (filter !== "all" && asset.audioVersionString !== filter) return false;
    if (languageFilter !== "all" && asset.languageCode !== languageFilter) return false;
    return true;
  });

  const playAudio = (asset: AudioAsset, useProcessed: boolean = true) => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    const audioUrl = useProcessed && asset.processedAudioPath
      ? asset.processedAudioPath
      : asset.audioPath;

    if (!audioUrl) return;

    const newAudio = new Audio(audioUrl);
    newAudio.volume = 1.0;
    newAudio.muted = false;

    newAudio.onplay = () => setPlaying(true);
    newAudio.onended = () => setPlaying(false);
    newAudio.onerror = () => setPlaying(false);

    newAudio.play();
    setAudio(newAudio);
    setSelectedAsset(asset);
  };

  const stopAudio = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
    }
  };

  const reprocessAsset = async (assetId: string) => {
    try {
      const response = await fetch("/api/admin/audio/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });

      if (response.ok) {
        await fetchAssets();
      }
    } catch (error) {
      console.error("Failed to reprocess asset:", error);
    }
  };

  const meetsStandards = (asset: AudioAsset) => {
    if (asset.audioVersionString !== "v2_loud") return false;
    if (!asset.integratedLufs || !asset.truePeakDbtp) return false;
    const loudnessOk = Math.abs(asset.integratedLufs - (-14)) <= 1;
    const peakOk = asset.truePeakDbtp <= -0.5;
    return loudnessOk && peakOk;
  };

  const languages = Array.from(new Set(assets.map((a) => a.languageCode)));

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-ink">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-ink mb-8">音訊品質測試頁面</h1>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm text-ink mb-2">版本</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border rounded px-3 py-2"
              >
                <option value="all">全部</option>
                <option value="v1">v1 (舊版)</option>
                <option value="v2_loud">v2_loud (新版)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-ink mb-2">語言</label>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">全部</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto">
              <button
                onClick={fetchAssets}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded"
              >
                <RefreshCw size={16} />
                重新載入
              </button>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        {selectedAsset && (
          <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={playing ? stopAudio : () => playAudio(selectedAsset)}
                className="bg-primary text-white p-3 rounded-full"
              >
                {playing ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <div className="flex-1">
                <div className="text-sm text-ink">{selectedAsset.normalizedText}</div>
                <div className="text-xs text-gray-500">
                  {selectedAsset.languageCode} • {selectedAsset.audioVersionString}
                </div>
              </div>
              <Volume2 size={24} className="text-ink" />
            </div>
          </div>
        )}

        {/* Assets List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">語言</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">版本</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">LUFS</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">Peak</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">LRA</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">狀態</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-ink">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="border-t">
                  <td className="px-4 py-3 text-sm text-ink">{asset.languageCode}</td>
                  <td className="px-4 py-3 text-sm text-ink">{asset.audioVersionString}</td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {asset.integratedLufs ? asset.integratedLufs.toFixed(1) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {asset.truePeakDbtp ? asset.truePeakDbtp.toFixed(1) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {asset.loudnessRangeLu ? asset.loudnessRangeLu.toFixed(1) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {meetsStandards(asset) ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} />
                        符合標準
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle size={16} />
                        不符合
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => playAudio(asset, false)}
                        className="text-primary hover:underline"
                      >
                        播放舊版
                      </button>
                      {asset.processedAudioPath && (
                        <button
                          onClick={() => playAudio(asset, true)}
                          className="text-primary hover:underline"
                        >
                          播放新版
                        </button>
                      )}
                      {asset.audioVersionString === "v1" && (
                        <button
                          onClick={() => reprocessAsset(asset.id)}
                          className="text-primary hover:underline"
                        >
                          重新處理
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-ink">{assets.length}</div>
            <div className="text-sm text-gray-500">總音檔數</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-ink">
              {assets.filter((a) => a.audioVersionString === "v2_loud").length}
            </div>
            <div className="text-sm text-gray-500">v2_loud 音檔</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-ink">
              {assets.filter((a) => meetsStandards(a)).length}
            </div>
            <div className="text-sm text-gray-500">符合標準</div>
          </div>
        </div>
      </div>
    </div>
  );
}
