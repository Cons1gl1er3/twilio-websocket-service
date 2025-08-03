import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
const HttpDispatcher = require('httpdispatcher');
import { server as WebSocketServer } from 'websocket';
import { TranscriptionService } from './simple-transcription-service';

const dispatcher = new HttpDispatcher();
const wsserver = http.createServer(handleRequest);

const HTTP_SERVER_PORT = parseInt(process.env.SERVER_PORT || '8080', 10);
const HTTP_SERVER_HOST = process.env.SERVER_HOST || 'localhost';

function log(message: string, ...args: any[]) {
  console.log(new Date(), message, ...args);
}

const mediaws = new WebSocketServer({
  httpServer: wsserver,
  autoAcceptConnections: true,
});

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  try {
    dispatcher.dispatch(request, response);
  } catch(err) {
    console.error(err);
  }
}

// TwiML endpoint that returns the media stream configuration
dispatcher.onPost('/twiml', function(req: any, res: any) {
  log('POST TwiML');

  try {
    const filePath = path.join(__dirname, '../templates', 'streams.xml');
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': stat.size
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    // Fallback to inline TwiML if template file doesn't exist
    log('Template file not found, using inline TwiML');
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="wss://your-ngrok-url.ngrok.io/"></Stream>
  </Start>
  <Pause length="40"/>
</Response>`;

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': Buffer.byteLength(twimlResponse)
    });

    res.end(twimlResponse);
  }
});

// Handle WebSocket connections from Twilio
mediaws.on('connect', function(connection) {
  log('Media WS: Connection accepted');
  new MediaStreamHandler(connection);
});

interface TwilioMessage {
  event: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: any;
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded audio
  };
  stop?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
  };
}

class MediaStreamHandler {
  private metaData: any = null;
  private trackHandlers: { [key: string]: TranscriptionService } = {};

  constructor(private connection: any) {
    connection.on('message', this.processMessage.bind(this));
    connection.on('close', this.close.bind(this));
  }

  processMessage(message: any) {
    if (message.type === 'utf8') {
      const data: TwilioMessage = JSON.parse(message.utf8Data);
      
      if (data.event === "start") {
        log('📞 Call started:', data.start);
        this.metaData = data.start;
        return;
      }
      
      if (data.event === "stop") {
        log('📞 Call ended:', data.stop);
        return;
      }
      
      if (data.event !== "media") {
        return;
      }

      if (!data.media) {
        return;
      }

      const track = data.media.track;
      
      // Create a transcription service for each track if it doesn't exist
      if (this.trackHandlers[track] === undefined) {
        const service = new TranscriptionService();
        service.on('transcription', (transcription: string) => {
          log(`🎯 Transcription (${track}): ${transcription}`);
        });
        service.on('error', (error: any) => {
          log(`❌ Transcription Error (${track}):`, error);
        });
        this.trackHandlers[track] = service;
      }
      
      // Send the audio payload to the transcription service
      this.trackHandlers[track].send(data.media.payload);
      
    } else if (message.type === 'binary') {
      log('Media WS: binary message received (not supported)');
    }
  }

  close() {
    log('Media WS: closed');

    for (let track of Object.keys(this.trackHandlers)) {
      log(`Closing ${track} handler`);
      this.trackHandlers[track].close();
    }
  }
}

wsserver.listen(HTTP_SERVER_PORT, HTTP_SERVER_HOST, function() {
  console.log("🚀 Server listening on: http://%s:%s", HTTP_SERVER_HOST, HTTP_SERVER_PORT);
  console.log("📡 WebSocket endpoint: ws://%s:%s", HTTP_SERVER_HOST, HTTP_SERVER_PORT);
  console.log("📋 TwiML endpoint: http://%s:%s/twiml", HTTP_SERVER_HOST, HTTP_SERVER_PORT);
  console.log("🔧 To use with Twilio, update the Stream URL in TwiML to your ngrok URL");
  console.log("🌍 Environment: %s", process.env.NODE_ENV || 'development');
});