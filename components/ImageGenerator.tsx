'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, Loader2, Lightbulb, LightbulbOff, X, Download, ZoomIn } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const STYLES = [
  '现代简约',
  '轻奢',
  '北欧',
  '侘寂',
  '奶油风',
  '现代酒店',
];

const RATIOS = ['1:1', '3:4', '9:16', '16:9'];
const QUALITIES = ['1K', '2K', '4K'];

interface GeneratedImage {
  id: string;
  title: string;
  url: string;
}

const SHOTS_CONFIG = [
  {
    id: 'main-1',
    title: '主图 1：中近景特写',
    promptSuffix: `\n\nShot requirement: Medium shot focusing on the lamp's overall structure. Ensure the ENTIRE shape and silhouette of the lamp is fully visible within the frame, without cropping any parts.`,
  },
  {
    id: 'main-2',
    title: '主图 2：全景融入',
    promptSuffix: `\n\nShot requirement: Wide shot showing the lamp integrated into the full interior scene. Show the surrounding furniture and decor matching the \${style} style.`,
  },
  {
    id: 'detail-1',
    title: '细节 1：材质纹理',
    promptSuffix: `\n\nShot requirement: Close-up of the lampshade or body. Show a good portion of the lamp's shape while highlighting the material and texture, rather than an extreme macro shot.`,
  },
  {
    id: 'detail-2',
    title: '细节 2：底座/关节',
    promptSuffix: `\n\nShot requirement: Close-up of the base, joint, or secondary design element of the lamp.`,
  },
  {
    id: 'night',
    title: '夜景图：灯光氛围',
    promptSuffix: `\n\nShot requirement: Wide shot showing the lamp integrated into the full interior scene (same composition as Main Shot 2), but at night. The room is at night with the lamp as the primary light source. Darken the room moderately and turn on the lamp glow naturally. Show the surrounding furniture and decor matching the \${style} style. Do not make the room too dark. Do not overexpose the lamp light.`,
  },
];

export default function ImageGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [style, setStyle] = useState(STYLES[0]);
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [quality, setQuality] = useState(QUALITIES[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [lightState, setLightState] = useState<'on' | 'off'>('on');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (selected) {
      setFile(selected);
      const objectUrl = URL.createObjectURL(selected);
      setPreview(objectUrl);
    }
  }, []);

  const downloadImage = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: 1,
  });

  const generateImages = async () => {
    if (!file) {
      setError('请先上传灯具图片。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });

      const mimeType = file.type;

      const basePrompt = `
        You are a professional product photographer and 3D renderer.
        I am providing an image of a lamp. 
        CRITICAL RULES:
        - The uploaded lamp is the hero product.
        - DO NOT change the lamp's shape, structure, style, material, color, finish, or decorative details. Keep it exactly as it is in the uploaded image.
        - The room is a supporting background only.
        - Make the lamp visually attractive through composition, lighting, and framing, not by redesigning it.
        - Keep perspective, shadows, reflections, and placement realistic. Avoid floating placement.
        - Do not use heavy filters or fake CGI looks.
        - Final images should look premium, realistic, and sales-ready.
        
        Scene Style: ${style}.
        Light State: ${lightState === 'on' ? 'The lamp is turned ON, emitting a natural, beautiful glow with stronger ambience in the room. Turn on the lamp lighting effect naturally.' : 'The lamp is turned OFF. Normal indoor scene, do not emphasize lamp glow.'}
        ${customPrompt ? `Additional user request: ${customPrompt}` : ''}
      `;

      const generateShot = async (shotConfig: typeof SHOTS_CONFIG[0]) => {
        const prompt = basePrompt + shotConfig.promptSuffix.replace('${style}', style);
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: ratio as any,
              imageSize: quality as any,
            },
          },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return {
              id: shotConfig.id,
              title: shotConfig.title,
              url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
            };
          }
        }
        throw new Error('未能生成图片：' + shotConfig.title);
      };

      for (const shot of SHOTS_CONFIG) {
        const generatedShot = await generateShot(shot);
        setResults((prev) => [...prev, generatedShot]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '生成图片时发生错误。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-amber-500" />
          LuminaStudio
        </h1>
      </header>

      <main className="w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-3 xl:col-span-3 space-y-8">
          {/* Upload */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">1. 上传灯具图片</h2>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              <input {...getInputProps()} />
              {preview ? (
                <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">拖拽图片到此处，或点击上传</p>
                </div>
              )}
            </div>
          </section>

          {/* Style */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">2. 场景风格</h2>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                    style === s
                      ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Ratio */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">3. 画面比例</h2>
            <div className="flex gap-2">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    ratio === r
                      ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </section>

          {/* Quality */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">4. 画面画质</h2>
            <div className="flex gap-2">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    quality === q
                      ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          {/* Light State */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">5. 灯光状态</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setLightState('on')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border transition-colors ${
                  lightState === 'on'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Lightbulb className="w-4 h-4" /> 开灯
              </button>
              <button
                onClick={() => setLightState('off')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border transition-colors ${
                  lightState === 'off'
                    ? 'border-gray-900 bg-gray-900 text-white font-medium'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <LightbulbOff className="w-4 h-4" /> 关灯
              </button>
            </div>
          </section>

          {/* Prompt */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">6. 自定义提示词 (可选)</h2>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：背景增加一盆龟背竹..."
              className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none bg-white"
              rows={3}
            />
          </section>

          <button
            onClick={generateImages}
            disabled={!file || isGenerating}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在生成 5 张图片...
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                生成图片
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-9 xl:col-span-9">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 min-h-[600px]">
            <div className="grid grid-cols-6 gap-6">
              {SHOTS_CONFIG.map((shot, i) => {
                const result = results.find((r) => r.id === shot.id);
                const isGeneratingThis = isGenerating && results.length === i;
                const isPending = isGenerating && results.length < i;

                return (
                  <div key={shot.id} className={`space-y-3 ${i < 3 ? 'col-span-2' : 'col-span-3'}`}>
                    <h3 className="text-sm font-medium text-gray-900 border-b pb-2">{shot.title}</h3>
                    <div 
                      className="relative w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-200 shadow-sm flex items-center justify-center transition-all group"
                      style={{ aspectRatio: ratio.replace(':', '/') }}
                    >
                      {result ? (
                        <>
                          <img src={result.url} alt={shot.title} className="w-full h-full object-cover block animate-in fade-in duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button
                              onClick={() => setPreviewImage(result)}
                              className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                              title="放大预览"
                            >
                              <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => downloadImage(result.url, result.title)}
                              className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                              title="下载图片"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </>
                      ) : isGeneratingThis ? (
                        <div className="flex flex-col items-center justify-center text-amber-500 space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-xs font-medium">生成中...</span>
                        </div>
                      ) : isPending ? (
                        <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin opacity-30" />
                          <span className="text-xs">等待中...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-300 space-y-3">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                          <span className="text-xs">等待生成</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div className="absolute top-4 right-4 flex items-center gap-4 z-10">
              <button
                onClick={() => downloadImage(previewImage.url, previewImage.title)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                title="下载图片"
              >
                <Download className="w-6 h-6" />
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                title="关闭"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <p className="absolute bottom-6 text-white/80 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
              {previewImage.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
