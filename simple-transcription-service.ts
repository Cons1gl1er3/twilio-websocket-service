import { EventEmitter } from 'events';
import { SpeechClient } from '@google-cloud/speech';

const speech = new SpeechClient();

export class TranscriptionService extends EventEmitter {
  private stream: any = null;
  private streamCreatedAt: Date | null = null;
  private isStreamDestroyed: boolean = false;

  constructor() {
    super();
  }
  
  send(payload: string) {
    try {
      // Convert base64 payload to buffer
      const audioBuffer = Buffer.from(payload, 'base64');
      
      // Check if stream is valid before writing
      const currentStream = this.getStream();
      if (currentStream && !this.isStreamDestroyed && !currentStream.destroyed) {
        currentStream.write(audioBuffer);
      } else {
        // Stream is not ready, skip this audio chunk
        console.log('Stream not ready, skipping audio chunk');
      }
    } catch (error) {
      console.error('Error sending audio to transcription service:', error);
      this.emit('error', error);
    }
  }

  close() {
    if (this.stream && !this.isStreamDestroyed) {
      this.isStreamDestroyed = true;
      this.stream.destroy();
      this.stream = null;
    }
  }

  private newStreamRequired(): boolean {
    if (!this.stream || this.isStreamDestroyed || this.stream.destroyed) {
      return true;
    } else {
      const now = new Date();
      const timeSinceStreamCreated = now.getTime() - (this.streamCreatedAt?.getTime() || 0);
      const streamTimeout = parseInt(process.env.SPEECH_STREAM_TIMEOUT || '60', 10);
      return timeSinceStreamCreated / 1000 > streamTimeout;
    }
  }

  private getStream() {
    if (this.newStreamRequired()) {
      if (this.stream && !this.isStreamDestroyed) {
        this.stream.destroy();
      }

      const request = {
        config: {
          encoding: "MULAW" as const,
          sampleRateHertz: parseInt(process.env.SPEECH_SAMPLE_RATE || '8000', 10),
          languageCode: process.env.SPEECH_LANGUAGE || "en-US"
        },
        interimResults: true
      };

      this.streamCreatedAt = new Date();
      this.isStreamDestroyed = false;
      
      this.stream = speech
        .streamingRecognize(request)
        .on("error", (error: any) => {
          console.error("Speech recognition error:", error);
          this.isStreamDestroyed = true;
          this.emit('error', error);
          
          // Try to recreate stream after a short delay
          setTimeout(() => {
            if (!this.isStreamDestroyed) {
              this.stream = null; // Force recreation on next send
            }
          }, 1000);
        })
        .on("end", () => {
          console.log("Speech recognition stream ended");
          this.isStreamDestroyed = true;
        })
        .on("close", () => {
          console.log("Speech recognition stream closed");
          this.isStreamDestroyed = true;
        })
        .on("data", (data: any) => {
          const result = data.results && data.results[0];
          if (result === undefined || !result.alternatives || result.alternatives[0] === undefined) {
            return;
          }
          
          const transcript = result.alternatives[0].transcript;
          if (transcript && transcript.trim()) {
            this.emit('transcription', transcript.trim());
          }
        });
    }

    return this.stream;
  }
}