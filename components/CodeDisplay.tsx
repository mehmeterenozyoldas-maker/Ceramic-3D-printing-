import React, { useState } from 'react';
import { GeneratedScript } from '../types';
import { Copy, Check, Terminal, FileCode } from 'lucide-react';

interface CodeDisplayProps {
  script: GeneratedScript | null;
}

export const CodeDisplay: React.FC<CodeDisplayProps> = ({ script }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (script) {
      navigator.clipboard.writeText(script.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!script) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/50 rounded-xl border-2 border-dashed border-zinc-800 p-8">
        <Terminal className="w-12 h-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-zinc-400">No Code Generated</h3>
        <p className="text-sm text-center max-w-xs mt-2">
          Adjust parameters and click "Generate Processing Script" to use AI to write your 3D printing code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-clay-400" />
          <span className="text-sm font-medium text-zinc-200">Processing (Java)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
      
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-sm">
        <div className="mb-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
            <h4 className="text-clay-400 font-semibold mb-1 text-xs uppercase tracking-wider">AI Explanation</h4>
            <p className="text-zinc-400 leading-relaxed text-sm">
                {script.explanation}
            </p>
        </div>
        <pre className="text-zinc-300 leading-relaxed whitespace-pre-wrap break-all">
          <code>{script.code}</code>
        </pre>
      </div>
    </div>
  );
};
