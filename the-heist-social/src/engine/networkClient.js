export class NetworkClient {
  constructor(handlers = {}) {
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.handlers = handlers;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;

      const timer = setTimeout(() => {
        if (!this.connected) {
          ws.close();
          reject(new Error('Connessione al server multiplayer scaduta.'));
        }
      }, 6000);

      ws.onopen = () => {
        this.connected = true;
      };

      ws.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (data.type === 'welcome') {
          this.playerId = data.playerId;
          clearTimeout(timer);
          resolve(this.playerId);
          return;
        }

        if (data.type === 'voice_clip' && data.audioDataUrl) {
          if (data.senderId !== this.playerId) {
            const audio = new Audio(data.audioDataUrl);
            audio.volume = 0.9;
            audio.play().catch(() => {});
          }
          this.handlers.onVoiceActivity?.(data);
          return;
        }

        this.handlers.onMessage?.(data);
      };

      ws.onerror = () => {
        clearTimeout(timer);
        this.connected = false;
      };

      ws.onclose = () => {
        this.connected = false;
        this.handlers.onDisconnect?.();
      };
    });
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  async startPushToTalk() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfono non supportato su questo browser.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      if (blob.size < 400) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          this.send({ type: 'voice_clip', audioDataUrl: reader.result });
        }
      };
      reader.readAsDataURL(blob);
    };
    this.mediaRecorder.start();
  }

  stopPushToTalk() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }
}
