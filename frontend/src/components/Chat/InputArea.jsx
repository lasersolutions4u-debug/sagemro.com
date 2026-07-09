import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, StopCircle } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';
import { transcribeVoiceInput } from '../../services/api';

const VOICE_RECORDING_LIMIT_MS = 30 * 1000;

export function InputArea({ onSend, onStop, disabled, isStreaming }) {
  const isCn = isCnLocale();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('auto');
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const supportsVoiceInput = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  useEffect(() => () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;

    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (!supportsVoiceInput || disabled || isStreaming || isTranscribing) return;

    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (!audioBlob.size) return;

        setIsTranscribing(true);
        try {
          const result = await transcribeVoiceInput(audioBlob, voiceLanguage);
          const transcript = (result.transcript || '').trim();
          if (transcript) {
            setInput((current) => current ? `${current} ${transcript}` : transcript);
          }
        } catch (error) {
          setVoiceError(error.message || (isCn ? '语音转文字失败' : 'Voice transcription failed'));
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setTimeout(stopRecording, VOICE_RECORDING_LIMIT_MS);
    } catch {
      setVoiceError(isCn ? '无法使用麦克风' : 'Voice input unavailable');
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const canSend = input.trim() && !disabled;
  const placeholder = isCn ? '描述设备问题' : 'Describe your service issue';
  const voiceLanguageOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'zh', label: '中' },
    { value: 'en', label: 'EN' },
  ];
  const voiceTitle = !supportsVoiceInput
    ? (isCn ? '语音输入不可用' : 'Voice input unavailable')
    : isRecording
      ? (isCn ? '点击停止录音' : 'Stop recording')
      : (isCn ? '语音转文字' : 'Voice to text');

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-3 pb-[env(safe-area-inset-bottom)] sm:px-6 sm:py-4">
      <div className="mx-auto max-w-4xl">
        {voiceError && (
          <div className="mb-2 text-xs text-red-500">
            {voiceError}
          </div>
        )}
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex shrink-0 items-start gap-1">
            <button
              type="button"
              onClick={handleVoiceClick}
              disabled={!supportsVoiceInput || disabled || isStreaming || isTranscribing}
              title={voiceTitle}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors active:scale-95 disabled:opacity-45 ${
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
              }`}
            >
              {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
            </button>
            <select
              aria-label="Voice language"
              value={voiceLanguage}
              onChange={(event) => setVoiceLanguage(event.target.value)}
              disabled={disabled || isRecording || isTranscribing}
              className="h-12 w-[58px] shrink-0 rounded-2xl border-0 bg-[var(--color-surface-elevated)] px-2 text-xs font-medium text-[var(--color-text-secondary)] outline-none transition-colors hover:text-[var(--color-primary)] disabled:opacity-45 sm:w-[68px]"
              title={isCn ? '语音语言' : 'Voice language'}
            >
              {voiceLanguageOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`input-wrapper flex-1 rounded-2xl transition-colors ${disabled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-start">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white transition-colors hover:bg-red-600 active:scale-95"
                title={isCn ? '停止生成' : 'Stop generation'}
              >
                <StopCircle size={22} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend || disabled}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:bg-[var(--color-border)] disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
